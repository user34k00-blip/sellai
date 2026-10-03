import { requireUser } from "@/lib/auth/server";
import { profileFor } from "@/lib/database/server";
import { Settings } from "@/components/settings";
export const metadata={title:"Paramètres"};
export default async function Page(){const {user}=await requireUser();return <div id="main-content"><div className="page-heading"><span className="eyebrow">UN ESPACE QUI TE RESSEMBLE</span><h1>Paramètres</h1><p>Ton profil, tes accès et ta façon de rédiger tes annonces.</p></div><Settings profile={await profileFor(user.id)} email={user.email||""}/></div>;}
