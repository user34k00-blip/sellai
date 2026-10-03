"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle,Mail,LockKeyhole,UserRound,Eye,EyeOff,CheckCircle2 } from "lucide-react";
import { api,message } from "@/lib/client";
import { toast } from "sonner";
type Mode="login"|"register"|"forgot"|"reset";
export function AuthForm({mode,configured,next="/dashboard",authError=false}:{mode:Mode;configured:boolean;next?:string;authError?:boolean}){
 const [busy,setBusy]=useState(false),[show,setShow]=useState(false),[success,setSuccess]=useState(""),router=useRouter();
 const title={login:"Heureux de te revoir.",register:"Tes ventes commencent ici.",forgot:"Un nouveau départ.",reset:"Choisis un nouveau mot de passe."}[mode];
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);try{
  const result=await api<{confirmation?:boolean;message?:string}>(`/api/auth/${mode}`,{method:"POST",body:JSON.stringify(Object.fromEntries(form))});
  if(mode==="forgot"){setSuccess(result.message||"Un lien a été envoyé.");return;}
  if(result.confirmation){setSuccess("Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.");return;}
  toast.success(mode==="reset"?"Mot de passe modifié.":mode==="register"?"Compte créé.":"Connexion réussie.");
  router.push(next.startsWith("/dashboard")&&!next.startsWith("//")?next:"/dashboard");router.refresh();
 }catch(error){toast.error(message(error));}finally{setBusy(false);}}
 return <div className="auth-form"><span className="eyebrow">TON PROCHAIN ARTICLE FAVORI À VENDRE</span><h1>{title}</h1><p>{mode==="login"?"Retrouve tes annonces et ton studio photo.":mode==="register"?"Crée ton compte et donne une nouvelle vie à tes articles.":"On s’occupe de t’aider à retrouver ton compte."}</p>
 {!configured?<div className="notice">L’application attend sa configuration Supabase. Le README explique comment activer les comptes.</div>:null}
 {authError?<div className="notice error" role="alert">Ce lien a expiré ou a déjà été utilisé. Connecte-toi ou demande un nouveau lien.</div>:null}
 {success?<div className="auth-success" role="status"><CheckCircle2 size={28}/><p>{success}</p><Link className="button secondary" href="/login">Retour à la connexion</Link></div>:<form onSubmit={submit}>
 {mode==="register"?<label>Prénom<div className="input-with-icon"><UserRound size={18}/><input name="first_name" autoComplete="given-name" required maxLength={80} placeholder="Ton prénom"/></div></label>:null}
 {mode!=="reset"?<label>Email<div className="input-with-icon"><Mail size={18}/><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="toi@exemple.fr"/></div></label>:null}
 {mode!=="forgot"?<label>{mode==="reset"?"Nouveau mot de passe":"Mot de passe"}<div className="input-with-icon"><LockKeyhole size={18}/><input name="password" type={show?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} required minLength={mode==="login"?1:10} maxLength={128} placeholder={mode==="login"?"Ton mot de passe":"10 caractères minimum"}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label={show?"Masquer le mot de passe":"Afficher le mot de passe"}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>:null}
 {mode==="login"?<Link className="forgot-link" href="/forgot-password">Mot de passe oublié ?</Link>:null}
 <button className="button primary full" disabled={busy||!configured}>{busy?<LoaderCircle size={18} className="spin"/>:null}{mode==="login"?"Se connecter":mode==="register"?"Créer mon compte":mode==="forgot"?"Envoyer le lien":"Enregistrer le mot de passe"}</button>
 </form>}
 <div className="auth-switch">{mode==="login"?<>Pas encore de compte ? <Link href="/register">Créer un compte</Link></>:mode==="register"?<>Déjà un compte ? <Link href="/login">Se connecter</Link></>:<Link href="/login">Retour à la connexion</Link>}</div>
 </div>;
}
