// Shared pipeline types - the contract between every stage and the UI.

export type SceneMood =
  | "calm"
  | "tense"
  | "upbeat"
  | "mysterious"
  | "dramatic"
  | "reflective"
  | "energetic"
  | "somber"

export interface Scene {
  index: number
  text: string // Voiceover line for this scene
  visual: string // Visual description (what happens on screen)
  duration: number // Target seconds (12-14)
  mood: SceneMood
}

export interface CharacterLock {
  name: string
  description: string // Locked once, reused in every clip prompt
  stylePrefix: string // Locked once, reused in every clip prompt
  referenceImageUrl: string | null // Hosted ref image from Pixazo / null if skipped
}

export type PipelineStageId =
  | "decompose"
  | "character"
  | "voiceover"
  | "clips"
  | "assemble"
  | "upload"
  | "done"

export type PipelineEvent =
  | { type: "stage"; stage: PipelineStageId; status: "start" | "done" | "error"; message?: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "scenes"; scenes: Scene[] }
  | { type: "character"; character: CharacterLock }
  | { type: "voiceover"; audioUrl: string; totalDuration: number }
  | { type: "clip"; sceneIndex: number; status: "start" | "done" | "error"; url?: string; error?: string }
  // Per-scene heartbeat fired every ~20s while a clip is still rendering, so
  // the UI can show an elapsed-time counter on each scene card instead of
  // looking frozen during the 2–3 minute wan-2-6 render.
  | { type: "progress"; sceneIndex: number; elapsedSec: number }
  | { type: "final"; videoUrl: string; duration: number }
  | { type: "error"; message: string }

export interface PipelineRequest {
  script: string
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  aspectRatio?: "16:9" | "9:16" | "1:1"
}
