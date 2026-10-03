import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
const db=new PGlite({extensions:{pgcrypto}});
const userA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",userB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",mediaA="cccccccc-cccc-4ccc-8ccc-cccccccccccc",mediaB="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 grant usage on schema public,auth,storage to authenticated,service_role;
 grant select on storage.objects to authenticated;`);
 const migration=await readFile(new URL("../supabase/migrations/202610020001_sellai.sql",import.meta.url),"utf8");
 await db.exec(migration);
 await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$3),($2,$3)",[userA,userB,{first_name:"Test"}]);
 await db.query("insert into public.media(id,user_id,bucket,path,width,height) values($1,$2,'originals',$3,80,80),($4,$5,'originals',$6,80,80)",[mediaA,userA,`${userA}/a.png`,mediaB,userB,`${userB}/b.png`]);
});
afterAll(()=>db.close());
describe("Migration PostgreSQL et isolement",()=>{
 it("crée automatiquement les profils",async()=>{const {rows}=await db.query<{first_name:string}>("select first_name from profiles where id=$1",[userA]);expect(rows[0].first_name).toBe("Test");});
 it("RLS masque les photos de l’autre utilisateur",async()=>{
  await db.exec(`set role authenticated;set test.uid='${userA}'`);
  const {rows}=await db.query("select id from media");expect(rows).toEqual([{id:mediaA}]);
  await expect(db.query("delete from media where id=$1",[mediaA])).rejects.toThrow();
  await expect(db.query("select begin_generation($1,'listing',30,$2)",[userA,mediaA])).rejects.toThrow();
  await db.exec("reset role");
 });
 it("les FK composites interdisent une photo d’un autre compte",async()=>{await expect(db.query("insert into listings(user_id,original_media_id,title,description) values($1,$2,'Sac','Description')",[userA,mediaB])).rejects.toThrow();});
 it("bloque les générations concurrentes et protège leur source",async()=>{
  const {rows}=await db.query<{id:string}>("select begin_generation($1,'listing',30,$2) as id",[userA,mediaA]);const job=rows[0].id;
  await expect(db.query("select begin_generation($1,'image',5,$2)",[userA,mediaA])).rejects.toThrow("BUSY");
  await db.query("select prune_media($1,0)",[userA]);expect((await db.query("select id from media where id=$1",[mediaA])).rows).toHaveLength(1);
  await expect(db.query("select reserve_account_deletion($1)",[userA])).rejects.toThrow("BUSY");
  await db.query("select finish_generation($1,false)",[job]);
 });
 it("enregistre l’annonce et ses crédits en une transaction idempotente",async()=>{
  await db.query("update profiles set credit_balance=8 where id=$1",[userA]);
  const {rows}=await db.query<{id:string}>("select begin_generation($1,'listing',30,$2) as id",[userA,mediaA]);const job=rows[0].id;
  const payload={title:"Sac noir",description:"Sac avec fermeture visible",category:"Sac",subcategory:null,brand:null,color:"Noir",material:null,condition:null,style:[],tone:"Simple"};
  await db.query("select complete_listing($1,$2)",[job,payload]);
  await db.query("select finish_generation($1,true)",[job]);
  const balance=(await db.query<{credit_balance:number}>("select credit_balance from profiles where id=$1",[userA])).rows[0];
  expect(balance.credit_balance).toBe(7);expect((await db.query("select id from credit_ledger where job_id=$1",[job])).rows).toHaveLength(1);
 });
 it("bloque les écritures client même sur leurs propres créations",async()=>{
  await db.exec(`set role authenticated;set test.uid='${userA}'`);
  expect((await db.query("select id from listings")).rows).toHaveLength(1);
  await expect(db.query("update profiles set credit_balance=999 where id=$1",[userA])).rejects.toThrow();
  await db.exec(`set test.uid='${userB}'`);expect((await db.query("select id from listings")).rows).toHaveLength(0);await db.exec("reset role");
 });
 it("préserve les médias partagés et enfile le nettoyage des orphelins",async()=>{
  await db.query("select prune_media($1,0)",[userA]);expect((await db.query("select id from media where id=$1",[mediaA])).rows).toHaveLength(1);
  await db.query("delete from listings where user_id=$1",[userA]);await db.query("select prune_media($1,0)",[userA]);
  expect((await db.query("select id from media where id=$1",[mediaA])).rows).toHaveLength(0);
  expect((await db.query("select path from storage_cleanup where user_id=$1",[userA])).rows).toHaveLength(1);
 });
 it("refuse les uploads après réservation de suppression du compte",async()=>{await db.query("select reserve_account_deletion($1)",[userB]);await expect(db.query("select begin_generation($1,'upload',100,null)",[userB])).rejects.toThrow("BUSY");});
});
