"use client";
import { useTheme } from "next-themes";
import { Moon,Sun } from "lucide-react";
import { useEffect,useState } from "react";
export function ThemeToggle(){const {theme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return <button className="icon-button" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={mounted&&theme==="dark"?"Activer le thème clair":"Activer le thème sombre"}>{mounted&&theme==="dark"?<Sun size={19}/>:<Moon size={19}/>}</button>;}
