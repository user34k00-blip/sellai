import "server-only";
import { randomUUID } from "node:crypto";
import { adminClient } from "../auth/server";
import { AppError, dbCheck } from "../server/errors";
import { validateImage, ImageValidationError } from "./validation";
import type { Media } from "../schemas";
export const mediaView = (row: Omit<Media,"url">): Media => ({ ...row, url: `/api/media/${row.id}` });
export async function ownedMedia(userId: string, id: string) {
  const { data, error } = await adminClient().from("media").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  dbCheck(error);
  if (!data) throw new AppError("Cette photo est introuvable.", 404);
  return mediaView(data);
}
export async function readMedia(media: Media) {
  const { data, error } = await adminClient().storage.from(media.bucket).download(media.path);
  if (error || !data) throw new AppError("Impossible de charger cette photo.", 502);
  return Buffer.from(await data.arrayBuffer());
}
export async function saveMedia(userId: string, bytes: Buffer, type: string, bucket: Media["bucket"]) {
  let image;
  try { image = await validateImage(bytes, type, bucket === "generated"); } catch (e) { throw new AppError(e instanceof ImageValidationError ? e.message : "Image invalide."); }
  const client = adminClient(), id = randomUUID(), path = `${userId}/${id}.png`;
  const { error: uploadError } = await client.storage.from(bucket).upload(path, image.bytes, { contentType: "image/png", upsert: false });
  if (uploadError) throw new AppError("Impossible d’importer ta photo. Réessaie.", 502);
  const { data, error } = await client.from("media").insert({ id, user_id: userId, bucket, path, width: image.width, height: image.height }).select().single();
  if (error) {
    const { error: removeError } = await client.storage.from(bucket).remove([path]);
    if (removeError) await client.from("storage_cleanup").insert({ user_id: userId, bucket, path });
    dbCheck(error);
  }
  return mediaView(data);
}
export async function cleanupUser(userId: string, minAge = 86400) {
  const client = adminClient();
  const { error } = await client.rpc("prune_media", { p_user: userId, p_min_age_seconds: minAge });
  dbCheck(error);
  const { data: tasks, error: taskError } = await client.from("storage_cleanup").select("*").eq("user_id", userId).limit(100);
  dbCheck(taskError);
  for (const task of tasks || []) {
    const { error: removeError } = await client.storage.from(task.bucket).remove([task.path]);
    if (!removeError) await client.from("storage_cleanup").delete().eq("id", task.id);
  }
}
