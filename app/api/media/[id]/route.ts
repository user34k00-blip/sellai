import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireUser } from "@/lib/auth/server";
import { apiError } from "@/lib/server/errors";
import { ownedMedia,readMedia } from "@/lib/storage/server";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {user}=await requireUser(), {id}=await params;
  const media=await ownedMedia(user.id,z.uuid().parse(id));
  let bytes=await readMedia(media);
  const download=new URL(request.url).searchParams.get("download")==="1";
  if(!download) bytes=await sharp(bytes).resize({width:960,height:1200,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":download ? "image/png" : "image/webp","Cache-Control":"private, max-age=60",...(download ? {"Content-Disposition":`attachment; filename="sellai-${id}.png"`} : {})}});
 }catch(error){return apiError(error);}
}
