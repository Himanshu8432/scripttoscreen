// Stage 4: Parallel clip generation with p-limit semaphore + retry.
// Each scene becomes one Pixazo text-to-video call with the locked character
// prompt prepended. Pixazo's seedance-2-0-fast is text-only, so no image
// conditioning here — drift prevention comes from the locked text prefix.
// Progress is reported via an onProgress callback so the SSE stream can
// surface per-scene start/done/error events in real time.

import pLimit from "p-limit"
import { join } from "node:path"
import type { CharacterLock, Scene } from "@/lib/types"
import { buildClipPrompt } from "./character-lock"
import { generateVideo } from "./pixazo"
import { downloadToFile } from "@/lib/ffmpeg"

export interface ClipsResult {
  clipPaths: string[] // Local mp4 paths, index-aligned with scenes
}

export interface ClipsOptions {
  concurrency?: number
  maxRetries?: number
  aspectRatio?: string
}

type ClipEvent =
  | { type: "start"; sceneIndex: number }
  | { type: "done"; sceneIndex: number; url: string }
  | { type: "error"; sceneIndex: number; error: string }
  // Heartbeat emitted every ~20s per scene while a clip is still rendering,
  // so the UI can show a live elapsed-seconds counter per scene card.
  | { type: "progress"; sceneIndex: number; elapsedSec: number }

export async function generateClips(
  scenes: Scene[],
  character: CharacterLock,
  workDir: string,
  opts: ClipsOptions = {},
  onProgress?: (e: ClipEvent) => void,
): Promise<ClipsResult> {
  // Concurrency controls how many Pixazo clips render in parallel. Higher =
  // faster wall time, but Pixazo rate-limits per subscription — if you start
  // seeing 429s, drop this back down via PIXAZO_CONCURRENCY.
  const envConcurrency = Number(process.env.PIXAZO_CONCURRENCY ?? "")
  const concurrency =
    opts.concurrency ?? (Number.isFinite(envConcurrency) && envConcurrency > 0 ? envConcurrency : 5)
  const limit = pLimit(concurrency)
  const maxRetries = opts.maxRetries ?? 2
  console.log(`[v0] clips: generating ${scenes.length} scene(s) with concurrency=${concurrency}`)

  const tasks = scenes.map((scene) =>
    limit(async () => {
      onProgress?.({ type: "start", sceneIndex: scene.index })
      const prompt = buildClipPrompt(scene, character)

      // Per-scene elapsed-time heartbeat. Fires every 20s while this scene is
      // actively trying a Pixazo render so the UI's scene card can show a
      // live timer ("1:47") instead of just a spinning loader.
      const taskStart = Date.now()
      const heartbeat = setInterval(() => {
        const elapsedSec = Math.round((Date.now() - taskStart) / 1000)
        onProgress?.({ type: "progress", sceneIndex: scene.index, elapsedSec })
      }, 20_000)

      try {
        let lastErr: unknown = null
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const startedAt = Date.now()
          console.log(`[v0] clip ${scene.index} attempt ${attempt + 1}/${maxRetries + 1}`)
          try {
            const url = await generateVideo({
              prompt,
              duration: scene.duration,
              aspectRatio: opts.aspectRatio ?? "16:9",
              referenceImageUrl: character.referenceImageUrl,
            })
            const localPath = join(workDir, `clip-${scene.index}.mp4`)
            await downloadToFile(url, localPath)
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
            console.log(`[v0] clip ${scene.index} done in ${elapsed}s`)
            onProgress?.({ type: "done", sceneIndex: scene.index, url })
            return { index: scene.index, path: localPath }
          } catch (err) {
            lastErr = err
            const msg = err instanceof Error ? err.message : String(err)
            console.warn(`[v0] clip ${scene.index} attempt ${attempt + 1} failed: ${msg}`)
            if (attempt < maxRetries) {
              const backoff = 2000 * Math.pow(2, attempt)
              console.log(`[v0] clip ${scene.index} retrying in ${backoff}ms`)
              await new Promise((r) => setTimeout(r, backoff))
            }
          }
        }
        const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr)
        onProgress?.({ type: "error", sceneIndex: scene.index, error: errMsg })
        throw new Error(`Clip ${scene.index} failed after ${maxRetries + 1} attempts: ${errMsg}`)
      } finally {
        clearInterval(heartbeat)
      }
    }),
  )

  const results = await Promise.all(tasks)
  const clipPaths = results.sort((a, b) => a.index - b.index).map((r) => r.path)
  return { clipPaths }
}
