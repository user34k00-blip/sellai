import sharp from "sharp";
import { siteConfig } from "../config";
export class ImageValidationError extends Error {}
export async function validateImage(bytes: Buffer, claimedType: string, generated = false) {
  if (!bytes.length || bytes.length > (generated ? 20 * 1024 * 1024 : siteConfig.maxUploadBytes)) throw new ImageValidationError("Ton image est trop volumineuse.");
  const formats: Record<string,string> = { "image/jpeg":"jpeg", "image/png":"png", "image/webp":"webp" };
  if (!formats[claimedType]) throw new ImageValidationError("Ce format d’image n’est pas accepté.");
  try {
    const pipeline = sharp(bytes, { limitInputPixels: 36_000_000, animated: false, failOn: "warning" });
    const info = await pipeline.metadata();
    if (info.format !== formats[claimedType] || !info.width || !info.height || (info.pages || 1) > 1) throw new Error("format");
    const result = await pipeline.rotate().resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    if (result.data.length > 20 * 1024 * 1024) throw new ImageValidationError("Ton image est trop volumineuse après traitement.");
    return { bytes: result.data, width: result.info.width, height: result.info.height };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("Ce fichier ne contient pas une image valide ou ses dimensions sont trop grandes.");
  }
}
