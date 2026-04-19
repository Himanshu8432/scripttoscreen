// The entire pipeline as a single SSE-streamed POST endpoint.
// We avoid the "background job + in-memory store" pattern entirely: the
// client holds one open connection for the full run and receives stage
// events in real time. Runs on Node (FFmpeg) with a generous max duration.

import type { NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { readFile } from "node:fs/promises"
import { nanoid } from "nanoid"
import type { PipelineEvent, PipelineRequest } from "@/lib/types"
import { decomposeScript } from "@/lib/pipeline/decomposer"
import { lockCharacter } from "@/lib/pipeline/character-lock"
import { generateVoiceover } from "@/lib/pipeline/voiceover"
import { generateClips } from "@/lib/pipeline/clips"
import { assembleVideo } from "@/lib/pipeline/assembler"

export const runtime = "nodejs"
export const maxDuration = 800 // Fluid Compute max, covers full ~3min pipeline.
export const dynamic = "force-dynamic"

function sse(event: PipelineEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as PipelineRequest
  const script = (body.script ?? "").trim()
  const voice = body.voice ?? "alloy"
  const aspectRatio = body.aspectRatio ?? "16:9"

  if (script.length < 40) {
    return new Response(JSON.stringify({ error: "Script is too short (min 40 chars)." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const send = (e: PipelineEvent) => {
        if (closed) return
        controller.enqueue(encoder.encode(sse(e)))
      }
      // SSE keepalive: send a comment line every 15s during long stages so
      // proxies/buffers don't think the stream died. Comments are ignored by
      // the EventSource-style parser on the client.
      const keepalive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"))
        } catch {
          /* stream was already closed */
        }
      }, 15_000)

      try {
        // Stage 1: Decompose
        send({ type: "stage", stage: "decompose", status: "start" })
        send({ type: "log", level: "info", message: "Breaking script into scenes..." })
        const scenes = await decomposeScript(script)
        send({ type: "scenes", scenes })
        send({
          type: "stage",
          stage: "decompose",
          status: "done",
          message: `${scenes.length} scenes`,
        })

        // Stage 2: Character + style lock
        send({ type: "stage", stage: "character", status: "start" })
        send({ type: "log", level: "info", message: "Locking character and cinematic style..." })
        const character = await lockCharacter(scenes, { aspectRatio })
        send({ type: "character", character })
        send({
          type: "stage",
          stage: "character",
          status: "done",
          message: `${character.name} / ${character.referenceImageUrl ? "with ref image" : "prompt-only"}`,
        })

        // Stage 3: Voiceover (one TTS call, then split)
        send({ type: "stage", stage: "voiceover", status: "start" })
        send({ type: "log", level: "info", message: "Generating single-take voiceover..." })
        const vo = await generateVoiceover(scenes, voice)
        // Publish audio to Blob so the UI can preview it mid-pipeline.
        const audioBytes = await readFile(vo.fullAudioPath)
        const audioBlob = await put(`s2s/${nanoid(8)}/voiceover.mp3`, audioBytes, {
          access: "public",
          contentType: "audio/mpeg",
        })
        send({ type: "voiceover", audioUrl: audioBlob.url, totalDuration: vo.totalDuration })
        send({
          type: "stage",
          stage: "voiceover",
          status: "done",
          message: `${vo.totalDuration.toFixed(1)}s`,
        })

        // Stage 4: Parallel clip generation.
        // seedance-2-0-fast is a synchronous long-running call (60s–5min per
        // clip), so we surface a periodic heartbeat to the UI log while we
        // wait — otherwise the rail looks frozen for minutes.
        send({ type: "stage", stage: "clips", status: "start" })
        send({
          type: "log",
          level: "info",
          message: `Generating ${scenes.length} clips in parallel — each takes ~2–3 min on Pixazo.`,
        })
        const clipsStartedAt = Date.now()
        const clipsHeartbeat = setInterval(() => {
          const secs = Math.round((Date.now() - clipsStartedAt) / 1000)
          const mins = Math.floor(secs / 60)
          const rem = secs % 60
          const pretty = mins > 0 ? `${mins}m ${rem}s` : `${rem}s`
          send({
            type: "log",
            level: "info",
            message: `Clips stage running for ${pretty} (per-scene timers show live progress)`,
          })
        }, 20_000)
        try {
          const { clipPaths } = await generateClips(
            scenes,
            character,
            vo.workDir,
            // Concurrency comes from PIXAZO_CONCURRENCY (default 5). Do NOT
            // hardcode here — it used to be stuck at 3.
            { maxRetries: 2, aspectRatio },
            (e) => {
              if (e.type === "start")
                send({ type: "clip", sceneIndex: e.sceneIndex, status: "start" })
              else if (e.type === "done")
                send({ type: "clip", sceneIndex: e.sceneIndex, status: "done", url: e.url })
              else if (e.type === "error")
                send({ type: "clip", sceneIndex: e.sceneIndex, status: "error", error: e.error })
              else if (e.type === "progress")
                send({ type: "progress", sceneIndex: e.sceneIndex, elapsedSec: e.elapsedSec })
            },
          )
          send({
            type: "stage",
            stage: "clips",
            status: "done",
            message: `${clipPaths.length} clips ready`,
          })

          // Continue the rest of the pipeline inside this try so we don't
          // double-declare clipPaths in the outer scope.
          // Stage 5: Assemble
          send({ type: "stage", stage: "assemble", status: "start" })
          send({ type: "log", level: "info", message: "Assembling with xfade transitions..." })
          const { outputPath, duration } = await assembleVideo(
            clipPaths,
            vo.sceneAudioPaths,
            vo.workDir,
          )
          send({ type: "stage", stage: "assemble", status: "done", message: `${duration.toFixed(1)}s` })

          // Stage 6: Upload final
          send({ type: "stage", stage: "upload", status: "start" })
          const finalBytes = await readFile(outputPath)
          const finalBlob = await put(`s2s/${nanoid(8)}/final.mp4`, finalBytes, {
            access: "public",
            contentType: "video/mp4",
          })
          send({ type: "stage", stage: "upload", status: "done" })

          send({ type: "final", videoUrl: finalBlob.url, duration })
          send({ type: "stage", stage: "done", status: "done" })
        } finally {
          clearInterval(clipsHeartbeat)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[pipeline] error:", err)
        send({ type: "error", message })
      } finally {
        clearInterval(keepalive)
        closed = true
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
