import Link from "next/link";
import { Brand } from "@/components/brand";
export default function NotFound(){return <main id="main-content" className="not-found"><Brand/><span className="huge-404">404<span>✳</span></span><h1>Oups, cette page n’existe pas.</h1><p>On dirait que tu as pris un petit détour.</p><Link className="button primary" href="/">Retour à l’accueil</Link></main>;}
