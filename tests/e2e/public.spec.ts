import { test,expect } from "@playwright/test";
test("landing, thème persistant, tarifs et exemple copiables",async({page,context})=>{
 await context.grantPermissions(["clipboard-read","clipboard-write"]);
 await page.goto("/");await expect(page.getByRole("heading",{name:/Une photo/})).toBeVisible();
 await page.getByRole("button",{name:"Activer le thème sombre"}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
 await page.goto("/pricing");await expect(page.getByText("La facturation n’est pas activée.",{exact:false})).toBeVisible();
 await page.goto("/demo");await page.getByRole("button",{name:"Copier",exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe("Sweat vert à coupe ample");
});
test("dashboard privé protégé et absence de faux login",async({page})=>{
 await page.goto("/dashboard/photo-studio");await expect(page).toHaveURL(/\/login/);
 await expect(page.getByRole("heading",{name:"Heureux de te revoir."})).toBeVisible();
 await expect(page.getByLabel("Email",{exact:true})).toBeVisible();
 if(!process.env.SUPABASE_URL)await expect(page.getByRole("button",{name:"Se connecter",exact:true})).toBeDisabled();
});
test("menus et formulaires utilisables sur mobile sans débordement",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.getByRole("button",{name:"Ouvrir le menu"}).click();await page.getByRole("link",{name:"Tarifs",exact:true}).click();await expect(page).toHaveURL(/\/pricing/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.goto("/register");await expect(page.getByLabel("Prénom",{exact:true})).toBeVisible();await page.getByLabel("Prénom",{exact:true}).fill("Camille");await page.getByLabel("Email",{exact:true}).fill("camille@example.test");
 await page.getByRole("button",{name:"Afficher le mot de passe"}).click();await expect(page.locator("input[name=password]")).toHaveAttribute("type","text");
});
test("404 cohérente et erreurs API sans secret",async({page,request})=>{
 await page.goto("/page-inexistante");await expect(page.getByRole("heading",{name:"Oups, cette page n’existe pas."})).toBeVisible();
 const response=await request.post("/api/listings/generate",{headers:{origin:"https://evil.test"},data:{media_id:"invalid"}});expect(response.status()).toBe(403);expect(await response.json()).toEqual({error:"Cette requête n’est pas autorisée."});
});
