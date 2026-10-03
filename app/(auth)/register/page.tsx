import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/server/env";
export const metadata={title:"Créer un compte"};
export default function Register(){return <AuthForm mode="register" configured={configured()}/>;}
