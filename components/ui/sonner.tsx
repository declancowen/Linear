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
        success: <CheckCircleIcon weight="fill" className="size-[15px]" />,
        info: <InfoIcon weight="fill" className="size-[15px]" />,
        warning: <WarningIcon weight="fill" className="size-[15px]" />,
        error: <XCircleIcon weight="fill" className="size-[15px]" />,
        loading: <SpinnerIcon className="size-[15px] animate-spin" />,
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
            "cn-toast group group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-line/60 group-[.toaster]:bg-background/95 group-[.toaster]:px-3.5 group-[.toaster]:py-2.5 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:[--toast-accent:var(--text-4)]",
          content: "flex items-center gap-2.5",
          title: "text-[13px] font-medium leading-5 text-foreground",
          description: "text-[12px] leading-4 text-fg-3",
          icon: "flex size-4 shrink-0 items-center justify-center text-[color:var(--toast-accent)]",
          closeButton:
            "rounded-md border border-line/60 bg-surface/90 text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
          actionButton:
            "rounded-md bg-foreground px-2.5 py-1 text-[12px] font-medium text-background transition-opacity hover:opacity-90",
          cancelButton:
            "rounded-md border border-line/60 bg-surface/90 px-2.5 py-1 text-[12px] font-medium text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
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
