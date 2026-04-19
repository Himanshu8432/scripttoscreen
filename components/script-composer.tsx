"use client"

import { useState } from "react"
import { Loader2, Play, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SAMPLE_SCRIPT = `The old lighthouse had stood on the cliff for a hundred and twelve years. Tonight, for the first time, it would go dark.

Maren climbed the spiral stairs she had climbed every night since she was twelve. Her grandfather's lamp, her father's lamp, and now hers. Two thousand and forty steps. She counted them out of habit.

At the top, she wiped the glass clean. The storm was already pushing in from the west. Ships needed the light. They always needed the light.

But the city council had decided. A new automated beacon would take over by dawn. They called it progress. They called it efficient. Maren called it the end of a story that had outlived three wars and nine generations of fishermen.

She turned the switch one last time. The great lamp hummed to life, throwing its long golden arm across the water. Somewhere in the dark, a small trawler changed course.

Maren sat down on the cold iron floor, watched the beam sweep, and waited for the morning that would take her lighthouse away.`

interface ScriptComposerProps {
  onRun: (script: string, voice: string, aspectRatio: string) => void
  onReset: () => void
  running: boolean
  hasResult: boolean
}

export function ScriptComposer({ onRun, onReset, running, hasResult }: ScriptComposerProps) {
  const [script, setScript] = useState("")
  const [voice, setVoice] = useState("alloy")
  const [aspectRatio, setAspectRatio] = useState("16:9")

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
  const estimatedSeconds = Math.round((wordCount / 150) * 60)
  const tooShort = script.length < 40
  const sweetSpot = wordCount >= 250 && wordCount <= 320

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Step label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary/70">STEP 01</span>
          <h2 className="text-sm font-semibold tracking-tight">Write your story</h2>
        </div>
        {wordCount > 0 && (
          <div className={`font-mono text-xs ${sweetSpot ? "text-chart-2" : "text-muted-foreground"}`}>
            {wordCount} words · ~{estimatedSeconds}s
            {sweetSpot && " ✓"}
          </div>
        )}
      </div>

      <Textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder={`Tell a story. Describe a moment. Explain an idea.\n\nAround 250–320 words (~2 minutes) works best — enough to build a real narrative arc across 8–12 scenes.`}
        disabled={running}
        className="min-h-[320px] flex-1 resize-none border-border/60 bg-card/50 font-mono text-sm leading-relaxed placeholder:text-muted-foreground/50"
      />

      {!script && (
        <button
          onClick={() => setScript(SAMPLE_SCRIPT)}
          disabled={running}
          className="flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <Sparkles className="size-3" />
          Try the sample: The Lighthouse
        </button>
      )}

      {/* Step 2 — Voice & Format */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] text-primary/70">STEP 02 — Pick a voice &amp; format</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Narrator voice</Label>
            <Select value={voice} onValueChange={setVoice} disabled={running}>
              <SelectTrigger className="bg-card/50">
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Aspect ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={running}>
              <SelectTrigger className="bg-card/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 — cinematic</SelectItem>
                <SelectItem value="9:16">9:16 — vertical / Reels</SelectItem>
                <SelectItem value="1:1">1:1 — square</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Step 3 — Generate */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] text-primary/70">STEP 03 — Make the video</span>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onRun(script, voice, aspectRatio)}
            disabled={running || tooShort}
            className="flex-1"
            size="lg"
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Pipeline running…
              </>
            ) : (
              <>
                <Play className="size-4" />
                Generate video
              </>
            )}
          </Button>
          {(hasResult || running) && (
            <Button onClick={onReset} variant="outline" disabled={running} aria-label="Start over" size="lg">
              <RotateCcw className="size-4" />
            </Button>
          )}
        </div>
        {tooShort && script.length > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Keep writing — need at least 40 characters to start.
          </p>
        )}
      </div>
    </div>
  )
}
