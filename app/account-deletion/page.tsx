import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import { Navbar } from "@/components/navbar";
import { AccountDeletion } from "@/components/account-deletion";
export const dynamic="force-dynamic";
export const metadata={title:"Suppression du compte",robots:{index:false,follow:false}};
export default async function Page(){const client=await authClient(),{data:{user}}=await client.auth.getUser();if(!user)redirect("/login");return <><Navbar/><main id="main-content" className="container" style={{maxWidth:620,paddingBlock:50}}><AccountDeletion/></main></>;}
