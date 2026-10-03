-- Run once on a fresh Supabase project. All privileged operations are server-only.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 first_name text not null default '' check (length(first_name) <= 80),
 preferences jsonb not null default '{"tone":"Simple","emojis":"moderate","shipping":false,"negotiation":false}',
 credit_balance integer check (credit_balance >= 0), deleting boolean not null default false,
 created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, first_name) values(new.id, left(coalesce(new.raw_user_meta_data->>'first_name',''),80));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create table public.media (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 bucket text not null check(bucket in ('originals','generated')), path text not null unique,
 width integer not null check(width > 0), height integer not null check(height > 0),
 created_at timestamptz not null default now(), unique(id,user_id),
 check(split_part(path,'/',1) = user_id::text)
);
create table public.listings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 original_media_id uuid not null, title text not null check(length(title) between 1 and 120),
 description text not null check(length(description) between 1 and 4000),
 category text, subcategory text, brand text, color text, material text, condition text,
 style text[] not null default '{}', tone text not null default 'Simple',
 product_detected boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(original_media_id,user_id) references public.media(id,user_id)
);
create table public.generated_images (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 source_media_id uuid not null, generated_media_id uuid not null,
 prompt_version text not null, created_at timestamptz not null default now(),
 foreign key(source_media_id,user_id) references public.media(id,user_id),
 foreign key(generated_media_id,user_id) references public.media(id,user_id)
);
create table public.generation_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 kind text not null check(kind in ('listing','image','upload')), status text not null check(status in ('running','succeeded','failed')),
 source_media_id uuid references public.media on delete set null,
 cost integer not null, created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index one_generation_per_user on public.generation_jobs(user_id) where status='running';
create index listing_history on public.listings(user_id, created_at desc);
create index image_history on public.generated_images(user_id, created_at desc);
create index media_owner on public.media(user_id,created_at);
create index job_budget on public.generation_jobs(user_id,kind,created_at desc);
create table public.credit_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 job_id uuid unique references public.generation_jobs on delete set null, delta integer not null,
 created_at timestamptz not null default now()
);
create table public.auth_limits(key text primary key, window_at timestamptz not null, count integer not null);
create table public.recovery_tokens(id uuid primary key,user_id uuid not null references auth.users on delete cascade,expires_at timestamptz not null);
create table public.storage_cleanup (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, bucket text not null, path text not null unique,
 created_at timestamptz not null default now()
);
create function public.enqueue_media_cleanup() returns trigger language plpgsql set search_path = '' as $$
begin insert into public.storage_cleanup(user_id,bucket,path) values(old.user_id,old.bucket,old.path) on conflict(path) do nothing; return old; end $$;
create trigger clean_media after delete on public.media for each row execute function public.enqueue_media_cleanup();
create function public.touch_listing() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger listing_updated before update on public.listings for each row execute function public.touch_listing();
alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.listings enable row level security;
alter table public.generated_images enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.auth_limits enable row level security;
alter table public.recovery_tokens enable row level security;
alter table public.storage_cleanup enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_media on public.media for select to authenticated using(user_id=(select auth.uid()));
create policy own_listings on public.listings for select to authenticated using(user_id=(select auth.uid()));
create policy own_images on public.generated_images for select to authenticated using(user_id=(select auth.uid()));
create policy own_jobs on public.generation_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy own_credits on public.credit_ledger for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.profiles,public.media,public.listings,public.generated_images,public.generation_jobs,public.credit_ledger,public.auth_limits,public.storage_cleanup,public.recovery_tokens from anon,authenticated;
grant select on public.profiles,public.media,public.listings,public.generated_images,public.generation_jobs,public.credit_ledger to authenticated;
grant all on public.profiles,public.media,public.listings,public.generated_images,public.generation_jobs,public.credit_ledger,public.auth_limits,public.storage_cleanup,public.recovery_tokens to service_role;

create function public.consume_auth_limit(p_key text) returns boolean language plpgsql set search_path = '' as $$
declare hits integer;
begin
 insert into public.auth_limits(key,window_at,count) values(p_key,now(),1)
 on conflict(key) do update set count=case when auth_limits.window_at < now()-interval '15 minutes' then 1 else auth_limits.count+1 end,
 window_at=case when auth_limits.window_at < now()-interval '15 minutes' then now() else auth_limits.window_at end returning count into hits;
 return hits <= 10;
