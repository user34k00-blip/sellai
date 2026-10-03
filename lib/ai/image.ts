import "server-only";
import { toFile } from "openai";
import sharp from "sharp";
import { aiClient } from "./client";
import { AppError } from "../server/errors";
import type { PhotoProgress } from "../schemas";
export const PHOTO_PROMPT_VERSION = "gray-rug-v1";
export const PRODUCT_PHOTO_PROMPT = `An aesthetic professional product photo featuring the exact object from the reference photo, preserving its shape, proportions, colors, details, logos, texture, folds, and overall appearance without changing or redesigning the object in any way.

The entire background must consist of one single light-gray aesthetic textured rug/carpet, covering 100% of the image from edge to edge. The rug must be soft, premium-looking, realistic and subtly textured, with a clean light-gray tone. Only the rug and the original object must be visible — absolutely nothing else.

Use uniform, soft, neutral studio lighting with no sunlight, no sun rays, no window light, no warm lighting, no light beams, and no dramatic directional shadows. Keep the lighting consistent and natural-looking, with only very subtle realistic contact shadows underneath the object.

The camera should be positioned directly above the object in a clean overhead flat-lay composition. The rug should look exactly like a continuous full-screen surface, with no visible edges, borders, floor, walls, furniture or other background elements.

Maintain the same light-gray rug style, texture, color and lighting in every generation to create a consistent visual identity across all product photos.

Clean, minimal, realistic, high-end professional product photography, photorealistic texture, sharp details, natural proportions, 9:16 vertical aspect ratio.

Do not remove scratches, wear, stains, missing pieces or folds. Preserve readable text, labels, seams, closures, pockets, shoelaces and accessories exactly. Never beautify, repair or replace the product itself. Prioritize product fidelity over background aesthetics.`;
export async function generatePhoto(reference:Buffer, options: {
  onProgress?: (progress: PhotoProgress) => void;
  signal?: AbortSignal;
} = {}) {
  try {
    options.signal?.throwIfAborted();
    const model=process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    if (model !== "gpt-image-2") throw new AppError("Le modèle photo configuré n’est pas compatible. Utilise gpt-image-2.",503);
    const input = { model, image:await toFile(reference,"reference.png",{type:"image/png"}), prompt:PRODUCT_PHOTO_PROMPT, size:"1152x2048" as const, quality:"high" as const, output_format:"png" as const, n:1 };
    let b64: string | undefined;
    options.onProgress?.({ stage:"generation",label:"L’IA génère ta photo. Le rendu est en cours…",progress:null });
    if (options.onProgress) {
      const stream = await aiClient().images.edit({ ...input, stream:true, partial_images:1 }, { signal:options.signal });
      for await (const event of stream) {
        options.signal?.throwIfAborted();
        if (event.type === "image_edit.partial_image") {
          options.onProgress({ stage:"generation",label:"Une première ébauche est prête. L’IA termine les détails…",progress:null });
        } else if (event.type === "image_edit.completed") {
          b64 = event.b64_json;
        }
      }
    } else {
      const response = await aiClient().images.edit(input, { signal:options.signal });
      b64 = response.data?.[0]?.b64_json;
    }
    if(!b64) throw new Error("MissingImage");
    options.signal?.throwIfAborted();
    options.onProgress?.({ stage:"reception",label:"Photo reçue. Vérification du format et de la qualité…",progress:75 });
    const bytes=Buffer.from(b64,"base64");
    const meta=await sharp(bytes,{limitInputPixels:36_000_000}).metadata();
    if(meta.width !== 1152 || meta.height !== 2048) throw new Error("InvalidAspectRatio");
    return bytes;
  } catch(error) {
    if (options.signal?.aborted) throw new AppError("La génération a été interrompue. Tu peux réessayer.",499);
    if(error instanceof AppError) throw error;
    throw new AppError("Impossible de générer la photo. Réessaie dans quelques instants.",502);
  }
}
