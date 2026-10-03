import Link from "next/link";
import { Sparkles } from "lucide-react";
import { siteConfig } from "@/lib/config";
export function Brand(){return <Link className="brand" href="/" aria-label={`${siteConfig.name}, accueil`}><span className="brand-mark"><Sparkles size={22} strokeWidth={2.3}/></span>{siteConfig.name}<span className="brand-dot">.</span></Link>;}
