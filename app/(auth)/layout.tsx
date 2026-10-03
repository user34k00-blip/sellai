import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
export const dynamic="force-dynamic";
export default function AuthLayout({children}:{children:React.ReactNode}){return <div className="auth-page"><header><Brand/><ThemeToggle/></header><main id="main-content" className="auth-layout"><aside className="auth-story"><span className="eyebrow">UN NOUVEAU REGARD SUR TES ARTICLES</span><h2>La seconde main.<br/>La première impression.</h2><Image src="/demo-v2.webp" alt="Illustration de présentation d’un sweat vert avant et après retouche" width={1330} height={1182} sizes="45vw"/><p>Une photo, les bons mots, une annonce prête à partager.</p><small>Exemple illustratif</small></aside>{children}</main><footer><Link href="/">Retour à l’accueil</Link></footer></div>;}

