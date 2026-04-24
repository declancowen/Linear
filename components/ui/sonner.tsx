"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon, SpinnerIcon } from "@phosphor-icons/react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <WarningIcon className="size-4" />
        ),
        error: (
          <XCircleIcon className="size-4" />
        ),
        loading: (
          <SpinnerIcon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast group group-[.toaster]:rounded-[20px] group-[.toaster]:border group-[.toaster]:border-line/80 group-[.toaster]:bg-background/95 group-[.toaster]:px-0 group-[.toaster]:py-0 group-[.toaster]:text-foreground group-[.toaster]:shadow-[inset_4px_0_0_0_var(--toast-accent),0_24px_54px_-30px_rgba(15,23,42,0.48)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:[--toast-accent:var(--text-4)]",
          content:
            "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-4",
          title:
            "pt-0.5 text-[13px] font-semibold leading-5 tracking-[0.01em] text-foreground",
          description: "text-[12px] leading-5 text-fg-3",
          icon:
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl border border-line bg-background/90 text-[color:var(--toast-accent)] shadow-[0_12px_28px_-22px_var(--toast-accent)]",
          closeButton:
            "rounded-full border border-line bg-background/90 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
          actionButton:
            "rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90",
          cancelButton:
            "rounded-md border border-line bg-background/90 px-3 py-1.5 text-[12px] font-medium text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
          success: "group-[.toaster]:[--toast-accent:var(--status-done)]",
          error: "group-[.toaster]:[--toast-accent:var(--priority-urgent)]",
          warning: "group-[.toaster]:[--toast-accent:var(--priority-high)]",
          info: "group-[.toaster]:[--toast-accent:var(--brand)]",
          loading: "group-[.toaster]:[--toast-accent:var(--text-3)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
