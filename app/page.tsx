"use client"

import { useState, useEffect, useRef } from "react"
import {
  Clapperboard, ScrollText, Settings2, Play, Loader2,
  RotateCcw, Sparkles, AlertCircle, Download, CheckCircle2, Clock,
} from "lucide-react"
import { KeysGate, KeysDrawer } from "@/components/keys-gate"
import { LogDrawer } from "@/components/log-stream"
import { useScriptPipeline } from "@/hooks/use-script-pipeline"
import { useKeys } from "@/hooks/use-keys"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"


// Human-readable step list shown during generation
const PROCESS_STEPS = [
  { id: "decompose",  label: "Breaking your story into scenes",     description: "Splits your script into 10-second cinematic beats" },
  { id: "character",  label: "Locking the protagonist & style",     description: "One character, one visual style — consistent across every scene" },
  { id: "voiceover",  label: "Recording the narration",             description: "Your full script voiced in a single take" },
  { id: "clips",      label: "Generating video scenes",             description: "Each scene rendered as a video clip in parallel" },
  { id: "assemble",   label: "Assembling the final video",          description: "All clips joined with cross-fade transitions" },
  { id: "upload",     label: "Uploading & finishing",               description: "Almost there…" },
]

const SAMPLE_SCRIPT = `The old lighthouse had stood on the cliff for a hundred and twelve years. Tonight, for the first time, it would go dark.

Maren climbed the spiral stairs she had climbed every night since she was twelve. Her grandfather's lamp, her father's lamp, and now hers. Two thousand and forty steps. She counted them out of habit.

At the top, she wiped the glass clean. The storm was already pushing in from the west. Ships needed the light. They always needed the light.

But the city council had decided. A new automated beacon would take over by dawn. They called it progress. They called it efficient. Maren called it the end of a story that had outlived three wars and nine generations of fishermen.

She turned the switch one last time. The great lamp hummed to life, throwing its long golden arm across the water. Somewhere in the dark, a small trawler changed course.

Maren sat down on the cold iron floor, watched the beam sweep, and waited for the morning that would take her lighthouse away.`

// Returns a short completion summary shown as a badge on done steps
function stepDetail(
  id: string,
  state: { scenes: unknown[]; character?: { name: string }; duration?: number; clips: Record<number, { status: string }> },
  clipsDone: number,
  clipsTotal: number,
): string | null {
  switch (id) {
    case "decompose":  return state.scenes.length > 0 ? `${state.scenes.length} scenes` : null
    case "character":  return state.character?.name ?? null
    case "voiceover":  return state.duration ? `${state.duration.toFixed(1)}s narration` : null
    case "clips":      return clipsTotal > 0 ? `${clipsDone} clips` : null
    case "assemble":   return "video assembled"
    case "upload":     return "done"
    default:           return null
  }
}

