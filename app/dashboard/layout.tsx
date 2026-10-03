import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import { profileFor } from "@/lib/database/server";
import { DashboardShell } from "@/components/dashboard-shell";
export const dynamic="force-dynamic";
export const metadata={title:"Mon espace",robots:{index:false,follow:false}};
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 let name="";
 const client=await authClient(),{data:{user}}=await client.auth.getUser();if(!user)redirect("/login");
 const profile=await profileFor(user.id);if(profile.deleting)redirect("/account-deletion");name=profile.first_name;
 return <DashboardShell name={name}>{children}</DashboardShell>;
}
