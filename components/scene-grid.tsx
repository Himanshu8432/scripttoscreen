"use client"

import { Check, CircleAlert, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ClipState } from "@/hooks/use-script-pipeline"
import type { Scene } from "@/lib/types"

interface SceneGridProps {
  scenes: Scene[]
  clips: Record<number, ClipState>
}

export function SceneGrid({ scenes, clips }: SceneGridProps) {
  if (scenes.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scenes
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {scenes.length} total
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {scenes.map((scene) => {
          const clip = clips[scene.index] ?? { status: "pending" as const }
          return (
            <div
              key={scene.index}
              className={cn(
                "group relative flex aspect-video flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-border/40 bg-card/40 p-2 transition-all",
                clip.status === "running" && "border-primary/60 bg-primary/5",
                clip.status === "done" && "border-chart-2/40 bg-chart-2/5",
                clip.status === "error" && "border-destructive/60 bg-destructive/5",
              )}
              title={scene.visual}
            >
              <div className="absolute left-1.5 top-1.5 font-mono text-[10px] text-muted-foreground">
                {String(scene.index + 1).padStart(2, "0")}
              </div>
              <ClipIcon status={clip.status} />
              <span className="font-mono text-[10px] text-muted-foreground">
                {clip.status === "running" && typeof clip.elapsedSec === "number"
                  ? formatElapsed(clip.elapsedSec)
                  : `${scene.duration}s`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function ClipIcon({ status }: { status: ClipState["status"] }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-primary" />
  if (status === "done") return <Check className="size-4 text-chart-2" />
  if (status === "error") return <CircleAlert className="size-4 text-destructive" />
  return <Clock className="size-4 text-muted-foreground/60" />
}