// ----------------------------------------------------------------------------
export default function StudioPage() {
  const { keys, setKeys, clearKeys, keysReady, hydrated } = useKeys()
  const { state, run, reset } = useScriptPipeline()
  const [logsOpen, setLogsOpen]   = useState(false)
  const [keysOpen, setKeysOpen]   = useState(false)
  const [script, setScript]       = useState("")
  const [voice, setVoice]         = useState("alloy")
  const [aspect, setAspect]       = useState("16:9")
  const [elapsed, setElapsed]     = useState(0)
  const startRef                  = useRef<number | null>(null)

  // Elapsed timer — counts seconds while running
  useEffect(() => {
    if (state.status === "running") {
      if (!startRef.current) startRef.current = Date.now()
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000))
      }, 1000)
      return () => clearInterval(id)
    } else {
      startRef.current = null
      setElapsed(0)
    }
  }, [state.status])

  if (!hydrated) return null
  if (!keysReady) return <KeysGate onSave={setKeys} />

  // Derived state
  const clipsDone     = Object.values(state.clips).filter(c => c.status === "done").length
  const clipsTotal    = state.scenes.length
  const clipsPercent  = clipsTotal > 0 ? Math.round((clipsDone / clipsTotal) * 100) : 0
  const elapsedStr    = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`

  function handleRun() {
    if (script.trim().length < 40) return
    run(script, voice, aspect, keys)
  }

  function handleReset() {
    reset()
    setScript("")
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.3]" aria-hidden />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/60 bg-background/70 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <Clapperboard className="size-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ScriptToScreen</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLogsOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-colors",
              state.logs.length > 0 || state.error
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border/50 bg-card/30 text-muted-foreground hover:text-primary",
            )}
          >
            <ScrollText className="size-3" />
            Logs
            {state.logs.length > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 text-[9px]">{state.logs.length}</span>
            )}
          </button>
          <button
            onClick={() => setKeysOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-card/30 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
          >
            <Settings2 className="size-3" />
            Keys
          </button>
        </div>
      </header>

      {/* ── Main content — state machine ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">

        {/* ── IDLE ── */}
        {state.status === "idle" && (
          <div className="flex w-full max-w-2xl flex-col gap-5">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                What's your story?
              </h1>
              <p className="text-sm text-muted-foreground">
                Write anything — a scene, a poem, a pitch. We'll turn it into a video.
              </p>
            </div>

            <div className="relative">
              <Textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={"Paste or write your script here…\n\nAround 250–320 words (~2 minutes) gives you 8–12 cinematic scenes."}
                className="min-h-[280px] resize-none border-border/60 bg-card/50 font-mono text-sm leading-relaxed placeholder:text-muted-foreground/40"
                autoFocus
              />
              {script.trim().length > 0 && (
                <span className={cn(
                  "absolute bottom-3 right-3 font-mono text-[10px]",
                  script.trim().split(/\s+/).length >= 250 && script.trim().split(/\s+/).length <= 320
                    ? "text-chart-2"
                    : "text-muted-foreground/50",
                )}>
                  {script.trim().split(/\s+/).length} words
                </span>
              )}
            </div>

            {/* Options row */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="h-9 w-40 bg-card/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy — neutral</SelectItem>
                  <SelectItem value="echo">Echo — warm male</SelectItem>
                  <SelectItem value="fable">Fable — storyteller</SelectItem>
                  <SelectItem value="onyx">Onyx — deep</SelectItem>
                  <SelectItem value="nova">Nova — bright female</SelectItem>
                  <SelectItem value="shimmer">Shimmer — soft</SelectItem>
                </SelectContent>
              </Select>

              <Select value={aspect} onValueChange={setAspect}>
                <SelectTrigger className="h-9 w-40 bg-card/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 — cinematic</SelectItem>
                  <SelectItem value="9:16">9:16 — vertical</SelectItem>
                  <SelectItem value="1:1">1:1 — square</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleRun}
                disabled={script.trim().length < 40}
                className="ml-auto h-9 gap-2 px-6"
              >
                <Play className="size-3.5" />
                Generate video
              </Button>
            </div>

            {!script && (
              <button
                onClick={() => setScript(SAMPLE_SCRIPT)}
                className="flex items-center gap-1.5 self-center text-xs text-muted-foreground/60 transition-colors hover:text-primary"
              >
                <Sparkles className="size-3" />
                Try the sample: The Lighthouse
              </button>
            )}
          </div>
        )}

        {/* ── RUNNING ── */}
        {state.status === "running" && (
          <div className="flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

            {/* LEFT — step progress */}
            <div className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-sm font-semibold">Generating your video</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{elapsedStr}</span>
              </div>

              <div className="flex flex-col gap-2">
                {PROCESS_STEPS.map((step, i) => {
                  const stage  = state.stages.find(s => s.id === step.id)
                  const status = stage?.status ?? "idle"
                  const detail = stepDetail(step.id, state, clipsDone, clipsTotal)
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all duration-500",
                        status === "done"    && "border-chart-2/30 bg-chart-2/5",
                        status === "running" && "border-primary/40 bg-primary/5",
                        status === "idle"    && "border-border/20 bg-card/10 opacity-40",
                        status === "error"   && "border-destructive/30 bg-destructive/5",
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                        status === "done"    && "bg-chart-2 text-background",
                        status === "running" && "bg-primary text-background",
                        status === "idle"    && "bg-border/30 text-muted-foreground/50",
                        status === "error"   && "bg-destructive text-background",
                      )}>
                        {status === "done"    && <CheckCircle2 className="size-3" />}
                        {status === "running" && <Loader2 className="size-3 animate-spin" />}
                        {status === "idle"    && <span>{i + 1}</span>}
                        {status === "error"   && <AlertCircle className="size-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn(
                            "text-xs font-medium leading-tight",
                            status === "done"    && "text-chart-2",
                            status === "running" && "text-foreground",
                            status === "idle"    && "text-muted-foreground/50",
                          )}>
                            {step.label}
                          </p>
                          {status === "done" && detail && (
                            <span className="shrink-0 rounded-full bg-chart-2/15 px-1.5 py-0.5 font-mono text-[9px] text-chart-2">
                              {detail}
                            </span>
                          )}
                        </div>
                        {status === "running" && step.id === "clips" && clipsTotal > 0 && (
                          <>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {clipsDone} of {clipsTotal} scenes rendered
                            </p>
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-card/60">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-700"
                                style={{ width: `${clipsPercent}%` }}
                              />
                            </div>
                          </>
                        )}
                        {status === "running" && step.id !== "clips" && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{step.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="font-mono text-[10px] text-muted-foreground/40">
                Takes 3–5 minutes · check Logs for details
              </p>
            </div>

            {/* RIGHT — live results as they unlock */}
            <div className="flex flex-1 flex-col gap-5 min-w-0">

              {/* Character portrait */}
              {state.character && (
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Protagonist
                  </p>
                  <div className="flex gap-4 rounded-lg border border-chart-2/25 bg-chart-2/5 p-4">
                    {state.character.referenceImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.character.referenceImageUrl}
                        alt={state.character.name}
                        className="size-24 shrink-0 rounded-md object-cover ring-1 ring-chart-2/20"
                      />
                    ) : (
                      <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-border/40 bg-card/50">
                        <span className="text-2xl">🎭</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{state.character.name}</span>
                        <span className="rounded-full bg-chart-2/15 px-2 py-0.5 font-mono text-[10px] text-chart-2">locked</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{state.character.description}</p>
                      <p className="font-mono text-[10px] text-muted-foreground/60 line-clamp-1">
                        Style: {state.character.stylePrefix}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Voiceover player */}
              {state.audioUrl && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Narration
                    </p>
                    {state.duration && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {state.duration.toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <audio
                    src={state.audioUrl}
                    controls
                    className="w-full rounded-md"
                    style={{ height: 36 }}
                  />
                </div>
              )}

              {/* Scene grid */}
              {state.scenes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Scenes
                    </p>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {clipsDone} / {clipsTotal} done
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {state.scenes.map(scene => {
                      const clip = state.clips[scene.index] ?? { status: "pending" as const }
                      return (
                        <div
                          key={scene.index}
                          title={scene.visual}
                          className={cn(
                            "relative flex aspect-video flex-col items-center justify-center gap-1 overflow-hidden rounded-md border transition-all duration-300",
                            clip.status === "pending" && "border-border/30 bg-card/30 opacity-50",
                            clip.status === "running" && "border-primary/50 bg-primary/5",
                            clip.status === "done"    && "border-chart-2/40 bg-chart-2/5",
                            clip.status === "error"   && "border-destructive/40 bg-destructive/5",
                          )}
                        >
                          {/* Completed clip: show thumbnail as video */}
                          {clip.status === "done" && clip.url && (
                            <video
                              src={clip.url}
                              muted
                              loop
                              playsInline
                              autoPlay
                              className="absolute inset-0 size-full object-cover opacity-80"
                            />
                          )}

                          <div className="relative z-10 flex flex-col items-center gap-0.5">
                            {clip.status === "pending" && (
                              <Clock className="size-4 text-muted-foreground/40" />
                            )}
                            {clip.status === "running" && (
                              <Loader2 className="size-4 animate-spin text-primary" />
                            )}
                            {clip.status === "done" && (
                              <CheckCircle2 className="size-4 text-chart-2 drop-shadow-sm" />
                            )}
                            {clip.status === "error" && (
                              <AlertCircle className="size-4 text-destructive" />
                            )}
                            <span className="font-mono text-[9px] text-muted-foreground/70 drop-shadow-sm">
                              {clip.status === "running" && typeof clip.elapsedSec === "number"
                                ? `${clip.elapsedSec}s`
                                : `${String(scene.index + 1).padStart(2, "0")}`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty right panel placeholder */}
              {!state.character && !state.audioUrl && state.scenes.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/30 p-12">
                  <p className="text-xs text-muted-foreground/40">
                    Results will appear here as each step completes…
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {state.status === "done" && state.videoUrl && (
          <div className="flex w-full max-w-3xl flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-chart-2" />
                <span className="text-sm font-medium">Your video is ready</span>
                {state.duration && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {state.duration.toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={state.videoUrl} download>
                    <Download className="size-3.5" />
                    Download
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="size-3.5" />
                  Make another
                </Button>
              </div>
            </div>

            <video
              src={state.videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full rounded-xl bg-black shadow-2xl"
            />
          </div>
        )}

        {/* ── ERROR ── */}
        {state.status === "error" && (
          <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
              <AlertCircle className="size-8 text-destructive" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-base font-medium">Something went wrong</p>
              <p className="font-mono text-xs text-muted-foreground/70 break-words max-w-sm">
                {state.error}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => run(script, voice, aspect, keys)} className="gap-2">
                <RotateCcw className="size-3.5" />
                Try again
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start over
              </Button>
            </div>
            <button
              onClick={() => setLogsOpen(true)}
              className="font-mono text-[10px] text-muted-foreground/50 underline-offset-4 hover:underline"
            >
              View full error log
            </button>
          </div>
        )}
      </div>

      {/* ── Drawers ── */}
      <LogDrawer
        logs={state.logs}
        errored={state.error}
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
      />
      <KeysDrawer
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        currentKeys={keys}
        onSave={setKeys}
        onReset={clearKeys}
      />
    </main>
  )
}
