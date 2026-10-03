import type { MetadataRoute } from "next";
export default function sitemap():MetadataRoute.Sitemap {const root=process.env.APP_URL||"http://localhost:3000";return [{url:root,changeFrequency:"monthly",priority:1},{url:`${root}/pricing`,changeFrequency:"monthly",priority:.5}];}
