import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generatePhoto, PHOTO_PROMPT_VERSION } from "../lib/ai/image";
import { POST } from "../app/api/images/generate/route";
import { AppError } from "../lib/server/errors";
import type { GeneratedImage, Media } from "../lib/schemas";

const mocks = vi.hoisted(() => ({
  edit: vi.fn(), requireUser: vi.fn(), rpc: vi.fn(), verifyMutation: vi.fn(),
  beginGeneration: vi.fn(), finishGeneration: vi.fn(), ownedMedia: vi.fn(),
  readMedia: vi.fn(), saveMedia: vi.fn(), imagesFor: vi.fn(),
}));
vi.mock("../lib/ai/client", () => ({ aiClient: () => ({ images: { edit: mocks.edit } }) }));
vi.mock("../lib/auth/server", () => ({ requireUser: mocks.requireUser, adminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../lib/server/security", () => ({
  verifyMutation: mocks.verifyMutation, readJson: (request: Request) => request.json(),
  beginGeneration: mocks.beginGeneration, finishGeneration: mocks.finishGeneration,
}));
vi.mock("../lib/storage/server", () => ({ ownedMedia: mocks.ownedMedia, readMedia: mocks.readMedia, saveMedia: mocks.saveMedia }));
vi.mock("../lib/database/server", () => ({ imagesFor: mocks.imagesFor }));

const userId = "00000000-0000-4000-8000-000000000001";
const source: Media = { id: "00000000-0000-4000-8000-000000000002", bucket: "originals", path: "original.png", width: 40, height: 40, url: "/api/media/original", created_at: "2026-10-03T10:00:00Z" };
const saved: Media = { ...source, id: "00000000-0000-4000-8000-000000000003", bucket: "generated", width: 1152, height: 2048, url: "/api/media/result" };
const result: GeneratedImage = { id: "00000000-0000-4000-8000-000000000004", source_media_id: source.id, generated_media_id: saved.id, prompt_version: PHOTO_PROMPT_VERSION, source, result: saved, created_at: source.created_at };
let reference: Buffer, generated: Buffer, wrongSize: Buffer;
const completed = (bytes = generated) => ({ type: "image_edit.completed", b64_json: bytes.toString("base64") });
const partial = () => ({ type: "image_edit.partial_image", b64_json: "preview", partial_image_index: 0 });
function providerStream(events: object[]) {
  return { async *[Symbol.asyncIterator]() { for (const event of events) yield event; }, controller: new AbortController() };
}
function request(stream = true, signal?: AbortSignal) {
  return new Request("http://localhost:3000/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json", ...(stream ? { Accept: "application/x-ndjson" } : {}) }, body: JSON.stringify({ media_id: source.id }), signal });
}
type Event = { type: string; stage?: string; progress?: number | null; label?: string; result?: GeneratedImage; error?: string };
function eventsFrom(text: string): Event[] { return text.trim().split("\n").filter(Boolean).map(line => JSON.parse(line)); }

beforeAll(async () => {
  reference = await sharp({ create: { width: 40, height: 40, channels: 3, background: "gray" } }).png().toBuffer();
  generated = await sharp({ create: { width: 1152, height: 2048, channels: 3, background: "gray" } }).png().toBuffer();
  wrongSize = await sharp({ create: { width: 100, height: 100, channels: 3, background: "gray" } }).png().toBuffer();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2");
  mocks.edit.mockImplementation(async (params: { stream?: boolean }) => params.stream ? providerStream([partial(), completed()]) : { data: [{ b64_json: generated.toString("base64") }] });
  mocks.requireUser.mockResolvedValue({ user: { id: userId } });
  mocks.verifyMutation.mockImplementation(() => undefined);
  mocks.beginGeneration.mockResolvedValue("job-1");
  mocks.finishGeneration.mockResolvedValue(undefined);
  mocks.ownedMedia.mockResolvedValue(source);
  mocks.readMedia.mockResolvedValue(reference);
  mocks.saveMedia.mockResolvedValue(saved);
  mocks.rpc.mockResolvedValue({ data: result.id, error: null });
  mocks.imagesFor.mockResolvedValue([result]);
});
afterAll(() => { vi.unstubAllEnvs(); });

