"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Download, RefreshCw, ImagePlus, SquarePen, ShieldCheck, LoaderCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { message, downloadImage, generateImageWithProgress } from "@/lib/client";
import type { Media, GeneratedImage, PhotoProgress } from "@/lib/schemas";
import { ImageUploader } from "./image-uploader";
import { BeforeAfterSlider } from "./before-after";
import { EmptyState } from "./ui";

const photoStages: { stage: PhotoProgress["stage"]; label: string }[] = [
  { stage: "preparation", label: "Préparation" },
  { stage: "generation", label: "Création de l’image" },
  { stage: "reception", label: "Réception" },
  { stage: "enregistrement", label: "Enregistrement" },
  { stage: "complete", label: "Photo prête" },
];

function PhotoLoading({ progress }: { progress: PhotoProgress }) {
  const current = photoStages.findIndex(item => item.stage === progress.stage);
  const indeterminate = progress.progress === null;
  return <div className="photo-loading">
    <div className="photo-loading-icon"><LoaderCircle className="spin" size={27} aria-hidden="true"/></div>
    <h3>Ta photo prend forme.</h3>
    <p id="photo-progress-label" className="photo-current-stage" role="status" aria-live="polite" aria-atomic="true">{progress.label}</p>
    <div className={`photo-progress-track ${indeterminate ? "indeterminate" : ""}`} role="progressbar" aria-label="Avancement des étapes de retouche" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progress ?? undefined} aria-valuetext={progress.label} aria-describedby="photo-progress-note"><div className="photo-progress-fill" style={{ width: indeterminate ? undefined : `${progress.progress}%` }}/></div>
    <p id="photo-progress-note" className="photo-progress-note">{progress.stage === "generation" ? "L’IA crée ton image. La barre reste animée pendant cette étape, puis avance dès que le rendu est reçu." : "Chaque étape se met à jour automatiquement. Garde cette page ouverte jusqu’à ce que ta photo soit prête."}</p>
    <ol className="photo-progress-steps" aria-label="Étapes de la retouche">{photoStages.map((item, index) => <li key={item.stage} className={index < current ? "done" : index === current ? "active" : ""} aria-current={index === current ? "step" : undefined}><span className="photo-stage-number" aria-hidden="true">{index < current ? <Check size={13}/> : index + 1}</span><span>{item.label}</span><span className="sr-only">{index < current ? ", terminée" : index === current ? ", en cours" : ", à venir"}</span></li>)}</ol>
  </div>;
}

