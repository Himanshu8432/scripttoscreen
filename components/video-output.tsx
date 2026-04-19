"use client"

import { Download, Film } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VideoOutputProps {
  videoUrl: string
  duration?: number
}

export function VideoOutput({ videoUrl, duration }: VideoOutputProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-chart-2/30 bg-chart-2/[0.03] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-chart-2" />
          <h3 className="text-sm font-medium">Final video</h3>
          {duration !== undefined && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {duration.toFixed(1)}s
            </span>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={videoUrl} download>
            <Download className="size-3.5" />
            Download
          </a>
        </Button>
      </div>
      <video
        src={videoUrl}
        controls
        playsInline
        className="aspect-video w-full rounded-md bg-black"
      />
    </div>
  )
}
