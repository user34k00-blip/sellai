"use client";
import { useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
export function BeforeAfterSlider({before,after}:{before:string;after:string}){
 const [value,setValue]=useState(50);
 return <div className="comparison"><img src={after} alt="Photo produit retouchée"/><div className="comparison-before" style={{clipPath:`inset(0 ${100-value}% 0 0)`}}><img src={before} alt="Photo produit originale"/></div><span className="comparison-label left">Original</span><span className="comparison-label right">Résultat IA</span><div className="comparison-line" style={{left:`${value}%`}}><span><ChevronsLeftRight size={21}/></span></div><input type="range" min="0" max="100" value={value} onChange={e=>setValue(Number(e.target.value))} aria-label="Comparateur avant après" aria-valuetext={`${value} pour cent de la photo originale`} /></div>;
}
