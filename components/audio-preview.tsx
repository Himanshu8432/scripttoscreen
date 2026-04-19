"use client"

import { AudioLines } from "lucide-react"

interface AudioPreviewProps {
  audioUrl: string
  totalDuration?: number
}

export function AudioPreview({ audioUrl, totalDuration }: AudioPreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AudioLines className="size-3.5 text-primary" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Voiceover
          </h3>
        </div>
        {totalDuration !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {totalDuration.toFixed(1)}s
          </span>
        )}
      </div>
      <audio src={audioUrl} controls className="w-full" />
    </div>
  )
}
