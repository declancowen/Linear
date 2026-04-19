"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ChipVariant = "default" | "ghost" | "accent" | "dashed"

export const Chip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ChipVariant
    muted?: boolean
    asChild?: boolean
  }
>(function Chip(
  { className, variant = "default", muted = false, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
        variant === "default" &&
          "border-line bg-surface text-fg-2 hover:text-foreground",
        variant === "ghost" &&
          "border-transparent bg-transparent text-fg-2 hover:bg-surface-3 hover:text-foreground",
        variant === "accent" &&
          "border-transparent bg-accent-bg text-accent-fg hover:brightness-105",
        variant === "dashed" &&
          "border-dashed border-line text-fg-3 hover:text-foreground",
        muted && "text-fg-3",
        className
      )}
      {...props}
    />
  )
})

export function StatusRing({
  status,
  percent,
  className,
}: {
  status: "backlog" | "todo" | "in-progress" | "done" | "cancelled" | "duplicate"
  percent?: number
  className?: string
}) {
  if (status === "done") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 shrink-0 rounded-full",
          className
        )}
        style={{
          background: "var(--status-done)",
          borderColor: "var(--status-done)",
        }}
      />
    )
  }

  if (status === "cancelled" || status === "duplicate") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 shrink-0 rounded-full border-[1.5px]",
          className
        )}
        style={{ borderColor: "var(--status-cancel)" }}
      />
    )
  }

  if (status === "in-progress") {
    const p = Math.max(0, Math.min(100, percent ?? 50))
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block size-[11px] shrink-0 rounded-full border-[1.25px]",
          className
        )}
        style={{
          borderColor: "var(--status-doing)",
          background: `conic-gradient(var(--status-doing) ${p}%, transparent ${p}% 100%)`,
        }}
      />
    )
  }

  if (status === "todo") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 shrink-0 rounded-full border-[1.5px]",
          className
        )}
        style={{ borderColor: "var(--status-todo)" }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3 shrink-0 rounded-full border-[1.5px]",
        className
      )}
      style={{ borderColor: "var(--status-backlog)" }}
    />
  )
}

export function StatusDot({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const color =
    status === "done"
      ? "var(--status-done)"
      : status === "in-progress"
        ? "var(--status-doing)"
        : status === "todo"
          ? "var(--status-todo)"
          : status === "cancelled" || status === "duplicate"
            ? "var(--status-cancel)"
            : "var(--status-backlog)"
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: color }}
    />
  )
}

export function Topbar({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b border-line bg-background px-3.5",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Viewbar({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex h-[42px] shrink-0 items-center gap-1.5 border-b border-line-soft bg-background px-3.5",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ViewTab({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-surface text-foreground shadow-[0_1px_0_0_oklch(0.18_0_0/0.04)] border border-line"
          : "text-fg-2 hover:bg-surface-3 hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export function IconButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-grid size-7 place-items-center rounded-md text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export function PropertyPopoverSearch({
  icon,
  placeholder,
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
  trailing,
}: {
  icon: React.ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5 text-fg-3">
      <span aria-hidden className="flex size-[14px] items-center justify-center">
        {icon}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-5 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-4"
      />
      {trailing}
    </div>
  )
}

export function PropertyPopoverList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex max-h-[320px] flex-col overflow-y-auto p-1",
        className
      )}
    >
      {children}
    </div>
  )
}

export function PropertyPopoverGroup({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1 px-3 pt-2 pb-1 text-[11px] font-medium text-fg-3">
      <span className="flex-1">{children}</span>
      {trailing}
    </div>
  )
}

export function PropertyPopoverItem({
  children,
  selected = false,
  onClick,
  muted = false,
  trailing,
  className,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  muted?: boolean
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      data-selected={selected ? "" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
        muted ? "text-fg-3" : "text-fg-2",
        "hover:bg-surface-3 hover:text-foreground",
        selected && "text-foreground",
        className
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {children}
      </span>
      {trailing}
    </button>
  )
}

export function PropertyPopoverFoot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-line-soft px-3 py-2 text-[11.5px] text-fg-3",
        className
      )}
    >
      {children}
    </div>
  )
}

export const PROPERTY_POPOVER_CLASS =
  "w-[280px] overflow-hidden rounded-lg border border-line bg-surface p-0 text-foreground shadow-lg"