export function PhotoStudio({ initialMedia = null, initialImage = null }: { initialMedia?: Media | null; initialImage?: GeneratedImage | null }) {
  const [media, setMedia] = useState<Media | null>(initialImage?.source || initialMedia);
  const [result, setResult] = useState<GeneratedImage | null>(initialImage);
  const [busy, setBusy] = useState(false), [downloading, setDownloading] = useState(false), [view, setView] = useState("pair");
  const [progress, setProgress] = useState<PhotoProgress>({ stage: "preparation", label: "Envoi de ta demande…", progress: null });
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);

  useEffect(() => () => {
    request.current += 1;
    controller.current?.abort();
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  function changeMedia(value: Media | null) {
    request.current += 1;
    controller.current?.abort();
    controller.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    setMedia(value);
    setResult(null);
    setError(null);
    setBusy(false);
    setView("pair");
  }

  async function generate() {
    if (!media || busy || controller.current) return;
    const requestId = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    setBusy(true);
    setError(null);
    setProgress({ stage: "preparation", label: "Envoi de ta demande…", progress: null });
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 285_000);
    timeout.current = timer;
    try {
      const value = await generateImageWithProgress(media.id, update => {
        if (request.current === requestId && !abort.signal.aborted) setProgress(update);
      }, abort.signal);
      if (request.current !== requestId || abort.signal.aborted) return;
      setResult(value);
      setView("pair");
      toast.success("Photo générée et enregistrée.");
    } catch (e) {
      if (request.current !== requestId) return;
      const detail = timedOut ? "Le traitement a pris trop de temps. Consulte ton historique pour vérifier si la photo a été enregistrée, puis réessaie si nécessaire." : message(e);
      setError(detail);
    } finally {
      clearTimeout(timer);
      if (request.current === requestId) {
        controller.current = null;
        timeout.current = null;
        setBusy(false);
      }
    }
  }

  async function download() {
    if (!result || downloading) return;
    setDownloading(true);
    try { await downloadImage(result.result.id); toast.success("Image téléchargée."); }
    catch (e) { toast.error(message(e)); }
    finally { setDownloading(false); }
  }

  return <div className="studio-layout">
    <div className="stack">
      <section className="panel"><div className="step-title"><span className="step-number">01</span> Ton article, tel qu’il est</div><ImageUploader media={media} disabled={busy} onChange={changeMedia}/></section>
      <section className="panel">
        <div className="panel-title"><h2>Une signature photo cohérente</h2><Sparkles size={20}/></div>
        <p style={{ fontSize: 14 }}>Tapis gris clair, lumière studio neutre et composition vue du dessus.</p>
        <div className="button-row" style={{ marginBottom: 20 }}><span className="badge">Vertical 9:16</span><span className="badge">1152 × 2048 px</span></div>
        <button className="button primary full" onClick={generate} disabled={!media || busy}><Sparkles size={19}/>{busy ? "Création de ta photo en cours..." : error ? "Réessayer la retouche" : result ? "Régénérer" : "Améliorer ma photo"}</button>
        <p className="photo-review"><ShieldCheck size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}/> La retouche vise le fond et la lumière. Vérifie les logos, coutures et défauts avant de publier : l’IA peut modifier certains détails.</p>
      </section>
    </div>
    <section className="panel studio-result">
      <div className="panel-title"><h2>{busy ? "Création en cours." : result ? "Ton article, sous un nouveau jour." : "Ton studio est prêt."}</h2><span className="badge">Studio IA</span></div>
      {error ? <div className="notice error photo-error" role="alert"><strong>La retouche n’a pas pu être terminée.</strong><p>{error}</p><div className="button-row"><button className="button secondary small" onClick={generate} disabled={!media || busy}><RefreshCw size={15}/>Réessayer</button><Link className="text-link" href="/dashboard/history">Voir mon historique</Link></div></div> : null}
      {busy ? <PhotoLoading progress={progress}/> : result ? <>
        <p className="sr-only" role="status">Ta photo est prête et enregistrée.</p>
        {error ? <p className="field-helper">Ton précédent résultat reste disponible ci-dessous.</p> : null}
        <div className="view-tabs" role="group" aria-label="Mode de comparaison"><button className={view === "pair" ? "active" : ""} aria-pressed={view === "pair"} onClick={() => setView("pair")}>Côte à côte</button><button className={view === "slider" ? "active" : ""} aria-pressed={view === "slider"} onClick={() => setView("slider")}>Comparateur</button></div>
        {view === "slider" ? <BeforeAfterSlider before={result.source.url} after={result.result.url}/> : <div className="photo-pair"><figure><img src={result.source.url} alt="Photo originale de ton produit"/><figcaption>Original</figcaption></figure><figure><img src={result.result.url} alt="Photo produit retouchée par l’IA"/><figcaption>Résultat IA · 9:16</figcaption></figure></div>}
        <p className="photo-review">Compare les détails avec l’original. La version haute qualité est conservée pour le téléchargement.</p>
        <div className="button-row"><button className="button primary" onClick={download} disabled={downloading}>{downloading ? <LoaderCircle size={18} className="spin"/> : <Download size={18}/>}Télécharger l’image</button><button className="button secondary small" onClick={generate} disabled={busy}><RefreshCw size={16}/>Régénérer</button><button className="button secondary small" onClick={() => changeMedia(null)} disabled={busy}><ImagePlus size={16}/>Nouvelle photo</button><Link className="button secondary small" href={`/dashboard/listing-generator?media=${result.result.id}`}><SquarePen size={16}/>Créer une annonce avec cette photo</Link></div>
      </> : !error ? <div style={{ paddingTop: 70 }}><EmptyState title="Un beau fond. Le même article." description="Importe ta photo, puis lance la retouche. Tu verras chaque étape avancer jusqu’à l’image finale."/></div> : null}
    </section>
  </div>;
}
