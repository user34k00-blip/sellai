import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageWithProgress } from "../lib/client";
import type { GeneratedImage, Media } from "../lib/schemas";

const source: Media = { id: "source-1", bucket: "originals", path: "original.png", width: 40, height: 40, url: "/api/media/source-1", created_at: "2026-10-03T10:00:00Z" };
const result: GeneratedImage = { id: "image-1", source_media_id: source.id, generated_media_id: "result-1", prompt_version: "gray-rug-v1", source, result: { ...source, id: "result-1", bucket: "generated", width: 1152, height: 2048, url: "/api/media/result-1" }, created_at: source.created_at };
const fetchMock = vi.fn();
const encoder = new TextEncoder();
function ndjson(lines: object[], trailing = "\n", fragment = false) {
  const bytes = encoder.encode(lines.map(line => JSON.stringify(line)).join("\r\n") + trailing);
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    if (fragment) for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    else controller.enqueue(bytes);
    controller.close();
  } }), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("Photo progress client", () => {
  it("decodes fragmented UTF-8, CRLF and the final line without a newline", async () => {
    const progress = { stage: "generation", label: "Une ébauche est prête. L’IA termine les détails… 📷", progress: null };
    fetchMock.mockResolvedValue(ndjson([{ type: "progress", ...progress }, { type: "result", result }], "", true));
    const onProgress = vi.fn(), controller = new AbortController();
    await expect(generateImageWithProgress(source.id, onProgress, controller.signal)).resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(progress);
    expect(fetchMock).toHaveBeenCalledWith("/api/images/generate", expect.objectContaining({ method: "POST", signal: controller.signal, body: JSON.stringify({ media_id: source.id }), headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" } }));
  });

  it("returns a saved image to compatible JSON clients and marks it complete", async () => {
    fetchMock.mockResolvedValue(Response.json(result, { status: 201 }));
    const onProgress = vi.fn();
    await expect(generateImageWithProgress(source.id, onProgress)).resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: "complete", progress: 100 }));
  });

  it("surfaces a streamed generation error and refuses incomplete success", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "error", error: "La génération a échoué." }]));
    await expect(generateImageWithProgress(source.id, vi.fn())).rejects.toThrow("La génération a échoué.");
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "progress", stage: "complete", label: "Enregistrée", progress: 100 }]));
    await expect(generateImageWithProgress(source.id, vi.fn())).rejects.toThrow(/avant le résultat/);
  });

  it.each([
    { type: "progress", stage: "generation", label: "En cours", progress: 101 },
    { type: "result", result: { id: "missing-media" } },
  ])("rejects invalid stream events", async event => {
    fetchMock.mockResolvedValue(ndjson([event]));
    await expect(generateImageWithProgress(source.id, vi.fn())).rejects.toThrow(/invalide|incomplet/);
  });

  it("handles JSON authorization failures before progress begins", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 }));
    const onProgress = vi.fn();
    await expect(generateImageWithProgress(source.id, onProgress)).rejects.toThrow("Connecte-toi pour continuer.");
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("cancels an interrupted stream and does not return a late result", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(ndjson([{ type: "progress", stage: "generation", label: "En cours", progress: null }, { type: "result", result }], "\n", true));
    await expect(generateImageWithProgress(source.id, () => controller.abort(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancels a corrupt stream rather than leaving the connection open", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode("not-json\n")); }, cancel }), { headers: { "Content-Type": "application/x-ndjson" } }));
    await expect(generateImageWithProgress(source.id, vi.fn())).rejects.toThrow(/interrompu/);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
