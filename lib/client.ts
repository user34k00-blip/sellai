import { photoProgressSchema, type PhotoProgress, type GeneratedImage } from "./schemas";

export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(path,{...options,headers:{...(options.body instanceof FormData ? {} : {"Content-Type":"application/json"}),...options.headers},cache:"no-store"});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error || "Une erreur est survenue. Réessaie.");
  return data as T;
}
export async function downloadImage(id:string) {
  const response=await fetch(`/api/media/${id}?download=1`);
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error || "Impossible de télécharger cette image.");}
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=`sellai-${id}.png`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function message(error:unknown){return error instanceof Error?error.message:"Une erreur est survenue.";}
export async function generateImageWithProgress(
  mediaId: string,
  onProgress: (progress: PhotoProgress) => void,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const response = await fetch("/api/images/generate", {
    method:"POST", body:JSON.stringify({ media_id:mediaId }), signal, cache:"no-store",
    headers:{ "Content-Type":"application/json", Accept:"application/x-ndjson" },
  });
  if (!response.ok) {
    const data = await response.json().catch(()=>null);
    throw new Error(data?.error || "Impossible de lancer la retouche. Réessaie.");
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const result: GeneratedImage = await response.json();
    if (!validImageResult(result)) throw new Error("Le résultat de la retouche est incomplet. Réessaie.");
    onProgress({ stage:"complete", label:"Ta photo est prête et enregistrée.", progress:100 });
    return result;
  }
  if (!response.body) throw new Error("Le suivi de la retouche est indisponible. Réessaie.");
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer="",result:GeneratedImage|undefined;
  function consume(line:string) {
    if(!line.trim())return;
    let event;
    try { event=JSON.parse(line); } catch { throw new Error("Le suivi de la retouche a été interrompu. Réessaie."); }
    if(!event || typeof event !== "object")throw new Error("Le suivi de la retouche est invalide. Réessaie.");
    if(event.type === "error") throw new Error(typeof event.error === "string" ? event.error : "La retouche a échoué. Réessaie.");
    if(event.type === "progress") {
      const parsed=photoProgressSchema.safeParse(event);
      if(!parsed.success)throw new Error("Le suivi de la retouche est invalide. Réessaie.");
      onProgress(parsed.data);
    } else if(event.type === "result" && validImageResult(event.result)) {
      result=event.result;
    } else {
      throw new Error("Le résultat de la retouche est incomplet. Réessaie.");
    }
  }
  try {
    while(true) {
      signal?.throwIfAborted();
      const {value,done}=await reader.read();
      buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
      let end;
      while((end=buffer.indexOf("\n"))!==-1) {
        consume(buffer.slice(0,end));buffer=buffer.slice(end+1);
      }
      if(buffer.length>262144)throw new Error("Le suivi de la retouche est invalide. Réessaie.");
      if(done) { consume(buffer);break; }
    }
    signal?.throwIfAborted();
    if(!result)throw new Error("La connexion a été interrompue avant le résultat. Vérifie ton historique avant de réessayer.");
    return result;
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

function validImageResult(value:unknown):value is GeneratedImage {
  if(!value || typeof value!=="object")return false;
  const image=value as GeneratedImage;
  return typeof image.id === "string" && typeof image.generated_media_id === "string"
    && typeof image.source?.url === "string" && typeof image.source?.id === "string"
    && typeof image.result?.url === "string" && typeof image.result?.id === "string";
}
