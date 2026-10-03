import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata:Metadata={metadataBase:new URL(process.env.APP_URL||"http://localhost:3000"),title:{default:`${siteConfig.name} — Tes articles, sous leur meilleur jour`,template:`%s · ${siteConfig.name}`},description:siteConfig.description,icons:{icon:"/favicon.svg"},openGraph:{type:"website",locale:"fr_FR",siteName:siteConfig.name,title:`${siteConfig.name} — Assistant IA pour tes annonces`,description:siteConfig.description}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr" suppressHydrationWarning><body><Providers><a href="#main-content" className="skip-link">Aller au contenu</a>{children}</Providers></body></html>;}
