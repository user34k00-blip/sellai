import { z } from "zod";
import { tones } from "./config";
export const preferencesSchema = z.object({ tone: z.enum(tones), emojis: z.enum(["none", "moderate"]), shipping: z.boolean(), negotiation: z.boolean() }).strict();
export const productSchema = z.object({
  product_detected: z.boolean(), title: z.string().max(120), description: z.string().max(4000),
  category: z.string().max(120).nullable(), subcategory: z.string().max(120).nullable(),
  brand: z.string().max(120).nullable(), color: z.string().max(120).nullable(),
  material: z.string().max(120).nullable(), condition: z.string().max(200).nullable(),
  style: z.array(z.string().max(80)).max(8),
}).strict();
export const sellerServicesSchema = z.object({
  fast_shipping: z.boolean(), fast_response: z.boolean(), filmed_shipping: z.boolean(),
}).strict();
export const generationSchema = z.object({
  media_id: z.uuid(), additional_info: z.string().max(2000).default(""), tone: z.enum(tones).optional(),
  seller_services: sellerServicesSchema.default({ fast_shipping: true, fast_response: true, filmed_shipping: true }),
}).strict();
export const listingEditSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(4000) }).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export type SellerServices = z.infer<typeof sellerServicesSchema>;
export type Product = z.infer<typeof productSchema>;
export type MarketAnalysis = {
  status: "verified" | "insufficient" | "unavailable";
  summary: string;
  recommended_price: number | null;
  quick_sale_price: number | null;
  listing_price: number | null;
  range: { min: number; max: number } | null;
  comparables: { title: string; price: number; url: string }[];
  sources: { title: string; url: string }[];
  analyzed_at: string;
  search_url: string;
};
export const photoProgressSchema = z.object({
  stage: z.enum(["preparation", "generation", "reception", "enregistrement", "complete"]),
  label: z.string().min(1).max(300), progress: z.number().min(0).max(100).nullable(),
});
export type PhotoProgress = z.infer<typeof photoProgressSchema>;
export type Media = { id: string; bucket: "originals" | "generated"; path: string; width: number; height: number; url: string; created_at: string };
export type Listing = Product & { id: string; original_media_id: string; tone: typeof tones[number]; created_at: string; updated_at: string; media: Media; market_analysis?: MarketAnalysis };
export type GeneratedImage = { id: string; source_media_id: string; generated_media_id: string; prompt_version: string; created_at: string; source: Media; result: Media };
export type Profile = { first_name: string; preferences: Preferences; credit_balance: number | null; deleting: boolean };
