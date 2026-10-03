import { NextResponse } from "next/server";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError,dbCheck } from "@/lib/server/errors";
import { verifyMutation,readJson,beginGeneration,finishGeneration } from "@/lib/server/security";
import { generationSchema } from "@/lib/schemas";
import { ownedMedia,readMedia } from "@/lib/storage/server";
import { profileFor,listingsFor } from "@/lib/database/server";
import { generateListing } from "@/lib/ai/listing";
import { analyzeMarket } from "@/lib/ai/market";
export const runtime="nodejs", maxDuration=300;
export async function POST(request:Request) {
 let job:string|undefined;
 try {
  verifyMutation(request); const {user}=await requireUser();
  const input=generationSchema.parse(await readJson(request));
  const media=await ownedMedia(user.id,input.media_id), profile=await profileFor(user.id);
  job=await beginGeneration(user.id,"listing",media.id);
  const tone=input.tone || profile.preferences.tone;
  const listing=await generateListing(await readMedia(media),input.additional_info,{...profile.preferences,tone},input.seller_services);
  const market_analysis=await analyzeMarket(listing,input.additional_info);
  const {data,error}=await adminClient().rpc("complete_listing",{p_job:job,p_payload:{...listing,tone}});dbCheck(error);
  job=undefined;
  return NextResponse.json({...((await listingsFor(user.id,String(data)))[0]),market_analysis},{status:201,headers:{"Cache-Control":"private, no-store"}});
 }catch(error){if(job) await finishGeneration(job,false).catch(()=>{});return apiError(error);}
}
