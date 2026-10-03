import "server-only";
import { adminClient } from "../auth/server";
import { mediaView } from "../storage/server";
import { AppError, dbCheck } from "../server/errors";
import { defaultPreferences } from "../config";
import type { Listing, GeneratedImage, Profile } from "../schemas";
import { preferencesSchema } from "../schemas";
export async function profileFor(userId: string): Promise<Profile> {
  const { data, error } = await adminClient().from("profiles").select("*").eq("id",userId).single();
  dbCheck(error);
  return { ...data, preferences: preferencesSchema.safeParse(data.preferences).success ? preferencesSchema.parse(data.preferences) : defaultPreferences };
}
export async function listingsFor(userId: string, id?: string, offset = 0): Promise<Listing[]> {
  let query = adminClient().from("listings").select("*,media:media!listings_original_media_id_user_id_fkey(*)").eq("user_id",userId).order("created_at", { ascending: false }).range(offset,offset+23);
  if (id) query = query.eq("id",id);
  const { data, error } = await query; dbCheck(error);
  if (id && !data?.length) throw new AppError("Cette annonce est introuvable.",404);
  return (data || []).map(row => ({ ...row, media: mediaView(row.media) }));
}
export async function imagesFor(userId: string, id?: string, offset = 0): Promise<GeneratedImage[]> {
  let query = adminClient().from("generated_images").select("*,source:media!generated_images_source_media_id_user_id_fkey(*),result:media!generated_images_generated_media_id_user_id_fkey(*)").eq("user_id",userId).order("created_at",{ascending:false}).range(offset,offset+23);
  if (id) query=query.eq("id",id);
  const { data,error } = await query; dbCheck(error);
  if (id && !data?.length) throw new AppError("Cette photo est introuvable.",404);
  return (data || []).map(row => ({ ...row, source: mediaView(row.source), result: mediaView(row.result) }));
}
