import { NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { appUrl } from "@/lib/server/env";
import { grantRecovery,recoveryRequestedFor } from "@/lib/auth/recovery";
export async function GET(request:Request) {
 const url=new URL(request.url), code=url.searchParams.get("code"), next=url.searchParams.get("next");
 const target=next==="/reset-password" ? "/reset-password" : "/dashboard";
 if(code) { const client=await authClient(); const {data,error}=await client.auth.exchangeCodeForSession(code); if(!error && data.user) {
  if(target==="/reset-password") { if(!data.user.email||!await recoveryRequestedFor(data.user.email))return NextResponse.redirect(new URL("/login?auth_error=1",appUrl()));await grantRecovery(data.user.id); }
  return NextResponse.redirect(new URL(target,appUrl()));
 } }
 return NextResponse.redirect(new URL("/login?auth_error=1",appUrl()));
}
