"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface LogEntry {
  level: "info" | "warn" | "error"
  message: string
  at: number
}

interface LogStreamProps {
  logs: LogEntry[]
  errored?: string
}

export function LogStream({ logs, errored }: LogStreamProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [logs.length, errored])

  if (logs.length === 0 && !errored) return null

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Log</h3>
      <div className="max-h-48 overflow-y-auto rounded-md border border-border/40 bg-card/40 p-3 font-mono text-[11px] leading-relaxed">
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              log.level === "warn" && "text-chart-5",
              log.level === "error" && "text-destructive",
            )}
          >
            <span className="shrink-0 text-muted-foreground/60">
              {formatTime(log.at)}
            </span>
            <span className="min-w-0 flex-1 break-words">{log.message}</span>
          </div>
        ))}
        {errored && (
          <div className="mt-1 flex gap-2 text-destructive">
            <span className="shrink-0 text-muted-foreground/60">{formatTime(Date.now())}</span>
            <span>error: {errored}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function formatTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}
