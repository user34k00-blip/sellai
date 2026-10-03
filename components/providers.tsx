"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
export function Providers({children}:{children:React.ReactNode}){return <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}><>{children}<Toaster position="bottom-right" richColors closeButton /></></ThemeProvider>;}
