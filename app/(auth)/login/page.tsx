import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/server/env";
export const metadata={title:"Connexion"};
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <AuthForm mode="login" configured={configured()} next={params.next} authError={!!params.auth_error}/>;}
