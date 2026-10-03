"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api,message } from "@/lib/client";
import { ConfirmDialog } from "./ui";
export function AccountDeletion(){const [password,setPassword]=useState(""),[busy,setBusy]=useState(false),router=useRouter();async function remove(){setBusy(true);try{await api("/api/profile",{method:"DELETE",body:JSON.stringify({password})});toast.success("Compte supprimé.");router.replace("/");router.refresh();}catch(e){toast.error(message(e));}finally{setBusy(false);}}return <section className="panel stack"><h1 style={{fontSize:28}}>Terminer la suppression de ton compte</h1><p>Une suppression interrompue peut être relancée ici. Ton compte reste bloqué jusqu’à la fin de cette opération.</p><label>Mot de passe actuel<input type="password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={128} autoComplete="current-password"/></label><ConfirmDialog title="Supprimer définitivement ton compte ?" description="Toutes tes annonces et photos seront supprimées. Cette action est irréversible." busy={busy} onConfirm={remove}><button className="button danger" disabled={!password||busy}>Terminer la suppression</button></ConfirmDialog></section>;}
