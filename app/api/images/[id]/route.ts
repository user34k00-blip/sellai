import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,adminClient } from "@/lib/auth/server";
import { apiError,dbCheck } from "@/lib/server/errors";
import { verifyMutation } from "@/lib/server/security";
import { imagesFor } from "@/lib/database/server";
import { cleanupUser } from "@/lib/storage/server";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){try{const {user}=await requireUser();return NextResponse.json((await imagesFor(user.id,z.uuid().parse((await params).id)))[0],{headers:{"Cache-Control":"private, no-store"}});}catch(error){return apiError(error);}}
export async function DELETE(request:Request,{params}:Context){try{
 verifyMutation(request);const {user}=await requireUser(),id=z.uuid().parse((await params).id);
 await imagesFor(user.id,id);
 const {error}=await adminClient().from("generated_images").delete().eq("id",id).eq("user_id",user.id);dbCheck(error);
 await cleanupUser(user.id,300);return NextResponse.json({ok:true});
}catch(error){return apiError(error);}}
