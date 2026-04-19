"use client"

import { Clapperboard } from "lucide-react"
import { ScriptComposer } from "@/components/script-composer"
import { PipelineRail } from "@/components/pipeline-rail"
import { SceneGrid } from "@/components/scene-grid"
import { LogStream } from "@/components/log-stream"
import { CharacterCard } from "@/components/character-card"
import { AudioPreview } from "@/components/audio-preview"
import { VideoOutput } from "@/components/video-output"
import { useScriptPipeline } from "@/hooks/use-script-pipeline"
import { cn } from "@/lib/utils"

export default function StudioPage() {
  const { state, run, reset } = useScriptPipeline()
  const running = state.status === "running"
  const hasResult = state.status === "done" || !!state.videoUrl

  return (
    <main className="relative flex min-h-dvh flex-col bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <header className="relative z-10 flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <Clapperboard className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">ScriptToScreen</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              script → scenes → voice → video
            </span>
          </div>
        </div>
        <StatusPill status={state.status} />
      </header>

      <div className="relative z-10 grid flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Left: script composer */}
        <section className="flex flex-col rounded-lg border border-border/60 bg-card/40 p-5 backdrop-blur">
          <ScriptComposer onRun={run} onReset={reset} running={running} hasResult={hasResult} />
        </section>

        {/* Right: live pipeline */}
        <section className="flex flex-col gap-5">
          {/* Final video: floats to top when ready */}
          {state.videoUrl && <VideoOutput videoUrl={state.videoUrl} duration={state.duration} />}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pipeline
              </h3>
              <PipelineRail stages={state.stages} />
            </div>

            <div className="flex flex-col gap-4">
              {state.character && <CharacterCard character={state.character} />}
              {state.audioUrl && (
                <AudioPreview audioUrl={state.audioUrl} totalDuration={state.duration} />
              )}
              {!state.character && !state.audioUrl && <EmptyHint />}
            </div>
          </div>

          <SceneGrid scenes={state.scenes} clips={state.clips} />
          <LogStream logs={state.logs} errored={state.error} />
        </section>
      </div>

      <footer className="relative z-10 border-t border-border/60 bg-background/60 px-6 py-3 backdrop-blur">
        <p className="text-balance font-mono text-[10px] text-muted-foreground">
          Powered by AI Gateway (gpt-5-mini) · OpenAI TTS · Pixazo video · FFmpeg xfade · Vercel Blob
        </p>
      </footer>
    </main>
  )
}

function StatusPill({ status }: { status: "idle" | "running" | "done" | "error" }) {
  const label =
    status === "running" ? "Running" : status === "done" ? "Complete" : status === "error" ? "Error" : "Ready"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
        status === "idle" && "border-border/60 bg-card/40 text-muted-foreground",
        status === "running" && "border-primary/40 bg-primary/10 text-primary",
        status === "done" && "border-chart-2/40 bg-chart-2/10 text-chart-2",
        status === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "idle" && "bg-muted-foreground",
          status === "running" && "animate-pulse bg-primary",
          status === "done" && "bg-chart-2",
          status === "error" && "bg-destructive",
        )}
      />
      {label}
    </span>
  )
}

function EmptyHint() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border/60 bg-card/20 p-4">
      <p className="text-xs text-muted-foreground">
        The character portrait and voiceover preview will appear here as the pipeline runs.
      </p>
      <ol className="flex flex-col gap-1 font-mono text-[10px] text-muted-foreground/80">
        <li>1. script is decomposed into 12–14s scenes</li>
        <li>2. a protagonist &amp; cinematic style get locked once</li>
        <li>3. voiceover renders in a single pass</li>
        <li>4. scene clips generate in parallel (3 at a time)</li>
        <li>5. everything is assembled with cross-fade</li>
      </ol>
    </div>
  )
}
