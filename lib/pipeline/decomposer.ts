import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import type { Scene, SceneMood } from "@/lib/types"
import { getApiKeys } from "@/lib/api-config"

const SceneSchema = z.object({
  text: z.string().min(1),
  visual: z.string().min(1),
  duration: z.number().min(5).max(10),
  mood: z.enum(["calm", "tense", "upbeat", "mysterious", "dramatic", "reflective", "energetic", "somber"]),
})

const OutputSchema = z.object({
  scenes: z.array(SceneSchema).min(3).max(20),
})

const SYSTEM = `You are a senior film editor and script supervisor.

You decompose a spoken script into visual scenes for AI video generation.

Rules:
1. Each scene MUST be 8-10 seconds when spoken at a natural pace (~18-26 words). The video model can only generate up to 10 seconds per clip.
2. Output 8-16 scenes total for a ~2 minute script.
3. "text" = the exact voiceover line for that scene (verbatim from the script, you may only split sentences on natural pauses).
4. "visual" = a concrete, cinematic visual description (subject, action, setting, camera). NO character name, NO style adjectives - those are added later.
5. "duration" = integer seconds, target 10 (never exceed 10).
6. "mood" = one of: calm, tense, upbeat, mysterious, dramatic, reflective, energetic, somber.
7. Preserve the script's flow. The concatenation of all "text" fields MUST equal the original script (minus trivial whitespace).`

export async function decomposeScript(script: string): Promise<Scene[]> {
  const { openaiKey } = getApiKeys()
  if (!openaiKey) throw new Error("OpenAI API key is not set. Please add it in the setup screen.")

  const openai = createOpenAI({ apiKey: openaiKey })
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    system: SYSTEM,
    prompt: `Script:\n\n${script}`,
    schema: OutputSchema,
  })

  return object.scenes.map((s, i) => ({
    index: i,
    text: s.text.trim(),
    visual: s.visual.trim(),
    duration: Math.max(5, Math.min(10, Math.round(s.duration))),
    mood: s.mood as SceneMood,
  }))
}
