import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/server/env";
export const metadata={title:"Mot de passe oublié"};
export default function Forgot(){return <AuthForm mode="forgot" configured={configured()}/>;}
