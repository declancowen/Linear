"use client"

import {
  useRef,
  type ElementType,
  type ReactNode,
} from "react"
import {
  CaretRight,
  Camera,
  SpinnerGap,
  Trash,
  Warning,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

function CollectionPaneHeader({
  title,
  breadcrumb,
}: {
  title: string
  breadcrumb?: string
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-line-soft bg-background px-4 py-2">
      <SidebarTrigger className="size-5 shrink-0" />
      <div className="flex min-w-0 items-center gap-1.5">
        {breadcrumb ? (
          <>
            <span className="truncate text-[13px] text-muted-foreground">
              {breadcrumb}
            </span>
            <CaretRight
              className="size-3 shrink-0 text-fg-4"
              weight="bold"
            />
          </>
        ) : null}
        <h1 className="truncate text-[13px] font-medium text-fg-2">{title}</h1>
      </div>
    </div>
  )
}

export function SettingsScaffold({
  title,
  breadcrumb = "Settings",
  subtitle,
  hero,
  children,
  footer,
}: {
  title: string
  breadcrumb?: string
  subtitle?: ReactNode
  hero?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <CollectionPaneHeader title={title} breadcrumb={breadcrumb} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 pt-9 pb-20">
          {hero ? (
            <div className="mb-9">{hero}</div>
          ) : (
            <header className="mb-9 space-y-1.5">
              <h1 className="text-[20px] leading-tight font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </header>
          )}
          <div className="space-y-9">{children}</div>
        </div>
      </div>
      {footer ? (
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-line-soft bg-background/95 px-6 py-2.5 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function SettingsGroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
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
  description?: ReactNode
  meta?: Array<{
    key: string
    label: ReactNode
  }>
  action?: ReactNode
}) {
  return (
    <section className="flex items-center gap-5">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="truncate text-[22px] leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="line-clamp-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta && meta.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11.5px] text-fg-3">
            {meta.map((entry, index) => (
              <div key={entry.key} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
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
  action,
  className,
  variant = "card",
}: {
  title?: string
  description?: ReactNode
  children: ReactNode
  action?: ReactNode
  className?: string
  variant?: "card" | "plain"
}) {
  const header =
    title || description || action ? (
      <header
        className={cn(
          "flex items-end justify-between gap-4",
          variant === "card"
            ? "border-b border-line-soft px-5 pt-4 pb-3.5"
            : "pb-1"
        )}
      >
        <div className="min-w-0 space-y-1">
          {title ? (
            <h2 className="text-[14px] font-semibold tracking-tight">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    ) : null

  if (variant === "plain") {
    return (
      <section className={cn("space-y-4", className)}>
        {header}
        <div className="space-y-3">{children}</div>
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
      {header}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function SettingsRowGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingsRow({
  label,
  description,
  control,
  className,
  alignment = "start",
}: {
  label: ReactNode
  description?: ReactNode
  control: ReactNode
  className?: string
  alignment?: "start" | "center"
}) {
  return (
    <div
      className={cn(
        "grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,_220px)_1fr] sm:gap-6",
        alignment === "center" ? "sm:items-center" : "sm:items-start",
        className
      )}
    >
      <div className="min-w-0 space-y-1 pt-1">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        {description ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
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
    <div className="flex items-start justify-between gap-4 px-5 py-3.5 sm:items-center">
      <div className="min-w-0 space-y-0.5">
        <div className="text-[13px] font-medium leading-tight">{title}</div>
        <div className="text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </div>
        {note ? (
          <div className="pt-0.5 text-[12px] leading-relaxed text-fg-3">
            {note}
          </div>
        ) : null}
      </div>
      <Switch
        checked={checked}
        className="shrink-0"
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
      <button
        type="button"
        aria-label={`Change ${title.toLowerCase()}`}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex size-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-2 transition-colors hover:border-line",
          shape === "circle" ? "rounded-full" : "rounded-2xl",
          (disabled || uploading) && "cursor-not-allowed opacity-70"
        )}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={title} className="size-full object-cover" src={imageSrc} />
        ) : (
          preview
        )}
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/55 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          )}
        >
          {uploading ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-[13px] font-medium">{title}</div>
        {description ? (
          <div className="text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : (
          <div className="text-[12.5px] leading-relaxed text-muted-foreground">
            Square image, at least 256px. PNG or JPG up to 10 MB.
          </div>
        )}
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
          aria-label="Remove image"
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
