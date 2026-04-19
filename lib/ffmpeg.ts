// FFmpeg helpers: thin `spawn` wrappers + a ffprobe duration helper.
// Kept tiny so the pipeline stages can compose raw command lines — that's
// significantly more reliable than fluent-ffmpeg for complex xfade chains.

import { spawn } from "node:child_process"
import ffmpegPath from "@ffmpeg-installer/ffmpeg"

export const FFMPEG_BIN = ffmpegPath.path

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stderr = ""
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1500)}`))
    })
  })
}

export function runFfmpegCapture(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (c) => {
      stdout += c.toString()
    })
    proc.stderr.on("data", (c) => {
      stderr += c.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1500)}`))
    })
  })
}

// Use ffmpeg (not ffprobe) to read duration — @ffmpeg-installer only ships ffmpeg.
// We parse stderr for "Duration: HH:MM:SS.xx".
export async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ["-i", filePath, "-f", "null", "-"], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    proc.stderr.on("data", (c) => {
      stderr += c.toString()
    })
    proc.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (!match) return reject(new Error(`Could not probe duration from ${filePath}`))
      const [, hh, mm, ss] = match
      resolve(Number(hh) * 3600 + Number(mm) * 60 + Number(ss))
    })
    proc.on("error", reject)
  })
}

export async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { writeFile } = await import("node:fs/promises")
  await writeFile(destPath, buf)
}
