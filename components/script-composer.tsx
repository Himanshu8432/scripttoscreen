"use client"

import { useState } from "react"
import { Film, Loader2, Play, RotateCcw } from "lucide-react"
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

  const charCount = script.length
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
  const estimatedSeconds = Math.round((wordCount / 150) * 60) // ~150 wpm

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-primary" />
          <h2 className="text-sm font-medium tracking-tight">Script</h2>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {wordCount} words · ~{estimatedSeconds}s
        </div>
      </div>

      <Textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Paste a script here. Around 2 minutes of spoken content works best (roughly 250-320 words)."
        disabled={running}
        className="min-h-[360px] flex-1 resize-none border-border/60 bg-card/50 font-mono text-sm leading-relaxed"
      />

      {!script && (
        <button
          onClick={() => setScript(SAMPLE_SCRIPT)}
          disabled={running}
          className="self-start text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          Load sample script (The Lighthouse)
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Voice</Label>
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
          <Label className="text-xs text-muted-foreground">Aspect</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={running}>
            <SelectTrigger className="bg-card/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 — cinematic</SelectItem>
              <SelectItem value="9:16">9:16 — vertical</SelectItem>
              <SelectItem value="1:1">1:1 — square</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => onRun(script, voice, aspectRatio)}
          disabled={running || charCount < 40}
          className="flex-1"
        >
          {running ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Generate video
            </>
          )}
        </Button>
        {(hasResult || running) && (
          <Button onClick={onReset} variant="outline" disabled={running} aria-label="Reset">
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>

      <p className="text-pretty font-mono text-[10px] leading-relaxed text-muted-foreground">
        Your script is decomposed into 12–14s scenes, a character &amp; cinematic style are locked once,
        voiceover is rendered in a single take, clips generate in parallel, and everything is assembled
        with cross-fade transitions.
      </p>
    </div>
  )
}
