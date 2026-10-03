import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError,dbCheck } from "@/lib/server/errors";
import { verifyMutation,readJson } from "@/lib/server/security";
import { listingsFor } from "@/lib/database/server";
import { cleanupUser } from "@/lib/storage/server";
import { listingEditSchema } from "@/lib/schemas";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){try{const {user}=await requireUser();return NextResponse.json((await listingsFor(user.id,z.uuid().parse((await params).id)))[0],{headers:{"Cache-Control":"private, no-store"}});}catch(error){return apiError(error);}}
export async function PATCH(request:Request,{params}:Context){try{
 verifyMutation(request);const {user}=await requireUser(),id=z.uuid().parse((await params).id),body=listingEditSchema.parse(await readJson(request));
 await listingsFor(user.id,id);
 const {error}=await adminClient().from("listings").update(body).eq("id",id).eq("user_id",user.id);dbCheck(error);
 return NextResponse.json((await listingsFor(user.id,id))[0]);
}catch(error){return apiError(error);}}
export async function DELETE(request:Request,{params}:Context){try{
 verifyMutation(request);const {user}=await requireUser(),id=z.uuid().parse((await params).id);
 await listingsFor(user.id,id);
 const {error}=await adminClient().from("listings").delete().eq("id",id).eq("user_id",user.id);dbCheck(error);
 // Age protects recently uploaded images being used in another browser tab.
 await cleanupUser(user.id,300);
 return NextResponse.json({ok:true});
}catch(error){return apiError(error);}}
