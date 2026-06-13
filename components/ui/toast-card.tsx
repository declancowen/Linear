"use client"

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react"
import { type Icon, type IconProps, XIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * Visual accent applied to the icon badge of a {@link ToastCard}. Tones map to
 * the shared design tokens so update toasts and in-app notification toasts read
 * as one consistent family.
 */
export type ToastCardTone =
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "progress"
  | "neutral"

const TONE_BADGE_CLASSES: Record<ToastCardTone, string> = {
  accent: "bg-[color:var(--accent-bg)] text-[color:var(--accent-fg)]",
  success: "bg-status-done/15 text-status-done",
  warning: "bg-priority-high/15 text-priority-high",
  error: "bg-priority-urgent/15 text-priority-urgent",
  progress: "bg-surface-3 text-fg-3",
  neutral: "bg-surface-3 text-fg-3",
}

/**
 * Shared chrome for `toast.custom(...)` toasts rendered in the bottom-right
 * stack. It mirrors the default Sonner toast styling (border, surface, blur,
 * shadow) so custom toasts are visually indistinguishable from standard ones,
 * while adding an accent icon badge, an optional full-width action, and a
 * consistent dismiss affordance.
 */
export function ToastCard({
  action,
  className,
  closeLabel = "Dismiss",
  description,
  icon: IconComponent,
  iconWeight = "fill",
  interactive = false,
  onClick,
  onClose,
  tone = "accent",
  title,
}: {
  /** Optional action node rendered full-width beneath the copy. */
  action?: ReactNode
  className?: string
  closeLabel?: string
  description?: ReactNode
  /** Phosphor icon shown inside the accent badge. */
  icon: Icon
  iconWeight?: IconProps["weight"]
  /** When true, the whole card is a button that invokes `onClick`. */
  interactive?: boolean
  onClick?: () => void
  /** When provided, renders a dismiss (X) button in the top-right corner. */
  onClose?: () => void
  tone?: ToastCardTone
  title: ReactNode
}) {
  const isProgress = tone === "progress"

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!interactive) {
      return
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    onClick?.()
  }

  return (
    <div
      data-slot="toast-card"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={cn(
        "flex w-[var(--width)] max-w-[calc(100vw-2rem)] gap-3 rounded-lg border border-line/60 bg-background/95 p-3 text-left text-foreground shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl outline-none",
        interactive &&
          "cursor-pointer transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          TONE_BADGE_CLASSES[tone]
        )}
      >
        <IconComponent
          aria-hidden
          weight={isProgress ? "bold" : iconWeight}
          className={cn("size-4", isProgress && "animate-spin")}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] leading-5 font-medium">{title}</div>
            {description ? (
              <div className="mt-0.5 text-[12px] leading-4 break-words text-fg-3">
                {description}
              </div>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              className="-mt-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                onClose()
              }}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        {action ? <div className="flex justify-end">{action}</div> : null}
      </div>
    </div>
  )
}
