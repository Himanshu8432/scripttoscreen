// Stage 3: Voiceover.
// ONE TTS call for the entire script — this is the spec's key insight: a
// single call gives you a uniform voice/pace across every scene. We then
// split the audio by *word-count proportion* (more accurate than using the
// scene's estimated duration) after probing the true audio length.

import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { nanoid } from "nanoid"
import type { Scene } from "@/lib/types"
import { probeDuration, runFfmpeg } from "@/lib/ffmpeg"

export interface VoiceoverResult {
  fullAudioPath: string // Local path to combined MP3
  totalDuration: number // True total duration in seconds
  sceneAudioPaths: string[] // Per-scene local MP3 slices (index-aligned with scenes)
  sceneDurations: number[] // True durations of each slice
  workDir: string // Tmp dir used (for cleanup later)
}

export async function generateVoiceover(scenes: Scene[], voice = "alloy"): Promise<VoiceoverResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.")

  const workDir = join(tmpdir(), `s2s-${nanoid(8)}`)
  await mkdir(workDir, { recursive: true })

  const fullText = scenes.map((s) => s.text).join(" \n\n ")

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice,
      input: fullText,
      response_format: "mp3",
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`OpenAI TTS failed: ${res.status} ${text.slice(0, 300)}`)
  }

  const fullAudioPath = join(workDir, "voiceover.mp3")
  await writeFile(fullAudioPath, Buffer.from(await res.arrayBuffer()))

  const totalDuration = await probeDuration(fullAudioPath)

  // Word-count proportional split (robust to TTS pacing variance).
  const wordCounts = scenes.map((s) => Math.max(1, s.text.trim().split(/\s+/).length))
  const totalWords = wordCounts.reduce((a, b) => a + b, 0)
  const durations = wordCounts.map((w) => (w / totalWords) * totalDuration)

  const sceneAudioPaths: string[] = []
  const sceneDurations: number[] = []
  let cursor = 0

  for (let i = 0; i < scenes.length; i++) {
    const start = cursor
    const dur = durations[i]
    cursor += dur
    const outPath = join(workDir, `audio-${i}.mp3`)
    await runFfmpeg([
      "-y",
      "-i",
      fullAudioPath,
      "-ss",
      start.toFixed(3),
      "-t",
      dur.toFixed(3),
      "-c",
      "copy",
      outPath,
    ])
    const actualDur = await probeDuration(outPath).catch(() => dur)
    sceneAudioPaths.push(outPath)
    sceneDurations.push(actualDur)
  }

  return { fullAudioPath, totalDuration, sceneAudioPaths, sceneDurations, workDir }
}
