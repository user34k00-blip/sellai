import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError,AppError,dbCheck } from "@/lib/server/errors";
import { verifyMutation,readJson,authRateLimit } from "@/lib/server/security";
import { profileFor } from "@/lib/database/server";
import { preferencesSchema } from "@/lib/schemas";
import { cleanupUser } from "@/lib/storage/server";
export async function GET(){try{const {user}=await requireUser();return NextResponse.json({...await profileFor(user.id),email:user.email},{headers:{"Cache-Control":"private, no-store"}});}catch(error){return apiError(error);}}
export async function PATCH(request:Request){try{
 verifyMutation(request);const {user,client}=await requireUser();
 const body=z.object({first_name:z.string().trim().min(1).max(80),preferences:preferencesSchema,email:z.email().max(254).optional(),password:z.string().min(10).max(128).optional(),current_password:z.string().max(128).optional()}).strict().parse(await readJson(request));
 if(body.email && body.email!==user.email || body.password) {
  if(!body.current_password || !user.email) throw new AppError("Saisis ton mot de passe actuel pour modifier tes accès.");
  await authRateLimit(`settings:${user.id}`);
  const {error:verifyError}=await client.auth.signInWithPassword({email:user.email,password:body.current_password});
  if(verifyError)throw new AppError("Le mot de passe actuel est incorrect.",401);
  const {error}=await client.auth.updateUser({...(body.email!==user.email?{email:body.email}:{}),...(body.password?{password:body.password}:{})});
  if(error)throw new AppError("Impossible de modifier tes accès. Vérifie l’adresse email et le mot de passe.");
 }
 const {error}=await adminClient().from("profiles").update({first_name:body.first_name,preferences:body.preferences}).eq("id",user.id);dbCheck(error);
 return NextResponse.json({ok:true,email_confirmation:Boolean(body.email && body.email!==user.email)});
}catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{
 verifyMutation(request);const client=await (await import("@/lib/auth/server")).authClient();
 const {data:{user}}=await client.auth.getUser();if(!user?.email)throw new AppError("Connecte-toi pour continuer.",401);
 const {password}=z.object({password:z.string().min(1).max(128)}).strict().parse(await readJson(request));
 await authRateLimit(`delete:${user.id}`);
 const {error:verifyError}=await client.auth.signInWithPassword({email:user.email,password});if(verifyError)throw new AppError("Le mot de passe est incorrect.",401);
 const admin=adminClient();
 const {error:markError}=await admin.rpc("reserve_account_deletion",{p_user:user.id});
 if(markError?.message.includes("BUSY"))throw new AppError("Attends la fin de l’import ou de la génération avant de supprimer ton compte.",409);
 dbCheck(markError);
 const {data:media,error:mediaError}=await admin.from("media").select("bucket,path").eq("user_id",user.id);dbCheck(mediaError);
 for(const bucket of ["originals","generated"]) {
  const paths=(media || []).filter(m=>m.bucket===bucket).map(m=>m.path);
  if(paths.length){const {error}=await admin.storage.from(bucket).remove(paths);if(error)throw new AppError("La suppression des photos a échoué. Réessaie la suppression de ton compte.",502);}
 }
 await cleanupUser(user.id,0);
 const {error}=await admin.auth.admin.deleteUser(user.id);dbCheck(error);
 await client.auth.signOut();
 // Cascading media deletion enqueues cleanup, safe to retry after auth deletion.
 await cleanupUser(user.id,0).catch(()=>{});
 return NextResponse.json({ok:true});
}catch(error){return apiError(error);}}
