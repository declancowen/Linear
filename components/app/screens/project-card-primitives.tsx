"use client"

import type { ComponentType } from "react"
import { ArrowSquareOut } from "@phosphor-icons/react"

import type { ViewDefinition } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

type ProjectProgress = {
  completedPercent: number
  inProgressOnlyPercent: number
}

export function ProjectProgressMeter({
  progress,
  percentClassName,
  trackClassName,
  transition = true,
}: {
  progress: ProjectProgress
  percentClassName?: string
  trackClassName?: string
  transition?: boolean
}) {
  return (
    <>
      <div
        className={cn(
          "relative h-[5px] flex-1 overflow-hidden rounded-full bg-surface-3",
          trackClassName
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full opacity-90",
            transition && "transition-all"
          )}
          style={{
            left: `${progress.completedPercent}%`,
            width: `${progress.inProgressOnlyPercent}%`,
            background: "var(--status-doing)",
          }}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            transition && "transition-all"
          )}
          style={{
            width: `${progress.completedPercent}%`,
            background: "var(--status-done)",
          }}
        />
      </div>
      <span className={cn("tabular-nums", percentClassName)}>
        {progress.completedPercent}%
      </span>
    </>
  )
}

type ViewCardLayoutMeta = {
  accent: string
  icon: ComponentType<{ className?: string }>
}

export function ViewCardHeader({
  layoutMeta,
  showOpenIcon = false,
  subtitle,
  view,
}: {
  layoutMeta: ViewCardLayoutMeta
  showOpenIcon?: boolean
  subtitle?: string | null
  view: ViewDefinition
}) {
  const LayoutIcon = layoutMeta.icon

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md"
        style={{
          color: layoutMeta.accent,
          background: `color-mix(in oklch, ${layoutMeta.accent} 18%, transparent)`,
        }}
      >
        <LayoutIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[14px] leading-[1.3] font-semibold tracking-[-0.005em] text-foreground">
          {view.name}
        </h2>
        {subtitle ? (
          <div className="mt-px truncate text-[11.5px] text-fg-3">
            {subtitle}
          </div>
        ) : null}
      </div>
      {showOpenIcon ? (
        <ArrowSquareOut className="size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </div>
  )
}
