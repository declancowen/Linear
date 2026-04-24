"use client"

import type { TextInputLimitState } from "@/lib/domain/input-constraints"
import { cn } from "@/lib/utils"

export function FieldCharacterLimit({
  state,
  limit,
  className,
}: {
  state: TextInputLimitState
  limit: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "mt-2 flex items-start justify-between gap-3 text-[11px]",
        className
      )}
    >
      <span
        className={cn(
          "min-h-[1em] text-fg-3",
          state.error ? "text-[color:var(--priority-high)]" : "text-transparent"
        )}
      >
        {state.error ?? "ok"}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums text-fg-3",
          (state.tooLong || state.tooShort) &&
            "text-[color:var(--priority-high)]"
        )}
      >
        {state.displayCount}/{limit}
      </span>
    </div>
  )
}
