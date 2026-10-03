import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError,dbCheck,AppError } from "@/lib/server/errors";
import { verifyMutation,readJson,beginGeneration,finishGeneration } from "@/lib/server/security";
import { ownedMedia,readMedia,saveMedia } from "@/lib/storage/server";
import { imagesFor } from "@/lib/database/server";
import { generatePhoto,PHOTO_PROMPT_VERSION } from "@/lib/ai/image";
import type { PhotoProgress } from "@/lib/schemas";
export const runtime="nodejs", maxDuration=300;
export async function POST(request:Request) {
 let job:string|undefined;
 try {
  verifyMutation(request); const {user}=await requireUser();
  const {media_id}=z.object({media_id:z.uuid()}).strict().parse(await readJson(request));
  const source=await ownedMedia(user.id,media_id);
  job=await beginGeneration(user.id,"image",source.id);
  const jobId=job;
  const controller=new AbortController();
  const abort=()=>controller.abort();
  request.signal.addEventListener("abort",abort,{once:true});
  if(request.signal.aborted) abort();

  async function run(onProgress?:(progress:PhotoProgress)=>void) {
   let completed=false;
   try {
    controller.signal.throwIfAborted();
    onProgress?.({stage:"preparation",label:"Préparation de ta photo et du fond studio…",progress:10});
    const bytes=await generatePhoto(await readMedia(source),{onProgress,signal:controller.signal});
    controller.signal.throwIfAborted();
    onProgress?.({stage:"enregistrement",label:"Enregistrement de ta photo dans ton historique…",progress:90});
    const result=await saveMedia(user.id,bytes,"image/png","generated");
    controller.signal.throwIfAborted();
    const {data,error}=await adminClient().rpc("complete_image",{p_job:jobId,p_result:result.id,p_version:PHOTO_PROMPT_VERSION});dbCheck(error);
    completed=true;
    const image=(await imagesFor(user.id,String(data)))[0];
    onProgress?.({stage:"complete",label:"Ta photo est prête et enregistrée.",progress:100});
    return image;
   } catch(error) {
    if(!completed) await finishGeneration(jobId,false).catch(()=>{});
    if(completed) throw new AppError("Ta photo a été enregistrée. Ouvre ton historique pour la retrouver avant de relancer une retouche.",502);
    throw error;
   } finally {
    request.signal.removeEventListener("abort",abort);
   }
  }

  // JSON remains available for clients that do not request live progress.
  job=undefined;
  if(!request.headers.get("accept")?.includes("application/x-ndjson")) {
   return NextResponse.json(await run(),{status:201,headers:{"Cache-Control":"private, no-store"}});
  }
  const encoder=new TextEncoder();
  let cancelled=false;
  const body=new ReadableStream<Uint8Array>({
   async start(stream) {
    const send=(event:object)=>{if(!cancelled)stream.enqueue(encoder.encode(JSON.stringify(event)+"\n"));};
    try {
     const image=await run(progress=>send({type:"progress",...progress}));
     send({type:"result",result:image});
    } catch(error) {
     const response=apiError(error);
     const details=await response.json();
     send({type:"error",error:details.error});
    } finally {
     if(!cancelled)stream.close();
    }
   },
   cancel(){cancelled=true;controller.abort();},
  });
  return new Response(body,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"private, no-store, no-transform","X-Accel-Buffering":"no"}});
 }catch(error){if(job)await finishGeneration(job,false).catch(()=>{});return apiError(error);}
}
