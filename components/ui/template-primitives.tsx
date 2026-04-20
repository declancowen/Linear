"use client"

import * as React from "react"
import { XCircle } from "@phosphor-icons/react"
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
  const wrapperClassName = cn(
    "inline-grid size-3 shrink-0 place-items-center",
    className
  )
  const ringStyle = {
    width: "calc(100% - 2px)",
    height: "calc(100% - 2px)",
  } satisfies React.CSSProperties

  if (status === "done") {
    return (
      <span
        aria-hidden
        className={wrapperClassName}
      >
        <span
          className="rounded-full"
          style={{
            ...ringStyle,
            background: "var(--status-done)",
          }}
        />
      </span>
    )
  }

  if (status === "cancelled") {
    return (
      <XCircle
        aria-hidden
        className={cn("size-3 shrink-0", className)}
        style={{ color: "var(--priority-urgent)" }}
        weight="fill"
      />
    )
  }

  if (status === "duplicate") {
    return (
      <XCircle
        aria-hidden
        className={cn("size-3 shrink-0", className)}
        style={{ color: "var(--status-cancel)" }}
        weight="fill"
      />
    )
  }

  if (status === "in-progress") {
    const p = Math.max(0, Math.min(100, percent ?? 50))
    return (
      <span
        aria-hidden
        className={wrapperClassName}
      >
        <span
          className="rounded-full border-[1.6px]"
          style={{
            ...ringStyle,
            borderColor: "var(--status-doing)",
            background: `conic-gradient(var(--status-doing) ${p}%, transparent ${p}% 100%)`,
          }}
        />
      </span>
    )
  }

  if (status === "todo") {
    return (
      <span
        aria-hidden
        className={wrapperClassName}
      >
        <span
          className="rounded-full border-[1.6px]"
          style={{
            ...ringStyle,
            borderColor: "var(--status-todo)",
          }}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={wrapperClassName}
    >
      <span
        className="rounded-full border-[1.6px]"
        style={{
          ...ringStyle,
          borderColor: "var(--status-backlog)",
        }}
      />
    </span>
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
          : status === "cancelled"
            ? "var(--priority-urgent)"
            : status === "duplicate"
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs leading-[1.15] transition-colors",
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
    <div className="flex items-center gap-2 border-b border-line-soft px-2.5 py-1.5 text-fg-3">
      <span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-5 flex-1 border-0 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-fg-4"
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
    <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
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
        "flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-left text-[12.5px] leading-[1.15] transition-colors",
        muted ? "text-fg-3" : "text-fg-2",
        "hover:bg-surface-3 hover:text-foreground",
        selected && "text-foreground",
        className
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
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
        "flex items-center justify-between border-t border-line-soft px-3 py-1.5 text-[11px] text-fg-3",
        className
      )}
    >
      {children}
    </div>
  )
}

export const PROPERTY_POPOVER_CLASS =
  "w-[240px] overflow-hidden rounded-lg border border-line bg-surface p-0 text-foreground shadow-lg"
