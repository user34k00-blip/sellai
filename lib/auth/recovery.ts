import "server-only";
import { cookies } from "next/headers";
import { createHmac,timingSafeEqual,randomUUID } from "node:crypto";
import { adminClient } from "./server";
import { required } from "../server/env";
import { AppError,dbCheck } from "../server/errors";
function sign(value:string){return createHmac("sha256",required("SUPABASE_SERVICE_ROLE_KEY")).update(value).digest("hex");}
function pack(data:object){const value=Buffer.from(JSON.stringify(data)).toString("base64url");return `${value}.${sign(value)}`;}
function unpack(token:string|undefined):Record<string,string|number>|null {
 if(!token)return null;const [value,signature]=token.split(".");if(!value||!signature||signature.length!==64)return null;
 const actual=Buffer.from(signature,"hex"),expected=Buffer.from(sign(value),"hex");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 try{const data=JSON.parse(Buffer.from(value,"base64url").toString());return data.exp>Date.now()?data:null;}catch{return null;}
}
const options={httpOnly:true,sameSite:"lax" as const,secure:process.env.NODE_ENV==="production",path:"/",maxAge:900};
export async function prepareRecovery(email:string){(await cookies()).set("sellai_recovery_request",pack({email:email.toLowerCase(),exp:Date.now()+900000}),options);}
export async function recoveryRequestedFor(email:string){return unpack((await cookies()).get("sellai_recovery_request")?.value)?.email===email.toLowerCase();}
export async function grantRecovery(userId:string){
 const token=randomUUID(),{error}=await adminClient().from("recovery_tokens").insert({id:token,user_id:userId,expires_at:new Date(Date.now()+900000).toISOString()});dbCheck(error);
 const jar=await cookies();jar.set("sellai_recovery",pack({token,user:userId,exp:Date.now()+900000}),options);jar.delete("sellai_recovery_request");
}
export async function consumeRecovery(userId:string){
 const jar=await cookies(),data=unpack(jar.get("sellai_recovery")?.value);
 if(!data||data.user!==userId)throw new AppError("Ouvre un lien de réinitialisation valide reçu par email.",403);
 const {data:rows,error}=await adminClient().from("recovery_tokens").delete().eq("id",data.token).eq("user_id",userId).gt("expires_at",new Date().toISOString()).select("id");dbCheck(error);
 if(!rows?.length)throw new AppError("Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien.",403);
 jar.delete("sellai_recovery");
}
