import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function apiError(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Vérifie les informations saisies." }, { status: 400 });
  // Never log prompts, passwords, image bytes, tokens or provider error bodies.
  console.error("SellAI operation failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Impossible de terminer cette action. Réessaie dans quelques instants." }, { status: 500 });
}
export function dbCheck(error: { message?: string } | null) { if (error) throw new AppError("Impossible d’enregistrer les données. Réessaie dans quelques instants.", 500); }
