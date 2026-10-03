"use client";
import { useRef,useState,useEffect } from "react";
import { UploadCloud,ImagePlus,LoaderCircle,RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api,message } from "@/lib/client";
import { siteConfig } from "@/lib/config";
import type { Media } from "@/lib/schemas";
export function ImageUploader({media,onChange,disabled=false}:{media:Media|null;onChange:(media:Media)=>void;disabled?:boolean}){
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[dragging,setDragging]=useState(false),[preview,setPreview]=useState<string|null>(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 async function upload(file?:File){
  if(!file||busy||disabled)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast.error("Ce format d’image n’est pas accepté.");return;}
  if(file.size>siteConfig.maxUploadBytes){toast.error("Ton image est trop volumineuse.");return;}
  setPreview(URL.createObjectURL(file));setBusy(true);
  try{const form=new FormData();form.append("file",file);const result=await api<Media>("/api/uploads",{method:"POST",body:form});onChange(result);toast.success("Photo importée.");}catch(e){setPreview(null);toast.error(message(e));}finally{setBusy(false);if(input.current)input.current.value="";}
 }
 return <div className="upload-wrapper"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Importer une photo produit" disabled={busy||disabled} onChange={e=>void upload(e.target.files?.[0])}/><button type="button" disabled={busy||disabled} onClick={()=>input.current?.click()} className={`upload-zone ${dragging?"dragging":""} ${media||preview?"has-photo":""}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files[0]);}}>
 {(media||preview)?<><img src={preview||media?.url} alt="Aperçu de ton produit" className="uploaded-photo"/><span className="replace-photo">{busy?<LoaderCircle className="spin" size={18}/>:<RefreshCw size={17}/>} {busy?"Import de ta photo...":"Changer la photo"}</span></>:<><span className="upload-icon"><UploadCloud size={30}/></span><strong>Dépose ta photo ici</strong><span>ou clique pour choisir une image</span><small>JPG, PNG ou WEBP · {siteConfig.maxUploadLabel} maximum</small></>}
 </button>{busy?<p className="upload-status" role="status">Vérification et enregistrement sécurisé de la photo…</p>:<p className="upload-hint"><ImagePlus size={15}/> Un seul produit, bien visible, pour un meilleur résultat.</p>}</div>;
}
