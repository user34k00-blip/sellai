"use client";
import { Brand } from "@/components/brand";
export default function ErrorPage({reset}:{reset:()=>void}){return <main id="main-content" className="not-found"><Brand/><h1>Une erreur est survenue.</h1><p>Impossible de charger cette page. Réessaie dans quelques instants.</p><button className="button primary" onClick={reset}>Réessayer</button></main>;}