describe("Photo provider streaming", () => {
  it("reports provider draft events without fabricating a percentage and validates the final PNG", async () => {
    const onProgress = vi.fn();
    const bytes = await generatePhoto(reference, { onProgress });
    expect(bytes).toEqual(generated);
    expect(mocks.edit.mock.calls[0][0]).toMatchObject({ model: "gpt-image-2", stream: true, partial_images: 1, size: "1152x2048", output_format: "png", n: 1 });
    const progress = onProgress.mock.calls.map(([value]) => value);
    expect(progress).toContainEqual(expect.objectContaining({ stage: "generation", progress: null, label: expect.stringMatching(/ébauche/i) }));
    expect(progress.at(-1)).toMatchObject({ stage: "reception", progress: 75 });
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: 1152, height: 2048 });
  });

  it("accepts a completed image when the provider sends no draft", async () => {
    mocks.edit.mockResolvedValue(providerStream([completed()]));
    await expect(generatePhoto(reference, { onProgress: vi.fn() })).resolves.toEqual(generated);
  });

  it("keeps non-streaming callers compatible", async () => {
    await expect(generatePhoto(reference)).resolves.toEqual(generated);
    expect(mocks.edit.mock.calls[0][0].stream).not.toBe(true);
  });

  it("rejects an incomplete provider stream and wrong final dimensions", async () => {
    mocks.edit.mockResolvedValue(providerStream([partial()]));
    await expect(generatePhoto(reference, { onProgress: vi.fn() })).rejects.toMatchObject({ status: 502 });
    mocks.edit.mockResolvedValue(providerStream([completed(wrongSize)]));
    await expect(generatePhoto(reference, { onProgress: vi.fn() })).rejects.toMatchObject({ status: 502 });
  });

  it("forwards cancellation to the provider and never accepts an image after abort", async () => {
    const controller = new AbortController();
    mocks.edit.mockImplementation(async (_params: unknown, options: { signal: AbortSignal }) => ({
      async *[Symbol.asyncIterator]() {
        yield partial();
        controller.abort();
        options.signal.throwIfAborted();
        yield completed();
      }, controller,
    }));
    await expect(generatePhoto(reference, { onProgress: vi.fn(), signal: controller.signal })).rejects.toThrow();
    expect(mocks.edit.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });
});

describe("Photo generation HTTP route", () => {
  it("streams useful ordered stages and only emits the result after storage and persistence", async () => {
    let release!: (value: { data: string; error: null }) => void;
    mocks.rpc.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const response = await POST(request());
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    let settled = false;
    const body = response.text().then(text => { settled = true; return text; });
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("complete_image", { p_job: "job-1", p_result: saved.id, p_version: PHOTO_PROMPT_VERSION }));
    expect(settled).toBe(false);
    expect(mocks.saveMedia).toHaveBeenCalledWith(userId, generated, "image/png", "generated");
    expect(mocks.imagesFor).not.toHaveBeenCalled();
    release({ data: result.id, error: null });
    const events = eventsFrom(await body);
    const stages = events.filter(event => event.type === "progress").map(event => event.stage);
    expect(stages[0]).toBe("preparation");
    expect(stages.indexOf("generation")).toBeLessThan(stages.indexOf("reception"));
    expect(stages.indexOf("reception")).toBeLessThan(stages.indexOf("enregistrement"));
    expect(stages.at(-1)).toBe("complete");
    expect(events.at(-2)).toMatchObject({ type: "progress", stage: "complete", progress: 100 });
    expect(events.at(-1)).toEqual({ type: "result", result });
    expect(mocks.imagesFor).toHaveBeenCalledWith(userId, result.id);
    expect(mocks.finishGeneration).not.toHaveBeenCalled();
  });

  it("keeps the legacy JSON response for callers without streaming Accept", async () => {
    const response = await POST(request(false));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(result);
  });

  it.each(["provider", "storage"])("finishes the job as failed on %s failure and never announces success", async location => {
    if (location === "provider") mocks.edit.mockRejectedValue(new Error("sensitive-provider-detail"));
    else mocks.saveMedia.mockRejectedValue(new AppError("Impossible d’importer ta photo. Réessaie.", 502));
    const response = await POST(request());
    const events = eventsFrom(await response.text());
    expect(events.at(-1)).toMatchObject({ type: "error", error: expect.any(String) });
    expect(JSON.stringify(events)).not.toContain("sensitive-provider-detail");
    expect(events.some(event => event.type === "result" || event.stage === "complete")).toBe(false);
    expect(mocks.finishGeneration).toHaveBeenCalledExactlyOnceWith("job-1", false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns JSON auth errors before starting the stream or consuming a job", async () => {
    mocks.requireUser.mockRejectedValue(new AppError("Connecte-toi pour continuer.", 401));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Connecte-toi pour continuer." });
    expect(mocks.beginGeneration).not.toHaveBeenCalled();
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("points to saved history when result retrieval fails after the job is committed", async () => {
    mocks.imagesFor.mockRejectedValue(new AppError("Impossible de charger les données.", 502));
    const response = await POST(request());
    const events = eventsFrom(await response.text());
    expect(mocks.saveMedia).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("complete_image", expect.objectContaining({ p_job: "job-1", p_result: saved.id }));
    expect(mocks.finishGeneration).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "error", error: expect.stringMatching(/enregistrée.*historique.*avant de relancer/) });
    expect(events.some(event => event.type === "result" || event.stage === "complete")).toBe(false);
  });

  it("aborts the provider and releases the job when the response stream is cancelled", async () => {
    let providerReady = false;
    mocks.edit.mockImplementation(async (_params: unknown, options: { signal: AbortSignal }) => ({
      async *[Symbol.asyncIterator]() {
        yield partial();
        await new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
          providerReady = true;
        });
        yield completed();
      },
    }));
    const response = await POST(request());
    await vi.waitFor(() => expect(providerReady).toBe(true));
    await response.body!.cancel();
    await vi.waitFor(() => expect(mocks.finishGeneration).toHaveBeenCalledExactlyOnceWith("job-1", false));
    expect(mocks.saveMedia).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
