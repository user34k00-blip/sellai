import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { imagesFor } from "@/lib/database/server";
import { ownedMedia } from "@/lib/storage/server";
import { PhotoStudio } from "@/components/photo-studio";
export const metadata={title:"Studio Photo IA"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {user}=await requireUser(),params=await searchParams;
 const image=params.id?(await imagesFor(user.id,z.uuid().parse(params.id)))[0]:null;
 const media=params.media?await ownedMedia(user.id,z.uuid().parse(params.media)):null;
 return <div id="main-content"><div className="page-heading"><span className="eyebrow">TON ARTICLE. UNE NOUVELLE PREMIÈRE IMPRESSION.</span><h1>Studio Photo IA</h1><p>Transforme ta photo produit en photo professionnelle.</p></div><PhotoStudio key={image?.id||media?.id||"new"} initialMedia={media} initialImage={image}/></div>;
}
