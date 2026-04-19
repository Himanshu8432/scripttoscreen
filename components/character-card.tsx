"use client"

import { User } from "lucide-react"
import type { CharacterLock } from "@/lib/types"

interface CharacterCardProps {
  character: CharacterLock
}

export function CharacterCard({ character }: CharacterCardProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Character lock
      </h3>
      <div className="flex gap-3 rounded-md border border-border/40 bg-card/40 p-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-muted">
          {character.referenceImageUrl ? (
            // Reference portrait from Pixazo — kept as plain img (cross-origin from Pixazo CDN)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.referenceImageUrl || "/placeholder.svg"}
              alt={`Reference portrait of ${character.name}`}
              className="size-full object-cover"
            />
          ) : (
            <User className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{character.name}</span>
            <span className="rounded border border-chart-2/30 bg-chart-2/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chart-2">
              Locked
            </span>
          </div>
          <p className="line-clamp-2 text-pretty text-xs text-muted-foreground">
            {character.description}
          </p>
          <p className="line-clamp-1 font-mono text-[10px] text-muted-foreground/80">
            Style: {character.stylePrefix}
          </p>
        </div>
      </div>
    </div>
  )
}
