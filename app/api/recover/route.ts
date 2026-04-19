import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { put } from "@vercel/blob"
import { nanoid } from "nanoid"
import { assembleVideo, concatMuxedClips } from "@/lib/pipeline/assembler"
import { probeDuration } from "@/lib/ffmpeg"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

/**
 * Recovery endpoint: stitches already-generated per-scene MP4s from a work
 * directory that was left behind by a previous pipeline run. Useful when the
 * clips stage succeeded (expensive) but the assemble stage failed (cheap).
 *
 * Usage:
 *   GET /api/recover?dir=s2s-K5WwXsnK
 *
 * `dir` is resolved inside os.tmpdir() for safety — no absolute paths, no
 * traversal. The route will auto-detect `muxed-*.mp4` (video+audio already
 * combined) or fall back to `clip-*.mp4` files in the directory.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const dirParam = url.searchParams.get("dir")
  if (!dirParam) {
    return Response.json({ error: "Missing ?dir=<workdir-name>" }, { status: 400 })
  }

  // Sanitize: no slashes, no dots — must be a single directory name inside /tmp.
  if (dirParam.includes("/") || dirParam.includes("..") || dirParam.includes("\\")) {
    return Response.json({ error: "Invalid dir name" }, { status: 400 })
  }

  const workDir = join(tmpdir(), dirParam)

  let files: string[]
  try {
    files = await readdir(workDir)
  } catch (err) {
    return Response.json(
      { error: `Cannot read ${workDir}: ${(err as Error).message}` },
      { status: 404 },
    )
  }

  // Prefer muxed-*.mp4 (each clip already has its scene audio), which is what
  // the assembler produces as an intermediate. Fall back to clip-*.mp4 +
  // scene-*.mp3 if we only have raw clips.
  const muxed = files
    .filter((f) => /^muxed-\d+\.mp4$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))
    .map((f) => join(workDir, f))

  const rawClips = files
    .filter((f) => /^clip-\d+\.mp4$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))
    .map((f) => join(workDir, f))

  const rawAudio = files
    .filter((f) => /^scene-\d+\.mp3$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))
    .map((f) => join(workDir, f))

  try {
    let outputPath: string
    let duration: number
    let sceneCount: number

    if (muxed.length > 0) {
      // Fast path: per-scene files are already muxed. Just concat them.
      console.log(`[v0] recover: concat ${muxed.length} muxed clip(s) from ${workDir}`)
      const withDur = await Promise.all(
        muxed.map(async (p) => ({ path: p, duration: await probeDuration(p) })),
      )
      const res = await concatMuxedClips(withDur, workDir)
      outputPath = res.outputPath
      duration = res.duration
      sceneCount = muxed.length
    } else if (rawClips.length > 0 && rawAudio.length === rawClips.length) {
      // Slow path: raw clips + raw audio — run the full assembler.
      console.log(`[v0] recover: full assemble ${rawClips.length} clip(s) from ${workDir}`)
      const res = await assembleVideo(rawClips, rawAudio, workDir)
      outputPath = res.outputPath
      duration = res.duration
      sceneCount = rawClips.length
    } else {
      return Response.json(
        {
          error: "No recoverable clips found",
          looking_for: ["muxed-*.mp4", "clip-*.mp4 + scene-*.mp3"],
          files_present: files,
        },
        { status: 404 },
      )
    }

    const bytes = await readFile(outputPath)
    const blob = await put(`s2s/recovered-${nanoid(8)}/final.mp4`, bytes, {
      access: "public",
      contentType: "video/mp4",
    })

    return Response.json({
      ok: true,
      videoUrl: blob.url,
      duration,
      sceneCount,
      workDir,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[v0] recover error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
