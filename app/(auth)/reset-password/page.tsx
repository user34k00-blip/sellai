import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/server/env";
export const metadata={title:"Réinitialiser le mot de passe",robots:{index:false,follow:false}};
export default function Reset(){return <AuthForm mode="reset" configured={configured()}/>;}
