import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots {return {rules:{userAgent:"*",allow:["/","/pricing"],disallow:["/dashboard/","/api/","/auth/","/demo","/reset-password"]},sitemap:`${process.env.APP_URL||"http://localhost:3000"}/sitemap.xml`};}
