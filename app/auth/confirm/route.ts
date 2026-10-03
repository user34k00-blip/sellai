import { NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { appUrl } from "@/lib/server/env";
import { grantRecovery } from "@/lib/auth/recovery";
export async function GET(request:Request) {
 const url=new URL(request.url), token_hash=url.searchParams.get("token_hash"), type=url.searchParams.get("type");
 if(token_hash && (type==="email" || type==="recovery")) {
  const client=await authClient(); const {data,error}=await client.auth.verifyOtp({token_hash,type});
  if(!error && data.user){if(type==="recovery")await grantRecovery(data.user.id);return NextResponse.redirect(new URL(type==="recovery" ? "/reset-password" : "/dashboard",appUrl()));}
 }
 return NextResponse.redirect(new URL("/login?auth_error=1",appUrl()));
}
