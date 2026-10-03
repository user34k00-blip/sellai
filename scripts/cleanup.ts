import { createClient } from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Charge .env.local avant d’exécuter le nettoyage.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function cleanup(){
 const {error:expiryError}=await client.from("generation_jobs").update({status:"failed",finished_at:new Date().toISOString()}).eq("status","running").lt("created_at",new Date(Date.now()-600000).toISOString());if(expiryError)throw new Error("Nettoyage des jobs impossible.");
 const {error:tokenError}=await client.from("recovery_tokens").delete().lt("expires_at",new Date().toISOString());if(tokenError)throw new Error("Nettoyage des liens impossible.");
 const {error:authError}=await client.from("auth_limits").delete().lt("window_at",new Date(Date.now()-86400000).toISOString());if(authError)throw new Error("Nettoyage des limites impossible.");
 let offset=0;while(true){const {data:users,error}=await client.from("profiles").select("id").range(offset,offset+99);if(error)throw new Error("Lecture des comptes impossible.");for(const user of users||[]){const {error}=await client.rpc("prune_media",{p_user:user.id,p_min_age_seconds:86400});if(error)throw new Error("Nettoyage des imports impossible.");}if(!users||users.length<100)break;offset+=100;}
 let removed=0;const {data:tasks,error}=await client.from("storage_cleanup").select("*").limit(1000);if(error)throw new Error("Lecture du nettoyage impossible.");
 for(const task of tasks||[]){const {error}=await client.storage.from(task.bucket).remove([task.path]);if(!error){await client.from("storage_cleanup").delete().eq("id",task.id);removed++;}}
 console.log(`${removed} fichier(s) nettoyé(s). Les échecs restent en file d’attente.`);
}
cleanup().catch(()=>{console.error("Le nettoyage a échoué. Réessaie avec la configuration correcte.");process.exitCode=1;});
