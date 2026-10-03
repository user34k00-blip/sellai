import "server-only";
import { AppError } from "./errors";
export function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY); }
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new AppError("Le service n’est pas encore configuré. Consulte le guide d’installation.", 503);
  return value;
}
export function appUrl() { return process.env.APP_URL || "http://localhost:3000"; }
