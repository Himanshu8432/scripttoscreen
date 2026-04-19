"use client"

// Client-side pipeline runner: opens a POST → SSE stream, accumulates
// stage/scene/clip state into a single reducer-shaped object. EventSource
// doesn't support POST, so we fetch + parse SSE manually.

import { useCallback, useRef, useState } from "react"
import type { CharacterLock, PipelineEvent, PipelineStageId, Scene } from "@/lib/types"
import type { AppKeys } from "@/hooks/use-keys"

export interface StageState {
  id: PipelineStageId
  label: string
  status: "idle" | "running" | "done" | "error"
  message?: string
}

export interface ClipState {
  sceneIndex: number
  status: "pending" | "running" | "done" | "error"
  url?: string
  error?: string
  // Seconds this clip has been rendering on Pixazo, updated by server-side
  // heartbeat events every ~20s.
  elapsedSec?: number
}

export interface PipelineState {
  status: "idle" | "running" | "done" | "error"
  error?: string
  stages: StageState[]
  logs: { level: "info" | "warn" | "error"; message: string; at: number }[]
  scenes: Scene[]
  character?: CharacterLock
  audioUrl?: string
  clips: Record<number, ClipState>
  videoUrl?: string
  duration?: number
}

const INITIAL_STAGES: StageState[] = [
  { id: "decompose", label: "Decompose script", status: "idle" },
  { id: "character", label: "Lock character & style", status: "idle" },
  { id: "voiceover", label: "Generate voiceover", status: "idle" },
  { id: "clips", label: "Generate clips", status: "idle" },
  { id: "assemble", label: "Assemble video", status: "idle" },
  { id: "upload", label: "Upload final", status: "idle" },
]

const initialState = (): PipelineState => ({
  status: "idle",
  stages: INITIAL_STAGES.map((s) => ({ ...s })),
  logs: [],
  scenes: [],
  clips: {},
})

async function* parseSSE(res: Response) {
  if (!res.body) throw new Error("No response body")
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      try {
        yield JSON.parse(raw) as PipelineEvent
      } catch {
        // skip malformed
      }
    }
  }
}

export function useScriptPipeline() {
  const [state, setState] = useState<PipelineState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(initialState())
  }, [])

  const run = useCallback(async (script: string, voice: string, aspectRatio: string, keys?: AppKeys) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...initialState(), status: "running" })

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(keys && {
            "x-openai-key": keys.openaiKey,
            "x-pixazo-key": keys.pixazoKey,
          }),
        },
        body: JSON.stringify({ script, voice, aspectRatio }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Pipeline failed" }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      for await (const event of parseSSE(res)) {
        setState((prev) => applyEvent(prev, event))
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      setState((prev) => ({ ...prev, status: "error", error: message }))
    }
  }, [])

  return { state, run, reset }
}

function applyEvent(prev: PipelineState, e: PipelineEvent): PipelineState {
  switch (e.type) {
    case "stage": {
      const nextStatus: StageState["status"] =
        e.status === "start" ? "running" : e.status === "done" ? "done" : "error"
      const stages: StageState[] = prev.stages.map((s) =>
        s.id === e.stage ? { ...s, status: nextStatus, message: e.message ?? s.message } : s,
      )
      return { ...prev, stages }
    }
    case "log":
      return {
        ...prev,
        logs: [...prev.logs, { level: e.level, message: e.message, at: Date.now() }].slice(-200),
      }
    case "scenes": {
      const clips: Record<number, ClipState> = {}
      e.scenes.forEach((s) => {
        clips[s.index] = { sceneIndex: s.index, status: "pending" }
      })
      return { ...prev, scenes: e.scenes, clips }
    }
    case "character":
      return { ...prev, character: e.character }
    case "voiceover":
      return { ...prev, audioUrl: e.audioUrl, duration: e.totalDuration }
    case "clip": {
      const existing = prev.clips[e.sceneIndex] ?? { sceneIndex: e.sceneIndex, status: "pending" }
      const next: ClipState = {
        ...existing,
        status: e.status === "start" ? "running" : e.status === "done" ? "done" : "error",
        url: e.url ?? existing.url,
        error: e.error,
        // Reset elapsed on start so retries count from zero.
        elapsedSec: e.status === "start" ? 0 : existing.elapsedSec,
      }
      return { ...prev, clips: { ...prev.clips, [e.sceneIndex]: next } }
    }
    case "progress": {
      const existing = prev.clips[e.sceneIndex] ?? { sceneIndex: e.sceneIndex, status: "running" as const }
      return {
        ...prev,
        clips: { ...prev.clips, [e.sceneIndex]: { ...existing, elapsedSec: e.elapsedSec } },
      }
    }
    case "final":
      return { ...prev, videoUrl: e.videoUrl, duration: e.duration, status: "done" }
    case "error":
      return { ...prev, status: "error", error: e.message }
    default:
      return prev
  }
}
