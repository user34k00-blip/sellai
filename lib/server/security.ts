import "server-only";
import { createHash } from "node:crypto";
import { appUrl } from "./env";
import { AppError, dbCheck } from "./errors";
import { adminClient } from "../auth/server";
export function verifyMutation(request: Request, maxBytes = 16_384) {
  if (request.headers.get("origin") !== new URL(appUrl()).origin) throw new AppError("Cette requête n’est pas autorisée.", 403);
  const size = Number(request.headers.get("content-length") || 0);
  if (size > maxBytes) throw new AppError("Le contenu envoyé est trop volumineux.", 413);
}
export async function readJson(request: Request) {
  const text = (await boundedBody(request,16_384)).toString("utf8");
  try { return JSON.parse(text); } catch { throw new AppError("Les informations envoyées sont invalides."); }
}
export async function boundedBody(request:Request,max:number) {
  if(!request.body) return Buffer.alloc(0);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  try { while(true) { const {value,done}=await reader.read(); if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new AppError("Le contenu envoyé est trop volumineux.",413);}chunks.push(value); } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function authRateLimit(identity: string) {
  const key = createHash("sha256").update(identity.trim().toLowerCase()).digest("hex");
  const { data, error } = await adminClient().rpc("consume_auth_limit", { p_key: key });
  dbCheck(error);
  if (!data) throw new AppError("Trop de tentatives. Réessaie dans 15 minutes.", 429);
}
export async function beginGeneration(userId: string, kind: "listing" | "image" | "upload", source:string|null=null) {
  const raw = Number(kind === "listing" ? process.env.DAILY_LISTING_LIMIT || 30 : kind==="image" ? process.env.DAILY_IMAGE_LIMIT || 5 : 100);
  const limit=Number.isFinite(raw)?Math.max(1,Math.min(500,Math.floor(raw))):5;
  const { data, error } = await adminClient().rpc("begin_generation", { p_user: userId, p_kind: kind, p_limit: limit, p_source:source });
  if (error?.message.includes("BUSY")) throw new AppError("Une génération est déjà en cours. Attends son résultat.", 409);
  if (error?.message.includes("LIMIT")) throw new AppError("Tu as atteint la limite de générations pour les dernières 24 heures.", 429);
  if (error?.message.includes("CREDITS")) throw new AppError("Ton solde de crédits est insuffisant.", 402);
  dbCheck(error);
  return String(data);
}
export async function finishGeneration(id: string, success: boolean) {
  const { error } = await adminClient().rpc("finish_generation", { p_job: id, p_success: success });
  dbCheck(error);
}
