"use client"

import {
  useRef,
  type ElementType,
  type ReactNode,
} from "react"
import { Camera, SpinnerGap, Trash, Warning } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

function CollectionPaneHeader({ title }: { title: string }) {
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-line-soft bg-background px-4 py-2">
      <SidebarTrigger className="size-5 shrink-0" />
      <h1 className="truncate text-[13px] font-medium text-fg-2">{title}</h1>
    </div>
  )
}

export function SettingsScaffold({
  title,
  subtitle,
  hero,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  hero?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <CollectionPaneHeader title={title} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
          {hero ? (
            <div className="mb-8">{hero}</div>
          ) : (
            <header className="mb-8">
              <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </header>
          )}
          <div className="space-y-8">{children}</div>
        </div>
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft bg-background/95 px-6 py-3 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function SettingsGroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
        {label}
      </span>
      <div className="h-px flex-1 bg-line-soft" />
    </div>
  )
}

export function SettingsNav<Value extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: Value
  onValueChange: (value: Value) => void
  options: Array<{
    value: Value
    label: string
    count?: number | null
  }>
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line-soft bg-surface-2 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-[0_1px_0_0_oklch(0.18_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10.5px] tabular-nums",
                  active
                    ? "bg-surface-3 text-foreground"
                    : "bg-transparent text-muted-foreground"
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsHero({
  leading,
  title,
  description,
  meta,
  action,
}: {
  leading?: ReactNode
  title: string
  description?: string | null
  meta?: Array<{
    key: string
    label: string
  }>
  action?: ReactNode
}) {
  return (
    <section className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] leading-tight font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta && meta.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {meta.map((entry, index) => (
              <div key={entry.key} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-fg-4">·</span>
                ) : null}
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  )
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  variant = "card",
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  variant?: "card" | "plain"
}) {
  if (variant === "plain") {
    return (
      <section className={cn("space-y-4", className)}>
        <header className="space-y-1">
          <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
        <div className="space-y-4">{children}</div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-surface",
        className
      )}
    >
      <header className="space-y-1 border-b border-line-soft px-5 pt-4 pb-3.5">
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function SettingsToggleRow({
  title,
  description,
  note,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description: string
  note?: string | null
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 space-y-1">
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </div>
        {note ? (
          <div className="text-[12.5px] leading-relaxed text-muted-foreground">
            {note}
          </div>
        ) : null}
      </div>
      <Switch
        checked={checked}
        className="mt-0.5 shrink-0"
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

export function SettingsDangerRow({
  icon: Icon = Warning,
  title,
  description,
  action,
}: {
  icon?: ElementType
  title: string
  description: ReactNode
  action: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.04] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon className="size-4" weight="bold" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">{title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-start">{action}</div>
    </section>
  )
}

export function ImageUploadControl({
  title,
  description,
  imageSrc,
  preview,
  shape,
  disabled,
  uploading,
  onSelect,
  onClear,
}: {
  title: string
  description?: string
  imageSrc: string | null
  preview: ReactNode
  shape: "circle" | "square"
  disabled?: boolean
  uploading?: boolean
  onSelect: (file: File) => Promise<void> | void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="flex items-center gap-4 py-1">
      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-2",
          shape === "circle" ? "rounded-full" : "rounded-2xl"
        )}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={title} className="size-full object-cover" src={imageSrc} />
        ) : (
          preview
        )}
      </div>
      <div className="min-w-0 flex-1">
        {description ? (
          <div className="text-[12.5px] text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <SpinnerGap className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || (!imageSrc && !uploading)}
          onClick={onClear}
        >
          <Trash className="size-3.5" />
        </Button>
      </div>
      <input
        ref={inputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""

          if (!file) {
            return
          }

          void onSelect(file)
        }}
      />
    </div>
  )
}
