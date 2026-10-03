"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { LoaderCircle,Copy,Check,FolderOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
export function LoadingState({label="Chargement..."}:{label?:string}){return <div className="loading-state" role="status"><LoaderCircle className="spin" size={24}/><strong>{label}</strong><span>Tu peux laisser cette page ouverte.</span><div className="skeleton"/><div className="skeleton short"/></div>;}
export function EmptyState({title,description,children}:{title:string;description:string;children?:React.ReactNode}){return <div className="empty-state"><span className="empty-icon"><FolderOpen size={28}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;}
export function CopyButton({text,label="Copier",success="Texte copié."}:{text:string;label?:string;success?:string}){const [copied,setCopied]=useState(false);async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);toast.success(success);setTimeout(()=>setCopied(false),2000);}catch{toast.error("La copie a échoué. Sélectionne le texte pour le copier manuellement.");}}return <button className="button subtle small" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copié":label}</button>;}
export function ConfirmDialog({title="Supprimer cette création ?",description="Cette action est irréversible.",busy,onConfirm,children}:{title?:string;description?:string;busy?:boolean;onConfirm:()=>void|Promise<void>;children:React.ReactNode}){
 const [open,setOpen]=useState(false);
 return <AlertDialog.Root open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="modal-overlay"/><AlertDialog.Content className="modal"><AlertDialog.Title>{title}</AlertDialog.Title><AlertDialog.Description>{description}</AlertDialog.Description><div className="button-row"><AlertDialog.Cancel className="button secondary" disabled={busy}>Annuler</AlertDialog.Cancel><button className="button danger" disabled={busy} onClick={async()=>{await onConfirm();setOpen(false);}}>{busy?<LoaderCircle size={18} className="spin"/>:null}Supprimer</button></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
