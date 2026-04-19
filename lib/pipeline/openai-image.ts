// OpenAI image generation for the character reference portrait.
// Calls the REST API directly with OPENAI_API_KEY — no AI Gateway involved.
// The generated image is uploaded to Vercel Blob so it has a stable public URL
// that Pixazo's image-to-video models can fetch.
//
// We use `gpt-image-1` by default with a fallback to `dall-e-3` because
// account access varies. Both return either a `url` or a base64 `b64_json`.

import { put } from "@vercel/blob"
import { nanoid } from "nanoid"

const ENDPOINT = "https://api.openai.com/v1/images/generations"

export interface GenerateReferenceImageInput {
  prompt: string
  aspectRatio?: "16:9" | "9:16" | "1:1" | string
}

// DALL-E 3 and gpt-image-1 have different supported sizes, so the size string
// must be computed per model. Passing a gpt-image-1 size (1536x1024) to
// dall-e-3 fails with 400 "Invalid value".
//   gpt-image-1 -> 1024x1024 | 1536x1024 | 1024x1536 | auto
//   dall-e-3    -> 1024x1024 | 1792x1024 | 1024x1792
function sizeForAspect(
  aspect: string | undefined,
  model: "gpt-image-1" | "dall-e-3" | string,
): string {
  const isDalle3 = model === "dall-e-3"
  switch (aspect) {
    case "9:16":
      return isDalle3 ? "1024x1792" : "1024x1536"
    case "1:1":
      return "1024x1024"
    case "16:9":
    default:
      return isDalle3 ? "1792x1024" : "1536x1024"
  }
}

async function callOpenAI(model: string, prompt: string, size: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.")

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
  }
  // dall-e-3 returns `url` by default; gpt-image-1 returns b64 by default.
  // We normalize by always requesting b64_json when supported.
  if (model === "gpt-image-1") {
    body.output_format = "png"
  } else {
    body.response_format = "b64_json"
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`OpenAI image ${model} -> ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>
  }
  const entry = json.data?.[0]
  if (!entry) throw new Error(`OpenAI image ${model}: empty data[]`)

  if (entry.b64_json) return Buffer.from(entry.b64_json, "base64")
  if (entry.url) {
    const r = await fetch(entry.url)
    if (!r.ok) throw new Error(`Failed to fetch OpenAI image URL: ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  }
  throw new Error(`OpenAI image ${model}: neither b64_json nor url in data[0]`)
}

export async function generateReferenceImage(
  input: GenerateReferenceImageInput,
): Promise<{ imageUrl: string }> {
  const preferredModel = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1"
  const fallbackModel = preferredModel === "gpt-image-1" ? "dall-e-3" : null

  let bytes: Buffer
  try {
    const size = sizeForAspect(input.aspectRatio, preferredModel)
    console.log(`[v0] openai-image: ${preferredModel} size=${size}`)
    bytes = await callOpenAI(preferredModel, input.prompt, size)
  } catch (err) {
    if (!fallbackModel) throw err
    const fallbackSize = sizeForAspect(input.aspectRatio, fallbackModel)
    console.warn(
      `[v0] openai-image: ${preferredModel} failed, falling back to ${fallbackModel} size=${fallbackSize}.`,
      (err as Error).message,
    )
    bytes = await callOpenAI(fallbackModel, input.prompt, fallbackSize)
  }

  const blob = await put(`s2s/${nanoid(8)}/character.png`, bytes, {
    access: "public",
    contentType: "image/png",
  })
  console.log(`[v0] openai-image: uploaded -> ${blob.url}`)
  return { imageUrl: blob.url }
}
