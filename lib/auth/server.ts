import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { required } from "../server/env";
import { AppError } from "../server/errors";
export async function authClient() {
  const jar = await cookies();
  return createServerClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), { cookies: {
    getAll: () => jar.getAll(),
    setAll: (values) => { try { values.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" })); } catch { /* Server Components cannot write cookies; proxy refreshes them. */ } },
  } });
}
export function adminClient() { return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function requireUser() {
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AppError("Connecte-toi pour continuer.", 401);
  const { data: profile, error: profileError } = await client.from("profiles").select("deleting").eq("id", user.id).single();
  if (profileError) throw new AppError("Impossible de charger ton compte.", 503);
  if (profile?.deleting) throw new AppError("La suppression de ton compte est en cours.", 409);
  return { user, client };
}
