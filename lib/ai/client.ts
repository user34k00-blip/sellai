import "server-only";
import OpenAI from "openai";
import { required } from "../server/env";
export function aiClient() { return new OpenAI({ apiKey: required("OPENAI_API_KEY"), timeout: 240_000, maxRetries: 0 }); }
