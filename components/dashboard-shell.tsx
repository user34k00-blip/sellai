"use client";
import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { LayoutDashboard,SquarePen,Camera,Layers,Settings,LogOut,LoaderCircle } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { useState } from "react";
import { api,message } from "@/lib/client";
import { toast } from "sonner";
const links=[{href:"/dashboard",label:"Dashboard",icon:LayoutDashboard},{href:"/dashboard/listing-generator",label:"Créer une annonce",icon:SquarePen},{href:"/dashboard/photo-studio",label:"Studio Photo IA",icon:Camera},{href:"/dashboard/history",label:"Mes créations",icon:Layers},{href:"/dashboard/settings",label:"Paramètres",icon:Settings}];
export function DashboardShell({name,children}:{name:string;children:React.ReactNode}){
 const path=usePathname(),router=useRouter(),[busy,setBusy]=useState(false);
 async function logout(){setBusy(true);try{await api("/api/auth/logout",{method:"POST",body:"{}"});router.push("/login");router.refresh();}catch(e){toast.error(message(e));}finally{setBusy(false);}}
 return <div className="workspace"><aside className="sidebar"><Brand/><div className="sidebar-caption">TON ESPACE CRÉATIF</div><nav aria-label="Espace utilisateur">{links.map(({href,label,icon:Icon})=><Link key={href} href={href} className={path===href?"sidebar-link active":"sidebar-link"}><Icon size={20}/>{label}</Link>)}</nav><div className="sidebar-note"><span>Une seconde vie.<br/>Une belle première impression.</span><div className="mini-mark">✦</div></div><div className="sidebar-bottom"><span className="avatar">{name.slice(0,1).toUpperCase()||"S"}</span><div><strong>{name||"Mon compte"}</strong><span>Compte personnel</span></div><button className="icon-button" onClick={logout} disabled={busy} aria-label="Se déconnecter">{busy?<LoaderCircle size={18} className="spin"/>:<LogOut size={18}/>}</button></div></aside><div className="workspace-main"><header className="workspace-header"><div className="mobile-brand"><Brand/></div><span className="header-location">Espace personnel <span>/</span> {links.find(l=>l.href===path)?.label || "Mes créations"}</span><div className="header-right"><ThemeToggle/><Link className="avatar" href="/dashboard/settings" aria-label="Ouvrir les paramètres">{name.slice(0,1).toUpperCase()||"S"}</Link></div></header><main className="dashboard-content">{children}</main></div><nav className="mobile-navigation" aria-label="Navigation mobile">{links.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-label={label} className={path===href?"active":""}><Icon size={21}/><span>{href==="/dashboard/listing-generator"?"Annonce":href==="/dashboard/photo-studio"?"Studio":href==="/dashboard/history"?"Créations":href==="/dashboard/settings"?"Compte":"Accueil"}</span></Link>)}</nav></div>;
}
