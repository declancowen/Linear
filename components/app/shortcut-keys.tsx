"use client"

import { useEffect, useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

function getShortcutModifierLabelSnapshot() {
  if (typeof navigator === "undefined") {
    return "Ctrl"
  }

  const platformDetails = `${navigator.platform} ${navigator.userAgent}`

  return /Mac|iPhone|iPad|iPod/i.test(platformDetails) ? "⌘" : "Ctrl"
}

function subscribeToShortcutModifierLabel() {
  return () => {}
}

export function useShortcutModifierLabel() {
  return useSyncExternalStore(
    subscribeToShortcutModifierLabel,
    getShortcutModifierLabelSnapshot,
    getShortcutModifierLabelSnapshot
  )
}

export function useCommandEnterSubmit(
  enabled: boolean,
  onSubmit: () => void
) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return
      }

      event.preventDefault()
      onSubmit()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onSubmit])
}

export function ShortcutKeys({
  keys,
  className,
  keyClassName,
  variant = "keycap",
}: {
  keys: string[]
  className?: string
  keyClassName?: string
  variant?: "inline" | "keycap"
}) {
  const renderedKeys = keys.map((key) => (key === "Enter" ? "⏎" : key))
  const KeyTag = variant === "inline" ? "span" : "kbd"

  return (
    <span
      aria-hidden="true"
      className={cn(
        variant === "inline"
          ? "inline-flex items-center gap-0.5 leading-none"
          : "inline-flex items-center gap-1",
        className
      )}
    >
      {renderedKeys.map((key) => (
        <KeyTag
          key={key}
          className={cn(
            variant === "inline"
              ? "inline-flex min-w-0 items-center justify-center border-0 bg-transparent px-0 text-[11.5px] font-medium tracking-[-0.01em] text-current shadow-none"
              : "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/60 bg-muted/70 px-2 font-medium text-foreground/80 shadow-sm",
            keyClassName
          )}
        >
          {key}
        </KeyTag>
      ))}
    </span>
  )
}
