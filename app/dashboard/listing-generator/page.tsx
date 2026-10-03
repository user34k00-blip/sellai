import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { profileFor,listingsFor } from "@/lib/database/server";
import { ownedMedia } from "@/lib/storage/server";
import { ListingGenerator } from "@/components/listing-generator";
export const metadata={title:"Créer une annonce"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {user}=await requireUser(),params=await searchParams,profile=await profileFor(user.id);
 const listing=params.id?(await listingsFor(user.id,z.uuid().parse(params.id)))[0]:null;
 const media=params.media?await ownedMedia(user.id,z.uuid().parse(params.media)):null;
 return <div id="main-content"><div className="page-heading"><span className="eyebrow">LES BONS MOTS POUR TON ARTICLE</span><h1>Crée ton annonce avec l’IA</h1><p>Importe une photo de ton produit et laisse l’IA rédiger ton annonce.</p></div><ListingGenerator key={listing?.id||media?.id||"new"} initialMedia={media} initialListing={listing} preferences={profile.preferences}/></div>;
}
