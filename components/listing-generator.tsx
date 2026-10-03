"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, RefreshCw, Save, Camera, CheckCircle2, Search, ArrowUpRight, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { api, message } from "@/lib/client";
import { tones } from "@/lib/config";
import type { Listing, MarketAnalysis, Media, Preferences, SellerServices } from "@/lib/schemas";
import { ImageUploader } from "./image-uploader";
import { CopyButton, EmptyState, LoadingState } from "./ui";

function vintedLink(value: string, kind: "item" | "search") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !["vinted.fr", "www.vinted.fr"].includes(url.hostname)) return null;
    if (kind === "item" && !/^\/items\/\d+(?:-[^/]+)?\/?$/.test(url.pathname)) return null;
    if (kind === "search" && !/^\/catalog\/?$/.test(url.pathname)) return null;
    if (kind === "item") return `https://www.vinted.fr${url.pathname.replace(/\/$/, "")}`;
    return url.href;
  } catch { return null; }
}

function validPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function euros(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function MarketAdvice({ analysis }: { analysis?: MarketAnalysis }) {
  if (!analysis) return <section className="market-advice market-unverified" aria-label="Analyse du marché Vinted"><div className="market-title"><h3><Search size={17}/> Le bon prix pour ton article</h3></div><p>Régénère cette annonce pour comparer les prix actuels sur Vinted et recevoir un conseil.</p></section>;

  const comparableUrls = new Set<string>();
  const comparables = analysis.comparables.flatMap(item => {
    const url = vintedLink(item.url, "item");
    const id = url ? new URL(url).pathname.match(/^\/items\/(\d+)/)?.[1] : null;
    if (!url || !id || !validPrice(item.price) || comparableUrls.has(id)) return [];
    comparableUrls.add(id);
    return [{ ...item, url }];
  }).slice(0, 8);
  const verified = analysis.status === "verified" && comparables.length >= 3 && validPrice(analysis.recommended_price);
  const searchUrl = vintedLink(analysis.search_url, "search");
  const seenUrls = new Set(comparables.map(item => item.url));
  const sources = analysis.sources.flatMap(source => {
    const url = vintedLink(source.url, "item");
    if (!url || seenUrls.has(url)) return [];
    seenUrls.add(url);
    return [{ ...source, url }];
  }).slice(0, 5);
  const date = new Date(analysis.analyzed_at);
  const analyzedAt = Number.isNaN(date.getTime()) ? null : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
  const status = verified ? "Comparaison disponible" : analysis.status === "unavailable" ? "Analyse indisponible" : "Données insuffisantes";
  const prices = [
    { label: "Prix conseillé", value: analysis.recommended_price, primary: true },
    { label: "Pour vendre plus vite", value: analysis.quick_sale_price, primary: false },
    { label: "Prix d’annonce", value: analysis.listing_price, primary: false },
  ];
  const range = analysis.range;

  return <section className={`market-advice ${verified ? "" : "market-unverified"}`} aria-labelledby="market-advice-title">
    <div className="market-title"><h3 id="market-advice-title"><Search size={17}/> Le marché Vinted</h3><span className="badge">{status}</span></div>
    <p className="market-summary">{analysis.summary || (verified ? "Voici un conseil de prix fondé sur les annonces comparables consultées." : "Les annonces consultées ne permettent pas de conseiller un prix fiable pour cet article.")}</p>
    {verified ? <>
      <dl className="market-prices">{prices.filter(price => validPrice(price.value)).map(price => <div key={price.label} className={price.primary ? "market-price-primary" : ""}><dt>{price.label}</dt><dd>{euros(price.value!)}</dd></div>)}</dl>
      {range && validPrice(range.min) && validPrice(range.max) && range.max >= range.min ? <p className="market-range">Prix affichés observés : <strong>{euros(range.min)} – {euros(range.max)}</strong></p> : null}
    </> : <p className="market-unverified-note">Aucun prix vérifié à recommander. Tu peux consulter les annonces et relancer l’analyse avec davantage de détails.</p>}
    {comparables.length > 0 ? <div className="market-comparables"><h4>Annonces consultées</h4><ul>{comparables.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer"><span>{item.title || "Voir cette annonce Vinted"}</span><strong>{euros(item.price)}</strong><ArrowUpRight size={15} aria-hidden="true"/></a></li>)}</ul></div> : null}
    <p className="market-disclaimer">Les prix affichés sont des prix demandés, hors frais. Les prix de vente réels et les délais de vente ne sont pas connus.</p>
    {sources.length > 0 ? <div className="market-sources" aria-label="Sources supplémentaires">{sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title || "Source Vinted"}<ArrowUpRight size={13} aria-hidden="true"/></a>)}</div> : null}
    <div className="market-footer">{analyzedAt ? <time dateTime={analysis.analyzed_at}>Analyse du {analyzedAt}</time> : null}{searchUrl ? <a href={searchUrl} target="_blank" rel="noopener noreferrer">Comparer sur Vinted <ArrowUpRight size={14} aria-hidden="true"/></a> : null}</div>
  </section>;
}

const serviceOptions: { key: keyof SellerServices; label: string; emoji: string }[] = [
  { key: "fast_shipping", label: "Envoi rapide et soigné", emoji: "📦" },
  { key: "fast_response", label: "Réponses rapides aux messages", emoji: "💬" },
  { key: "filmed_shipping", label: "Préparation et envoi filmés", emoji: "🎥" },
];

export function ListingGenerator({ initialMedia = null, initialListing = null, preferences }: { initialMedia?: Media | null; initialListing?: Listing | null; preferences: Preferences }) {
  const [media, setMedia] = useState<Media | null>(initialListing?.media || initialMedia);
  const [listing, setListing] = useState<Listing | null>(initialListing);
  const [info, setInfo] = useState("");
  const [tone, setTone] = useState<typeof tones[number]>(initialListing?.tone || preferences.tone);
  const [services, setServices] = useState<SellerServices>({ fast_shipping: true, fast_response: true, filmed_shipping: true });
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false);

  async function copyForVinted() {
    if (!listing?.title.trim() || !listing.description.trim()) return;
    const content = `${listing.title.trim()}\n\n${listing.description.trim()}`;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Annonce copiée. Colle-la dans Vinted avec Ctrl+V.");
      window.open("https://www.vinted.fr/items/new", "_blank", "noopener,noreferrer");
    } catch {
      toast.error("La copie a échoué. Autorise l’accès au presse-papiers puis réessaie.");
    }
  }

  async function generate() {
    if (!media || busy || saving) return;
    setBusy(true);
    try {
      const result = await api<Listing>("/api/listings/generate", { method: "POST", body: JSON.stringify({ media_id: media.id, additional_info: info, tone, seller_services: services }) });
      setListing(result);
      setDirty(false);
      toast.success("Annonce générée et enregistrée.");
    } catch (e) { toast.error(message(e)); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!listing || saving || busy) return;
    setSaving(true);
    try {
      const result = await api<Listing>(`/api/listings/${listing.id}`, { method: "PATCH", body: JSON.stringify({ title: listing.title, description: listing.description }) });
      setListing({ ...result, market_analysis: listing.market_analysis });
      setDirty(false);
      toast.success("Annonce enregistrée.");
    } catch (e) { toast.error(message(e)); }
    finally { setSaving(false); }
  }

  return <div className="generator-layout">
    <div className="generator-input">
      <section className="panel"><div className="step-title"><span className="step-number">01</span> Ta photo produit</div><ImageUploader media={media} disabled={busy || saving} onChange={value => { setMedia(value); setListing(null); setDirty(false); }}/></section>
      <section className="panel stack">
        <div className="step-title" style={{ marginBottom: 0 }}><span className="step-number">02</span> Les détails qui comptent</div>
        <label>Informations supplémentaires <span className="field-helper">(facultatif)</span><textarea value={info} onChange={e => setInfo(e.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder="Ex. : Nike, taille M, modèle, porté deux fois, défauts éventuels..."/><p className="field-helper">La marque, le modèle, la taille et l’état aident à trouver des annonces comparables.</p></label>
        <label>Le ton de ton annonce<select value={tone} onChange={e => setTone(e.target.value as typeof tone)} disabled={busy}>{tones.map(t => <option key={t}>{t}</option>)}</select><p className="field-helper">Une description structurée avec des emojis, dans le ton que tu choisis.</p></label>
        <fieldset className="seller-services" disabled={busy}><legend>À ajouter dans la description</legend>{serviceOptions.map(option => <label className="seller-service" key={option.key}><span><span aria-hidden="true">{option.emoji}</span> {option.label}</span><input className="switch" type="checkbox" checked={services[option.key]} onChange={e => setServices({ ...services, [option.key]: e.target.checked })}/></label>)}<p className="field-helper">Décoche les services que tu ne proposes pas.</p></fieldset>
        <button className="button primary full" onClick={generate} disabled={!media || busy || saving}><Sparkles size={19}/>{busy ? "Analyse du produit et du marché..." : listing ? "Régénérer l’annonce et le prix" : "Générer mon annonce et mon prix"}</button>
      </section>
    </div>
    <section className={`panel ${!listing ? "result-empty" : ""}`}>
      {busy ? <LoadingState label="Création de l’annonce et comparaison des prix Vinted..."/> : listing ? <div className="listing-result">
        <div className="result-head"><h2>Ton annonce est prête.</h2><span className="badge"><CheckCircle2 size={14}/>{dirty ? "Modifications en cours" : "Enregistrée"}</span></div>
        <MarketAdvice analysis={listing.market_analysis}/>
        <div><div className="panel-title"><label htmlFor="listing-title">Titre de l’annonce</label><CopyButton text={listing.title} label="Copier le titre" success="Titre copié."/></div><input id="listing-title" maxLength={120} disabled={saving} value={listing.title} onChange={e => { setListing({ ...listing, title: e.target.value }); setDirty(true); }}/></div>
        <div><div className="panel-title"><label htmlFor="listing-description">Description</label><CopyButton text={listing.description} label="Copier" success="Description copiée."/></div><textarea id="listing-description" maxLength={4000} disabled={saving} value={listing.description} onChange={e => { setListing({ ...listing, description: e.target.value }); setDirty(true); }}/></div>
        <div><h3 style={{ fontSize: 16, marginBottom: 18 }}>Informations produit</h3><dl className="characteristics">{([['Catégorie', listing.category], ['Sous-catégorie', listing.subcategory], ['Couleur', listing.color], ['Matière', listing.material], ['Marque', listing.brand], ['État apparent', listing.condition], ['Style', listing.style.join(', ')]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "À renseigner"}</dd></div>)}</dl></div>
        <div className="result-actions"><button className="button primary small" onClick={copyForVinted} disabled={saving || !listing.title.trim() || !listing.description.trim()}><ClipboardPaste size={16}/>Copier pour Vinted</button><CopyButton text={`${listing.title}\n\n${listing.description}`} label="Copier tout" success="Annonce copiée."/><button className="button primary small" disabled={!dirty || saving || !listing.title.trim() || !listing.description.trim()} onClick={save}><Save size={16}/>{saving ? "Enregistrement..." : "Enregistrer"}</button><button className="button secondary small" onClick={generate} disabled={busy || saving}><RefreshCw size={16}/>Régénérer</button><Link className="button secondary small" href={`/dashboard/photo-studio?media=${listing.original_media_id}`}><Camera size={16}/>Retoucher la photo avec l’IA</Link></div>
        <p className="field-helper">Relis les informations avant publication. « Copier pour Vinted » copie le titre et la description, puis ouvre le formulaire Vinted : colle le contenu dans les champs avec Ctrl+V.</p>
      </div> : <EmptyState title="Ta prochaine annonce commence ici." description="Importe une photo pour obtenir une description avec des emojis et un conseil de prix fondé sur le marché Vinted."/>}
    </section>
  </div>;
}
