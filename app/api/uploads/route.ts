import { NextResponse } from "next/server";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError, AppError, dbCheck } from "@/lib/server/errors";
import { verifyMutation,boundedBody,beginGeneration,finishGeneration } from "@/lib/server/security";
import { saveMedia,cleanupUser } from "@/lib/storage/server";
import { siteConfig } from "@/lib/config";
export const runtime="nodejs";
export async function POST(request:Request) {
 let job:string|undefined;
 try {
  verifyMutation(request,siteConfig.maxUploadBytes+128_000);
  const {user}=await requireUser();
  // Storage quota includes abandoned uploads; pruning is done before checking.
  await cleanupUser(user.id);
  job=await beginGeneration(user.id,"upload");
  const bytes=await boundedBody(request,siteConfig.maxUploadBytes+128_000);
  const form=await new Response(new Uint8Array(bytes),{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData(), file=form.get("file");
  if(!(file instanceof File)) throw new AppError("Sélectionne une photo.");
  if(file.size>siteConfig.maxUploadBytes) throw new AppError("Ton image est trop volumineuse.",413);
  const media=await saveMedia(user.id,Buffer.from(await file.arrayBuffer()),file.type,"originals");
  await finishGeneration(job,true);job=undefined;
  return NextResponse.json(media,{status:201});
 }catch(error){if(job)await finishGeneration(job,false).catch(()=>{});return apiError(error);}
}
