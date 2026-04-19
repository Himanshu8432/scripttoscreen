// Stage 5: Assemble.
// Step 1: For each scene, trim the clip to its true audio duration and mux
//         the scene audio into the trimmed video (uniform 1920x1080 / 30fps
//         / h264+aac so concat can stream-copy safely).
// Step 2: Stitch all muxed scenes using the FFmpeg `concat` demuxer.
//
// NOTE: We deliberately avoid the `xfade` filter because the bundled
// static FFmpeg build (johnvansickle 2018) predates xfade. Concat is
// actually faster — it stream-copies without re-encoding — and produces
// crisp scene cuts. A future ffmpeg upgrade can reintroduce cross-fades.

import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { probeDuration, runFfmpeg } from "@/lib/ffmpeg"

export async function assembleVideo(
  clipPaths: string[],
  sceneAudioPaths: string[],
  workDir: string,
): Promise<{ outputPath: string; duration: number }> {
  if (clipPaths.length !== sceneAudioPaths.length) {
    throw new Error("clip/audio count mismatch")
  }

  // 1. Trim each clip to match its audio duration and mux the audio in.
  //    Uniform encoder settings across every scene are critical — the concat
  //    demuxer will reject streams with mismatched codec params.
  const muxed: { path: string; duration: number }[] = []
  for (let i = 0; i < clipPaths.length; i++) {
    const audioDur = await probeDuration(sceneAudioPaths[i])
    const out = join(workDir, `muxed-${i}.mp4`)
    await runFfmpeg([
      "-y",
      "-i",
      clipPaths[i],
      "-i",
      sceneAudioPaths[i],
      "-t",
      audioDur.toFixed(3),
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-b:a",
      "192k",
      "-shortest",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      out,
    ])
    muxed.push({ path: out, duration: audioDur })
  }

  return concatMuxedClips(muxed, workDir)
}

// Public so the recovery script can reuse it to stitch existing muxed files
// without re-rendering anything upstream.
export async function concatMuxedClips(
  muxed: { path: string; duration: number }[],
  workDir: string,
): Promise<{ outputPath: string; duration: number }> {
  const outputPath = join(workDir, "final.mp4")

  if (muxed.length === 0) {
    throw new Error("concatMuxedClips called with zero inputs")
  }

  if (muxed.length === 1) {
    await runFfmpeg(["-y", "-i", muxed[0].path, "-c", "copy", outputPath])
    return { outputPath, duration: muxed[0].duration }
  }

  // Concat demuxer needs a manifest file. One `file 'path'` per line.
  // Paths must be absolute or relative to the manifest; we use absolute.
  const manifestPath = join(workDir, "concat.txt")
  const manifest = muxed
    .map((m) => `file '${m.path.replace(/'/g, "'\\''")}'`)
    .join("\n")
  await writeFile(manifestPath, manifest, "utf8")

  // Stream-copy: no re-encode because every muxed scene already has
  // identical codec params. If copy ever fails, drop `-c copy` and add
  // the same h264/aac re-encode flags from step 1.
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    manifestPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ])

  const totalDuration = muxed.reduce((sum, m) => sum + m.duration, 0)
  return { outputPath, duration: totalDuration }
}
