// Pixazo model adapter registry.
//
// Different Pixazo models have totally different URLs, request bodies, and
// response shapes. This file isolates those differences behind a single
// `PixazoModel` interface so the rest of the pipeline only knows "submit a
// video job, get back a URL" — swapping models is a config change.
//
// Built-in models:
//   - wan-2-6-image-to-video-477    (default, image-to-video, async polling)
//   - seedance-2-0-fast             (text-to-video, sync long-running)
//
// Select via PIXAZO_MODEL env. Register new models by appending to REGISTRY.

export type PixazoVideoInput = {
  prompt: string
  durationSeconds: number
  aspectRatio: "16:9" | "9:16" | "1:1" | string
  referenceImageUrl?: string | null
}

// What `submit` returns. Either we already have the video URL (sync models)
// or we have a polling URL / task id (async models).
export type PixazoSubmitResult =
  | { kind: "sync"; videoUrl: string }
  | { kind: "async"; pollingUrl: string }

export type PixazoStatus =
  | { state: "pending" }
  | { state: "done"; videoUrl: string }
  | { state: "failed"; error: string }

export interface PixazoModel {
  id: string
  kind: "text-to-video" | "image-to-video"
  // True = clip WILL fail without a referenceImageUrl. The pipeline handles
  // generating that image upstream.
  requiresReferenceImage: boolean
  endpoint(baseUrl: string): string
  buildBody(input: PixazoVideoInput): unknown
  parseSubmit(json: unknown): PixazoSubmitResult
  // Called repeatedly against the pollingUrl returned from parseSubmit.
  parseStatus(json: unknown): PixazoStatus
}

// -------- helpers shared by adapters ----------------------------------------

function findVideoUrlDeep(obj: unknown): string | null {
  const seen = new Set<object>()
  const visit = (node: unknown): string | null => {
    if (typeof node === "string") {
      return /^https?:\/\/\S+\.(mp4|mov|webm)(\?|$)/i.test(node.trim()) ? node.trim() : null
    }
    if (!node || typeof node !== "object" || seen.has(node as object)) return null
    seen.add(node as object)
    const preferred = [
      "video_url",
      "videoUrl",
      "video",
      "output_url",
      "output",
      "url",
      "result",
      "data",
    ]
    for (const k of preferred) {
      const hit = visit((node as Record<string, unknown>)[k])
      if (hit) return hit
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      const hit = visit(v)
      if (hit) return hit
    }
    return null
  }
  return visit(obj)
}

function clampDurationSeconds(value: number, allowed: number[]): number {
  // Pick the closest allowed value that is >= requested duration when possible.
  const sorted = [...allowed].sort((a, b) => a - b)
  const ge = sorted.find((d) => d >= value)
  if (ge !== undefined) return ge
  return sorted[sorted.length - 1]
}

// -------- wan-2-6-image-to-video-477 ---------------------------------------
// Real shape (per user):
//   POST /{model}/v1/wan-2-6-image-to-video-request
//   Body: { prompt, image_url, aspect_ratio, resolution, duration, ... }
//   Response: { request_id, status: "QUEUED", polling_url }

const WAN_2_6: PixazoModel = {
  id: "wan-2-6-image-to-video-477",
  kind: "image-to-video",
  requiresReferenceImage: true,
  endpoint: (base) => `${base}/wan-2-6-image-to-video-477/v1/wan-2-6-image-to-video-request`,
  buildBody: (input) => ({
    prompt: input.prompt,
    image_url: input.referenceImageUrl,
    aspect_ratio: input.aspectRatio,
    resolution: "1080p",
    // wan-2-6 only accepts discrete durations; 5s and 10s are the common ones.
    duration: String(clampDurationSeconds(input.durationSeconds, [5, 10])),
    enable_prompt_expansion: true,
    multi_shots: true,
    enable_safety_checker: true,
  }),
  parseSubmit: (json) => {
    const j = (json ?? {}) as Record<string, unknown>
    const pollingUrl = typeof j.polling_url === "string" ? j.polling_url : null
    if (pollingUrl) return { kind: "async", pollingUrl }
    const direct = findVideoUrlDeep(j)
    if (direct) return { kind: "sync", videoUrl: direct }
    throw new Error(
      `wan-2-6 submit returned no polling_url and no video URL: ${JSON.stringify(j).slice(0, 300)}`,
    )
  },
  parseStatus: (json) => {
    const j = (json ?? {}) as Record<string, unknown>
    const raw = String(j.status ?? "").toUpperCase()
    const videoUrl = findVideoUrlDeep(j)
    if (videoUrl || raw === "COMPLETED" || raw === "SUCCEEDED" || raw === "SUCCESS") {
      if (videoUrl) return { state: "done", videoUrl }
      return { state: "failed", error: "status=done but no video URL in payload" }
    }
    if (raw === "FAILED" || raw === "ERROR" || raw === "CANCELLED") {
      const msg = typeof j.error === "string" ? j.error : raw.toLowerCase()
      return { state: "failed", error: `wan-2-6 ${msg}` }
    }
    return { state: "pending" }
  },
}

// -------- seedance-2-0-fast (kept for fallback) ----------------------------
// Real shape:
//   POST /{model}/v1/text-to-video-fast
//   Body: { content: [{ type: "text", text: "..." }] }
//   Response: sync (long-running POST) OR async with a task_id/request_id

const SEEDANCE: PixazoModel = {
  id: "seedance-2-0-fast",
  kind: "text-to-video",
  requiresReferenceImage: false,
  endpoint: (base) => `${base}/seedance-2-0-fast/v1/text-to-video-fast`,
  buildBody: (input) => ({
    content: [{ type: "text", text: input.prompt }],
  }),
  parseSubmit: (json) => {
    const direct = findVideoUrlDeep(json)
    if (direct) return { kind: "sync", videoUrl: direct }
    const j = (json ?? {}) as Record<string, unknown>
    const pollingUrl = typeof j.polling_url === "string" ? j.polling_url : null
    if (pollingUrl) return { kind: "async", pollingUrl }
    throw new Error(
      `seedance submit returned neither a video URL nor a polling_url: ${JSON.stringify(j).slice(0, 300)}`,
    )
  },
  parseStatus: (json) => {
    const videoUrl = findVideoUrlDeep(json)
    if (videoUrl) return { state: "done", videoUrl }
    const j = (json ?? {}) as Record<string, unknown>
    const raw = String(j.status ?? "").toUpperCase()
    if (raw === "FAILED" || raw === "ERROR") {
      return { state: "failed", error: `seedance ${raw.toLowerCase()}` }
    }
    return { state: "pending" }
  },
}

// -------- registry + selection ---------------------------------------------

const REGISTRY: Record<string, PixazoModel> = {
  [WAN_2_6.id]: WAN_2_6,
  [SEEDANCE.id]: SEEDANCE,
}

const DEFAULT_MODEL_ID = WAN_2_6.id

export function selectPixazoModel(): PixazoModel {
  const configured = process.env.PIXAZO_MODEL?.trim()
  if (configured && REGISTRY[configured]) return REGISTRY[configured]
  if (configured) {
    console.warn(
      `[v0] PIXAZO_MODEL="${configured}" is not registered. Falling back to ${DEFAULT_MODEL_ID}.`,
    )
  }
  return REGISTRY[DEFAULT_MODEL_ID]
}

export function listPixazoModels(): PixazoModel[] {
  return Object.values(REGISTRY)
}
