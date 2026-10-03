import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { imagesFor } from "@/lib/database/server";
import { apiError } from "@/lib/server/errors";
import { z } from "zod";
export async function GET(request:Request){try{const {user}=await requireUser();const offset=z.coerce.number().int().min(0).max(100000).parse(new URL(request.url).searchParams.get("offset")||0);return NextResponse.json(await imagesFor(user.id,undefined,offset),{headers:{"Cache-Control":"private, no-store"}});}catch(error){return apiError(error);}}
