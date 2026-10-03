import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../lib/ai/client", () => ({ aiClient: () => ({ responses: { create } }) }));
import { analyzeMarket, extractVintedEvidence, priceAnalysis, vintedItemUrl } from "../lib/ai/market";
import type { Product } from "../lib/schemas";

const product: Product = { product_detected: true, title: "Sac Mango noir", description: "Sac noir.", category: "Sacs à main", subcategory: null, brand: "Mango", color: "Noir", material: null, condition: null, style: [] };
function page(id: number, price: number | string, overrides: Record<string, unknown> = {}): string {
  const url = `https://www.vinted.fr/items/${id}-sac-mango`;
  return `<meta property="og:url" content="${url}"><meta property="og:title" content="Sac Mango | Vinted"><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Sac Mango noir", description: "Sac noir", brand: { "@type": "Brand", name: "Mango" }, category: "Femmes Sacs à main", offers: { "@type": "Offer", url, priceCurrency: "EUR", price, availability: "InStock", itemCondition: "UsedCondition" }, ...overrides })}</script>`;
}
function search(ids: number[], extra: unknown[] = []) {
  return { status: "completed", output_text: "Une annonce pourrait valoir 999 €. Ce texte ne vérifie aucun prix.", output: [{ type: "web_search_call", status: "completed", action: { type: "search", sources: ids.map(id => ({ type: "url", url: `https://www.vinted.fr/items/${id}-sac-mango` })) } }, ...extra] };
}
function htmlResponse(html: string) { return new Response(html, { headers: { "content-type": "text/html" } }); }
beforeEach(() => { create.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });
describe("Preuves et prix Vinted", () => {
  it("lit le prix article réel dans un JSON-LD Vinted sans ajouter les frais acheteur", () => {
    // Reduced JSON-LD shape observed on a publicly accessible Vinted item page.
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Sac mango croute de cuir","description":"Sac neuf jamais portée","brand":{"@type":"Brand","name":"Mango"},"offers":{"@type":"Offer","url":"https://www.vinted.fr/items/94405916-sac-mango-croute-de-cuir","priceCurrency":"EUR","price":20,"availability":"InStock","itemCondition":"NewCondition"},"category":"Femmes Sacs à main","@context":"https://schema.org"}</script><p>21,70 € Inclut la Protection acheteurs</p>`;
    expect(extractVintedEvidence(html, "https://www.vinted.fr/items/94405916-sac-mango-croute-de-cuir")).toMatchObject({ price: 20, condition: "NewCondition", title: "Sac mango croute de cuir" });
  });
  it("refuse devises absentes/étrangères, articles vendus, autres articles et prix ambigus", () => {
    const url = "https://www.vinted.fr/items/1-sac-mango";
    expect(extractVintedEvidence(page(1, 20, { offers: { price: 20, priceCurrency: "USD" } }), url)).toBeNull();
    expect(extractVintedEvidence(page(1, 20, { offers: { price: 20 } }), url)).toBeNull();
    expect(extractVintedEvidence(page(1, 20, { offers: { price: 20, priceCurrency: "EUR", availability: "SoldOut" } }), url)).toBeNull();
    expect(extractVintedEvidence(page(1, 20, { offers: { price: 20, priceCurrency: "EUR", url: "https://www.vinted.fr/items/2-autre" } }), url)).toBeNull();
    expect(extractVintedEvidence(page(1, 20, { offers: [{ price: 20, priceCurrency: "EUR" }, { price: 22, priceCurrency: "EUR" }] }), url)).toBeNull();
    expect(extractVintedEvidence('<p>Le modèle affirme que le prix est 20 €.</p>', url)).toBeNull();
  });
  it("accepte les métadonnées prix EUR explicites et la taille visible", () => {
    const html = `<meta content="Sac Mango &amp; pochette | Vinted" property="og:title"><meta property='product:price:amount' content='15,50'><meta property='product:price:currency' content='EUR'><div itemProp="size"><span>38<button>Aide</button></span></div>`;
    expect(extractVintedEvidence(html, "https://www.vinted.fr/items/3-sac")).toMatchObject({ title: "Sac Mango & pochette", price: 15.5, size: "38" });
  });
  it("n’utilise que des pages Vinted françaises, sans identifiants ni catalogue", () => {
    expect(vintedItemUrl("https://vinted.fr/items/123-sac?tracking=1")).toBe("https://www.vinted.fr/items/123-sac");
    for (const url of ["https://vinted.fr.evil.test/items/1", "https://evil.vinted.fr/items/1", "http://www.vinted.fr/items/1", "https://user:secret@www.vinted.fr/items/1", "https://www.vinted.fr/catalog?price=20", "https://www.vinted.fr:8443/items/1"]) expect(vintedItemUrl(url)).toBeNull();
  });
  it("calcule médiane et positions de prix depuis les comparables, en retirant les extrêmes et doublons", () => {
    const comparables = [10, 12, 14, 16, 18, 1000].map((price, index) => ({ title: `Sac ${index}`, price, url: `https://www.vinted.fr/items/${index + 1}-sac` }));
    comparables.push({ ...comparables[0], url: "https://www.vinted.fr/items/1-autre-slug?tracking=1" });
    const result = priceAnalysis(product, comparables);
    expect(result).toMatchObject({ status: "verified", recommended_price: 14, quick_sale_price: 12, listing_price: 16, range: { min: 10, max: 18 } });
    expect(result.comparables).toHaveLength(5);
    expect(result.summary).toContain("pas des ventes conclues");
    expect(result.sources).toHaveLength(5);
    expect(priceAnalysis(product, comparables.slice(0, 2))).toMatchObject({ status: "insufficient", recommended_price: null, range: null });
  });
});
describe("Recherche du marché sans facturation pendant les tests", () => {
  it("force une recherche, vérifie les pages originales et ignore le prix écrit par le modèle", async () => {
    create.mockResolvedValue(search([1, 2, 3]));
    const fetchMock = vi.fn(async (url: string) => htmlResponse(page(Number(url.match(/items\/(\d+)/)?.[1]), [10, 15, 20][Number(url.match(/items\/(\d+)/)?.[1]) - 1])));
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeMarket(product, "Mon numéro personnel : 0600000000, prix souhaité 900 €");
    expect(result).toMatchObject({ status: "verified", recommended_price: 15, quick_sale_price: 10, listing_price: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const request = create.mock.calls[0][0];
    expect(request.tools[0]).toMatchObject({ type: "web_search", filters: { allowed_domains: ["vinted.fr"] } });
    expect(request.tool_choice).toBe("required");
    expect(request.include).toContain("web_search_call.action.sources");
    expect(request.input).not.toContain("0600000000");
    expect(request.input).not.toContain("900");
  });
  it("reste transparent quand le fournisseur, la recherche ou la lecture échoue", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    create.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "unavailable", recommended_price: null });
    create.mockResolvedValueOnce({ status: "completed", output_text: "20 € sans recherche", output: [] });
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "unavailable", recommended_price: null });
    create.mockResolvedValueOnce(search([]));
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "insufficient", recommended_price: null });
    expect(fetchMock).not.toHaveBeenCalled();
    create.mockResolvedValueOnce(search([1, 2, 3])); fetchMock.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "unavailable", recommended_price: null });
  });
  it("refuse un prix sans preuve, les faux liens du texte et les articles non pertinents", async () => {
    create.mockResolvedValue(search([1, 2, 3, 4]));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const id = Number(url.match(/items\/(\d+)/)?.[1]);
      return htmlResponse(id === 1 ? "Prix inventé 20 €" : page(id, 20, id === 2 ? { name: "Sac Nike noir", brand: { name: "Nike" } } : id === 3 ? { name: "Baskets Mango noires", category: "Chaussures" } : {}));
    }));
    const result = await analyzeMarket(product, "");
    expect(result.status).toBe("insufficient"); expect(result.recommended_price).toBeNull(); expect(result.comparables).toHaveLength(1);
  });
  it("ne mélange pas les modèles, tailles et états connus", async () => {
    const sneakers = { ...product, title: "Nike Air Force", category: "Baskets", brand: "Nike", condition: "Neuf sans étiquette" };
    create.mockResolvedValue(search([1, 2, 3]));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const id = Number(url.match(/items\/(\d+)/)?.[1]);
      return htmlResponse(page(id, 50, { name: id === 1 ? "Nike Air Max" : "Nike Air Force", category: "Baskets", brand: { name: "Nike" }, size: id === 2 ? "40" : "38", offers: { price: 50, priceCurrency: "EUR", availability: "InStock", itemCondition: id === 3 ? "UsedCondition" : "NewCondition" } }));
    }));
    expect(await analyzeMarket(sneakers, "Taille : 38")).toMatchObject({ status: "insufficient", comparables: [], recommended_price: null });
  });
  it("compare les sweats génériques sans exiger les adjectifs de coupe dans chaque annonce", async () => {
    const sweatshirt = { ...product, title: "Sweat vert à coupe ample", category: "Sweatshirts", brand: null, color: "Vert" };
    create.mockResolvedValue(search([1, 2, 3]));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const id = Number(url.match(/items\/(\d+)/)?.[1]);
      return htmlResponse(page(id, 10 + id, { name: "Sweatshirt vert", description: "Sweat vert", category: "Hommes Sweatshirts", brand: { name: "" } }));
    }));
    expect(await analyzeMarket(sweatshirt, "")).toMatchObject({ status: "verified", recommended_price: 12 });
  });
  it("suit une redirection publique vers le bon slug du même article", async () => {
    create.mockResolvedValue(search([1, 2, 3]));
    const fetchMock = vi.fn(async (url: string) => {
      const id = Number(url.match(/items\/(\d+)/)?.[1]);
      if (id === 1 && url.endsWith("-sac-mango")) return new Response(null, { status: 301, headers: { location: "/items/1-sac-mango-correct" } });
      return htmlResponse(page(id, 10 + id));
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "verified", recommended_price: 12 });
    expect(fetchMock).toHaveBeenCalledWith("https://www.vinted.fr/items/1-sac-mango-correct", expect.objectContaining({ redirect: "manual" }));
  });
  it("borne les réponses et refuse les redirections hors de l’article autorisé", async () => {
    create.mockResolvedValue(search([1, 2, 3]));
    const fetchMock = vi.fn(async (url: string) => url.includes("/items/1-") ? new Response(null, { status: 302, headers: { location: "https://evil.test/private" } }) : htmlResponse("x".repeat(3_000_001)));
    vi.stubGlobal("fetch", fetchMock);
    expect(await analyzeMarket(product, "")).toMatchObject({ status: "unavailable", recommended_price: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith("https://www.vinted.fr/items/"))).toBe(true);
  });
});
