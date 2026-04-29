"use client"

import type { TextInputLimitState } from "@/lib/domain/input-constraints"
import { cn } from "@/lib/utils"

export function FieldCharacterLimit({
  state,
  className,
}: {
  state: TextInputLimitState
  limit?: number
  className?: string
}) {
  if (!state.error) {
    return null
  }

  return (
    <div
      className={cn(
        "mt-2 text-[11px] text-[color:var(--priority-high)]",
        className
      )}
    >
      {state.error}
    </div>
  )
}
