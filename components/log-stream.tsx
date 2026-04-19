"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogEntry {
  level: "info" | "warn" | "error"
  message: string
  at: number
}

interface LogDrawerProps {
  logs: LogEntry[]
  errored?: string
  open: boolean
  onClose: () => void
}

export function LogDrawer({ logs, errored, open, onClose }: LogDrawerProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [logs.length, errored, open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pipeline Log
            </span>
            {logs.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                {logs.length}
              </span>
            )}
            {errored && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] text-destructive">
                error
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Close log"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 && !errored ? (
            <p className="text-muted-foreground/50">No logs yet. Start the pipeline to see output here.</p>
          ) : (
            <>
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 border-b border-border/20 py-1.5 last:border-0",
                    log.level === "warn" && "text-chart-5",
                    log.level === "error" && "text-destructive",
                    log.level === "info" && "text-foreground/80",
                  )}
                >
                  <span className="shrink-0 text-muted-foreground/50">{formatTime(log.at)}</span>
                  <span className="min-w-0 flex-1 break-words">{log.message}</span>
                </div>
              ))}
              {errored && (
                <div className="mt-1 flex gap-3 border-b border-border/20 py-1.5 text-destructive last:border-0">
                  <span className="shrink-0 text-muted-foreground/50">{formatTime(Date.now())}</span>
                  <span className="min-w-0 flex-1 break-words">error: {errored}</span>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        <div className="border-t border-border/60 px-4 py-2">
          <p className="font-mono text-[10px] text-muted-foreground/40">Press Esc to close</p>
        </div>
      </aside>
    </>
  )
}

function formatTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}