end $$;
create function public.begin_generation(p_user uuid,p_kind text,p_limit integer,p_source uuid) returns uuid language plpgsql set search_path = '' as $$
declare job uuid; balance integer; price integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from public.profiles where id=p_user and not deleting) then raise exception 'BUSY'; end if;
 if p_kind <> 'upload' and not exists(select 1 from public.media where id=p_source and user_id=p_user) then raise exception 'BUSY'; end if;
 if p_kind='upload' and (select count(*) from public.media where user_id=p_user)>=200 then raise exception 'LIMIT'; end if;
 -- Requests have a 240 s provider timeout; allow extra time for persistence.
 update public.generation_jobs set status='failed',finished_at=now() where user_id=p_user and status='running' and created_at < now()-interval '10 minutes';
 if exists(select 1 from public.generation_jobs where user_id=p_user and status='running') then raise exception 'BUSY'; end if;
 if (select count(*) from public.generation_jobs where user_id=p_user and kind=p_kind and created_at > now()-interval '24 hours') >= p_limit then raise exception 'LIMIT'; end if;
 if (select count(*) from public.generation_jobs where user_id=p_user and created_at > now()-interval '1 minute') >= 5 then raise exception 'LIMIT'; end if;
 price=case when p_kind='image' then 5 when p_kind='listing' then 1 else 0 end;
 select credit_balance into balance from public.profiles where id=p_user for update;
 if balance is not null and balance < price then raise exception 'CREDITS'; end if;
 insert into public.generation_jobs(user_id,kind,status,cost,source_media_id) values(p_user,p_kind,'running',price,p_source) returning id into job;
 return job;
end $$;
create function public.finish_generation(p_job uuid,p_success boolean) returns void language plpgsql set search_path = '' as $$
declare j public.generation_jobs;
begin
 select * into j from public.generation_jobs where id=p_job for update;
 if j.status <> 'running' then return; end if;
 update public.generation_jobs set status=case when p_success then 'succeeded' else 'failed' end,finished_at=now() where id=p_job;
 if p_success and j.cost>0 then
   update public.profiles set credit_balance=credit_balance-j.cost where id=j.user_id and credit_balance is not null;
   insert into public.credit_ledger(user_id,job_id,delta) values(j.user_id,j.id,-j.cost) on conflict(job_id) do nothing;
 end if;
end $$;
create function public.prune_media(p_user uuid,p_min_age_seconds integer) returns void language plpgsql set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 delete from public.media m where m.user_id=p_user and m.created_at < now()-make_interval(secs=>p_min_age_seconds)
 and not exists(select 1 from public.listings l where l.original_media_id=m.id)
 and not exists(select 1 from public.generated_images g where g.source_media_id=m.id or g.generated_media_id=m.id)
 and not exists(select 1 from public.generation_jobs j where j.status='running' and j.user_id=p_user);
end $$;
create function public.complete_listing(p_job uuid,p_payload jsonb) returns uuid language plpgsql set search_path = '' as $$
declare j public.generation_jobs; result uuid;
begin
 select * into j from public.generation_jobs where id=p_job for update;
 if j.status<>'running' or j.kind<>'listing' then raise exception 'INVALID_JOB'; end if;
 insert into public.listings(user_id,original_media_id,title,description,category,subcategory,brand,color,material,condition,style,tone)
 values(j.user_id,j.source_media_id,p_payload->>'title',p_payload->>'description',p_payload->>'category',p_payload->>'subcategory',p_payload->>'brand',p_payload->>'color',p_payload->>'material',p_payload->>'condition',array(select jsonb_array_elements_text(p_payload->'style')),p_payload->>'tone') returning id into result;
 perform public.finish_generation(p_job,true);
 return result;
end $$;
create function public.complete_image(p_job uuid,p_result uuid,p_version text) returns uuid language plpgsql set search_path = '' as $$
declare j public.generation_jobs; result uuid;
begin
 select * into j from public.generation_jobs where id=p_job for update;
 if j.status<>'running' or j.kind<>'image' then raise exception 'INVALID_JOB'; end if;
 insert into public.generated_images(user_id,source_media_id,generated_media_id,prompt_version) values(j.user_id,j.source_media_id,p_result,p_version) returning id into result;
 perform public.finish_generation(p_job,true);
 return result;
end $$;
create function public.reserve_account_deletion(p_user uuid) returns void language plpgsql set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 update public.generation_jobs set status='failed',finished_at=now() where user_id=p_user and status='running' and created_at<now()-interval '10 minutes';
 if exists(select 1 from public.generation_jobs where user_id=p_user and status='running') then raise exception 'BUSY'; end if;
 update public.profiles set deleting=true where id=p_user;
end $$;
revoke execute on function public.create_profile(),public.enqueue_media_cleanup(),public.touch_listing(),public.consume_auth_limit(text),public.begin_generation(uuid,text,integer,uuid),public.finish_generation(uuid,boolean),public.prune_media(uuid,integer),public.complete_listing(uuid,jsonb),public.complete_image(uuid,uuid,text),public.reserve_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.consume_auth_limit(text),public.begin_generation(uuid,text,integer,uuid),public.finish_generation(uuid,boolean),public.prune_media(uuid,integer),public.complete_listing(uuid,jsonb),public.complete_image(uuid,uuid,text),public.reserve_account_deletion(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('originals','originals',false,20971520,array['image/png']),('generated','generated',false,20971520,array['image/png']);
create policy sellai_storage_read on storage.objects for select to authenticated
 using(bucket_id in ('originals','generated') and (storage.foldername(name))[1]=(select auth.uid())::text);
