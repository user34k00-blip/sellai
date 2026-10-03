export const siteConfig = {
  name: "SellAI",
  description: "Transforme tes photos en annonces Vinted et en photos produit professionnelles.",
  maxUploadBytes: 4 * 1024 * 1024,
  maxUploadLabel: "4 Mo",
  generationCosts: { listing: 1, image: 5 },
} as const;
export const tones = ["Simple", "Premium", "Streetwear", "Vintage", "Minimaliste", "Très vendeur"] as const;
export const defaultPreferences = { tone: "Simple" as typeof tones[number], emojis: "moderate" as "none" | "moderate", shipping: false, negotiation: false };
