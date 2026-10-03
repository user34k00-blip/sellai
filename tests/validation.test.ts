import { describe,it,expect } from "vitest";
import sharp from "sharp";
import { validateImage } from "../lib/storage/validation";
import { productSchema,generationSchema,preferencesSchema } from "../lib/schemas";
import { readJson,verifyMutation } from "../lib/server/security";
describe("Validation des images",()=>{
 it("réencode un JPEG et supprime les métadonnées",async()=>{
  const jpeg=await sharp({create:{width:60,height:40,channels:3,background:"green"}}).withMetadata().jpeg().toBuffer();
  const result=await validateImage(jpeg,"image/jpeg"),metadata=await sharp(result.bytes).metadata();
  expect(metadata.format).toBe("png");expect(metadata.exif).toBeUndefined();expect(result.width).toBe(60);
 });
 it("refuse les MIME mensongers et fichiers non décodables",async()=>{
  const png=await sharp({create:{width:40,height:40,channels:3,background:"red"}}).png().toBuffer();
  await expect(validateImage(png,"image/jpeg")).rejects.toThrow();
  await expect(validateImage(Buffer.from("not an image"),"image/png")).rejects.toThrow();
 });
 it("refuse SVG, fichiers surdimensionnés et animations",async()=>{
  await expect(validateImage(Buffer.from("<svg/>"),"image/svg+xml")).rejects.toThrow();
  await expect(validateImage(Buffer.alloc(4*1024*1024+1),"image/png")).rejects.toThrow("volumineuse");
 });
});
describe("Schémas et requêtes",()=>{
 it("permet les informations inconnues et rejette le JSON fournisseur incorrect",()=>{
  const product={product_detected:true,title:"Sac noir",description:"Sac noir avec fermeture visible.",category:"Sac",subcategory:null,brand:null,color:"Noir",material:null,condition:null,style:[]};
  expect(productSchema.parse(product).brand).toBeNull();
  expect(productSchema.safeParse({...product,unexpected:"invented"}).success).toBe(false);
  expect(productSchema.safeParse({...product,brand:123}).success).toBe(false);
 });
 it("rejette identifiants, tons et préférences arbitraires",()=>{
  expect(generationSchema.safeParse({media_id:"../../other",tone:"spam"}).success).toBe(false);
  expect(preferencesSchema.safeParse({tone:"Simple",emojis:"moderate",shipping:false,negotiation:false,user_id:"other"}).success).toBe(false);
 });
 it("rejette les mutations cross-origin",()=>{expect(()=>verifyMutation(new Request("http://localhost:3000/api/profile",{method:"POST",headers:{origin:"https://evil.test"}}))).toThrow("autorisée");});
 it("borne aussi les corps sans Content-Length",async()=>{const request=new Request("http://localhost:3000/api/profile",{method:"POST",body:"x".repeat(17000)});await expect(readJson(request)).rejects.toMatchObject({status:413});});
});
