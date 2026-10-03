import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { apiError, AppError } from "@/lib/server/errors";
import { verifyMutation, readJson, authRateLimit } from "@/lib/server/security";
import { appUrl } from "@/lib/server/env";
import { prepareRecovery,consumeRecovery } from "@/lib/auth/recovery";
export const runtime="nodejs";
const emailSchema=z.email().max(254), passwordSchema=z.string().min(10).max(128);
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
 try {
  verifyMutation(request);
  const {action}=await params, client=await authClient();
  if(!["logout","reset","forgot","login","register"].includes(action))throw new AppError("Cette action n’existe pas.",404);
  const body=await readJson(request);
  if(action==="logout") { const {error}=await client.auth.signOut(); if(error) throw new AppError("Impossible de te déconnecter.",500); return NextResponse.json({ok:true}); }
  if(action==="reset") {
   const {password}=z.object({password:passwordSchema}).strict().parse(body);
   const {data:{user}}=await client.auth.getUser();
   if(!user) throw new AppError("Le lien de réinitialisation a expiré. Demande un nouveau lien.",401);
   await authRateLimit(`reset:${user.id}`);
   await consumeRecovery(user.id);
   const {error}=await client.auth.updateUser({password});
   if(error) throw new AppError("Impossible de modifier le mot de passe. Choisis un autre mot de passe.");
   return NextResponse.json({ok:true});
  }
  const email=emailSchema.parse(body.email);
  await authRateLimit(`${action}:${email}`);
  if(action==="forgot") {
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${appUrl()}/auth/callback?next=/reset-password`});
   if(error) throw new AppError("Impossible d’envoyer le lien. Réessaie dans quelques instants.",502);
   await prepareRecovery(email);
   return NextResponse.json({message:"Si ce compte existe, tu recevras un lien pour réinitialiser ton mot de passe."});
  }
  if(action==="login") {
   const password=z.string().min(1).max(128).parse(body.password);
   const {error}=await client.auth.signInWithPassword({email,password});
   if(error) throw new AppError("Email ou mot de passe incorrect, ou email non confirmé.",401);
   return NextResponse.json({ok:true});
  }
  if(action==="register") {
   const password=passwordSchema.parse(body.password), first_name=z.string().trim().min(1).max(80).parse(body.first_name);
   const {data,error}=await client.auth.signUp({email,password,options:{data:{first_name},emailRedirectTo:`${appUrl()}/auth/callback`}});
   if(error) throw new AppError("Impossible de créer ce compte. Vérifie tes informations ou essaie de te connecter.");
   return NextResponse.json({ok:true,confirmation:!data.session});
  }
  throw new AppError("Cette action n’existe pas.",404);
 } catch(error) {return apiError(error);}
}
