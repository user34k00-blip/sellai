"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu,X } from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
export function Navbar(){const [open,setOpen]=useState(false);return <header className="navbar"><div className="nav-inner"><Brand/><nav className={open?"public-nav open":"public-nav"} aria-label="Navigation principale"><Link onClick={()=>setOpen(false)} href="/">Accueil</Link><Link onClick={()=>setOpen(false)} href="/dashboard/listing-generator">Générateur d’annonce</Link><Link onClick={()=>setOpen(false)} href="/dashboard/photo-studio">Studio Photo IA</Link><Link onClick={()=>setOpen(false)} href="/dashboard/history">Historique</Link><Link onClick={()=>setOpen(false)} href="/pricing">Tarifs</Link></nav><div className="nav-actions"><ThemeToggle/><Link className="login-link" href="/login">Connexion</Link><Link className="button primary small" href="/register">Essayer gratuitement</Link><button className="icon-button mobile-menu" aria-expanded={open} aria-label={open?"Fermer le menu":"Ouvrir le menu"} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></div></header>;}
