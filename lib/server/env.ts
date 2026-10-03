import "server-only";
import { AppError } from "./errors";
export function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY); }
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new AppError("Le service n’est pas encore configuré. Consulte le guide d’installation.", 503);
  return value;
}
export function appUrl() {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) return configuredUrl;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}
