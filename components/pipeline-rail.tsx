"use client"

import { Check, CircleAlert, CircleDashed, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StageState } from "@/hooks/use-script-pipeline"

interface PipelineRailProps {
  stages: StageState[]
}

export function PipelineRail({ stages }: PipelineRailProps) {
  return (
    <ol className="flex flex-col gap-2">
      {stages.map((stage, i) => (
        <li
          key={stage.id}
          className={cn(
            "flex items-start gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2.5 transition-colors",
            stage.status === "running" && "border-primary/50 bg-primary/5",
            stage.status === "done" && "border-chart-2/30",
            stage.status === "error" && "border-destructive/50 bg-destructive/5",
          )}
        >
          <StageIcon status={stage.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  stage.status === "idle" && "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            {stage.message && (
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {stage.message}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "running") return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
  if (status === "done") return <Check className="mt-0.5 size-4 shrink-0 text-chart-2" />
  if (status === "error") return <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}
