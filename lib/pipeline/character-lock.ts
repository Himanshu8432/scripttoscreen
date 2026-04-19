// Stage 2: Character + style lock.
//
// Produces ONE locked protagonist description, ONE locked cinematic style
// prefix, and (for image-to-video models) ONE reference portrait image that
// gets passed to every Pixazo clip call. The reference image is the real
// drift-prevention mechanism when using image-to-video models like wan-2-6.
//
// LLM goes directly to OpenAI via @ai-sdk/openai (not AI Gateway).
// Reference image goes directly to OpenAI's /v1/images/generations endpoint.
//
// If the currently-selected Pixazo model is text-to-video, we skip the image
// gen entirely — the style/character lock lives in the prompt prefix instead.

import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import type { CharacterLock, Scene } from "@/lib/types"
import { generateReferenceImage } from "./openai-image"
import { selectPixazoModel } from "./pixazo-models"
import { getApiKeys } from "@/lib/api-config"

const LockSchema = z.object({
  name: z.string().min(1).describe("Short name for the protagonist"),
  description: z
    .string()
    .min(20)
    .describe(
      "Detailed, specific visual description of the protagonist: age, build, hair, skin, wardrobe, distinctive features. Used verbatim in every scene prompt.",
    ),
  stylePrefix: z
    .string()
    .min(10)
    .describe(
      "Locked cinematic style prefix: film stock, lens, color grading, lighting, mood. 10-25 words. Prepended to every clip prompt.",
    ),
  portraitPrompt: z
    .string()
    .min(20)
    .describe(
      "Image generation prompt for a single cinematic portrait of the protagonist, suitable as a reference frame for image-to-video. Should describe pose, framing, and the locked style.",
    ),
})

const SYSTEM = `You are a senior cinematographer working on a short film.
Given a set of script scenes, design:
1) ONE consistent protagonist who could plausibly appear across all scenes.
2) ONE locked cinematic style prefix (film look, lens, grading, lighting) that fits the overall mood.
3) ONE portrait prompt describing a single reference shot of the protagonist that captures both their appearance and the locked style.

Be SPECIFIC and VISUAL. The character and style must be concrete enough that an image generator produces a reliable, reusable reference frame.`

export async function lockCharacter(
  scenes: Scene[],
  opts: { aspectRatio?: "16:9" | "9:16" | "1:1" | string } = {},
): Promise<CharacterLock> {
  const sceneSummary = scenes.map((s, i) => `${i + 1}. [${s.mood}] ${s.visual}`).join("\n")
  const { openaiKey } = getApiKeys()
  const openai = createOpenAI({ apiKey: openaiKey })

  const { object: lock } = await generateObject({
    model: openai("gpt-4o-mini"),
    system: SYSTEM,
    prompt: `Scenes:\n${sceneSummary}\n\nDesign the protagonist, the locked style prefix, and the portrait prompt.`,
    schema: LockSchema,
  })

  // Only generate a reference image when the selected Pixazo model needs one.
  // Skipping it for text-to-video models saves ~5s and one OpenAI image call.
  const model = selectPixazoModel()
  let referenceImageUrl: string | null = null
  if (model.requiresReferenceImage) {
    try {
      const { imageUrl } = await generateReferenceImage({
        prompt: lock.portraitPrompt,
        aspectRatio: opts.aspectRatio ?? "16:9",
      })
      referenceImageUrl = imageUrl
    } catch (err) {
      // Fail loudly — without a reference image wan-2-6 will reject every clip.
      throw new Error(
        `Failed to generate character reference image: ${(err as Error).message}. ` +
          `Either set PIXAZO_MODEL=seedance-2-0-fast to use a text-only model, or check OPENAI_API_KEY has image gen access.`,
      )
    }
  }

  return {
    name: lock.name,
    description: lock.description,
    stylePrefix: lock.stylePrefix,
    referenceImageUrl,
  }
}

// Build a per-scene video prompt by prepending the locked character + style.
// This prompt is used for BOTH text-to-video and image-to-video models — in
// the image-to-video case it complements the reference image.
export function buildClipPrompt(scene: Scene, character: CharacterLock): string {
  return [
    character.stylePrefix,
    `Featuring ${character.name} (${character.description}).`,
    scene.visual,
    `Mood: ${scene.mood}. Duration: ${Math.round(scene.duration)}s.`,
  ].join(" ")
}
