// Pixazo client — thin orchestrator over the model adapter registry.
// See lib/pipeline/pixazo-models.ts for per-model URL / body / response shape.
//
// Flow:
//   1. Pick a model adapter based on PIXAZO_MODEL env var.
//   2. POST submit payload to the model's endpoint. Response is either a
//      direct video URL (sync) or a polling_url (async).
//   3. If async, GET the polling_url every few seconds until status is done.
//   4. Return the final video URL.
//
// Base URL is locked to gateway.pixazo.ai unless PIXAZO_ALLOW_CUSTOM_BASE=1
// because a stale env var silently breaks every clip with a 410 HTML page.

import { selectPixazoModel, type PixazoModel, type PixazoVideoInput } from "./pixazo-models"

const DEFAULT_BASE = "https://gateway.pixazo.ai"

function resolveBaseUrl(): string {
  const raw = process.env.PIXAZO_BASE_URL?.trim()
  const allow = process.env.PIXAZO_ALLOW_CUSTOM_BASE === "1"
  if (!raw) return DEFAULT_BASE
  if (allow || raw.includes("gateway.pixazo.ai")) return raw.replace(/\/+$/, "")
  console.warn(
    `[v0] Ignoring PIXAZO_BASE_URL="${raw}" — expected to contain "gateway.pixazo.ai". ` +
      `Using default ${DEFAULT_BASE}. Set PIXAZO_ALLOW_CUSTOM_BASE=1 to force.`,
  )
  return DEFAULT_BASE
}

function authHeaders(): HeadersInit {
  const key = process.env.PIXAZO_API_KEY
  if (!key) {
    throw new Error(
      "PIXAZO_API_KEY is not set. Add it in Project Settings → Vars before running the pipeline.",
    )
  }
  return {
    "content-type": "application/json",
    "cache-control": "no-cache",
    "Ocp-Apim-Subscription-Key": key,
  }
}

const FETCH_TIMEOUT_MS = Number(process.env.PIXAZO_FETCH_TIMEOUT_MS) || 1000 * 60 * 8
const POLL_INTERVAL_MS = Number(process.env.PIXAZO_POLL_INTERVAL_MS) || 3000
const POLL_TIMEOUT_MS = Number(process.env.PIXAZO_POLL_TIMEOUT_MS) || 1000 * 60 * 10

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(
        `Pixazo ${label} timed out after ${Math.round(timeoutMs / 1000)}s (no response). ` +
          `Increase PIXAZO_FETCH_TIMEOUT_MS or check Pixazo status.`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function submit(model: PixazoModel, input: PixazoVideoInput): Promise<unknown> {
  const base = resolveBaseUrl()
  const url = model.endpoint(base)
  const body = model.buildBody(input)
  const startedAt = Date.now()
  console.log(`[v0] pixazo submit model=${model.id} url=${url}`)

  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
    FETCH_TIMEOUT_MS,
    "submit",
  )

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[v0] pixazo submit <- ${res.status} in ${elapsed}s`)

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
    throw new Error(
      `Pixazo submit ${model.id} -> ${res.status} ${res.statusText}: ${snippet || "(empty body)"}`,
    )
  }

  return res.json().catch(() => ({}))
}

async function pollUntilDone(model: PixazoModel, pollingUrl: string): Promise<string> {
  const started = Date.now()
  let attempts = 0
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    attempts++

    const res = await fetchWithTimeout(
      pollingUrl,
      { method: "GET", headers: authHeaders() },
      30_000,
      "poll",
    )

    if (res.status === 404) continue // task may not be registered for a beat
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      // Don't blow up the whole clip on a transient 5xx — just keep polling.
      if (res.status >= 500) {
        console.warn(`[v0] pixazo poll transient ${res.status}: ${txt.slice(0, 120)}`)
        continue
      }
      throw new Error(`Pixazo poll ${pollingUrl} -> ${res.status}: ${txt.slice(0, 200)}`)
    }

    const json = await res.json().catch(() => ({}))
    const status = model.parseStatus(json)

    if (attempts === 1 || attempts % 5 === 0) {
      console.log(`[v0] pixazo poll #${attempts} state=${status.state}`)
    }

    if (status.state === "done") return status.videoUrl
    if (status.state === "failed") throw new Error(status.error)
    // state === "pending": keep going
  }
  throw new Error(
    `Pixazo poll timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s (${attempts} attempts)`,
  )
}

export interface GenerateVideoInput {
  prompt: string
  duration?: number
  aspectRatio?: "16:9" | "9:16" | "1:1" | string
  referenceImageUrl?: string | null
}

// Generate one video clip. The model adapter chosen by PIXAZO_MODEL decides
// the request/response shape; this function just drives submit + poll.
export async function generateVideo(input: GenerateVideoInput): Promise<string> {
  const model = selectPixazoModel()

  if (model.requiresReferenceImage && !input.referenceImageUrl) {
    throw new Error(
      `Pixazo model "${model.id}" requires a reference image. ` +
        `Make sure the character lock stage produced referenceImageUrl.`,
    )
  }

  const modelInput: PixazoVideoInput = {
    prompt: input.prompt,
    durationSeconds: Math.round(input.duration ?? 10),
    aspectRatio: input.aspectRatio ?? "16:9",
    referenceImageUrl: input.referenceImageUrl ?? null,
  }

  const json = await submit(model, modelInput)
  const submitResult = model.parseSubmit(json)

  if (submitResult.kind === "sync") return submitResult.videoUrl
  return pollUntilDone(model, submitResult.pollingUrl)
}

// Convenience for debugging / scripts — exports the currently-selected model.
export function currentPixazoModelId(): string {
  return selectPixazoModel().id
}
