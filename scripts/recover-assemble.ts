// Recovery script: stitch existing /tmp/s2s-*/muxed-*.mp4 files into a final
// video and upload to Vercel Blob. Use this when the pipeline crashed at the
// assemble step and you don't want to re-pay for Pixazo renders.
//
// Usage:
//   pnpm tsx scripts/recover-assemble.ts /tmp/s2s-K5WwXsnK
//
// If no path is given, the script will pick the newest /tmp/s2s-* directory.

import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { put } from "@vercel/blob"
import { concatMuxedClips } from "@/lib/pipeline/assembler"
import { probeDuration } from "@/lib/ffmpeg"

async function findLatestWorkDir(): Promise<string> {
  const entries = await readdir("/tmp")
  const candidates: { path: string; mtime: number }[] = []
  for (const name of entries) {
    if (!name.startsWith("s2s-")) continue
    const full = join("/tmp", name)
    try {
      const s = await stat(full)
      if (s.isDirectory()) candidates.push({ path: full, mtime: s.mtimeMs })
    } catch {
      /* ignore */
    }
  }
  if (candidates.length === 0) {
    throw new Error("No /tmp/s2s-* work dirs found. Pass the path explicitly.")
  }
  candidates.sort((a, b) => b.mtime - a.mtime)
  return candidates[0].path
}

async function main() {
  const argPath = process.argv[2]
  const workDir = argPath ?? (await findLatestWorkDir())
  console.log(`[recover] workDir = ${workDir}`)

  const entries = await readdir(workDir)
  const muxedNames = entries
    .filter((n) => /^muxed-\d+\.mp4$/.test(n))
    .sort((a, b) => {
      const ai = Number(a.match(/muxed-(\d+)/)![1])
      const bi = Number(b.match(/muxed-(\d+)/)![1])
      return ai - bi
    })

  if (muxedNames.length === 0) {
    throw new Error(`No muxed-*.mp4 files found in ${workDir}`)
  }
  console.log(`[recover] found ${muxedNames.length} muxed clips: ${muxedNames.join(", ")}`)

  const muxed: { path: string; duration: number }[] = []
  for (const name of muxedNames) {
    const path = join(workDir, name)
    const duration = await probeDuration(path)
    muxed.push({ path, duration })
    console.log(`[recover]   ${name} -> ${duration.toFixed(2)}s`)
  }

  console.log("[recover] concatenating...")
  const { outputPath, duration } = await concatMuxedClips(muxed, workDir)
  console.log(`[recover] final.mp4 ready: ${outputPath} (${duration.toFixed(2)}s)`)

  console.log("[recover] uploading to Vercel Blob...")
  const bytes = await readFile(outputPath)
  const key = `s2s/recover-${Date.now()}/final.mp4`
  const blob = await put(key, bytes, {
    access: "public",
    contentType: "video/mp4",
  })

  console.log("")
  console.log("==============================================")
  console.log(" RECOVERED VIDEO URL:")
  console.log(` ${blob.url}`)
  console.log("==============================================")
}

main().catch((err) => {
  console.error("[recover] FAILED:", err)
  process.exit(1)
})
