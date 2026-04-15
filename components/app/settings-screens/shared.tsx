"use client"

import { useRef, type ReactNode } from "react"
import { Camera, SpinnerGap, Trash } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

function CollectionPaneHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-5 shrink-0" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
        {subtitle ? (
          <span className="hidden truncate text-xs text-muted-foreground xl:inline">
            — {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  )
}

export function SettingsScaffold({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CollectionPaneHeader title={title} subtitle={subtitle} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-0 px-6 py-6">
          {children}
        </div>
      </div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
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
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
        {note ? (
          <div className="text-sm leading-relaxed text-muted-foreground">
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
    <div className="flex items-center gap-4 py-2">
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center overflow-hidden border bg-muted/40",
          shape === "circle" ? "rounded-full" : "rounded-xl"
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
          <div className="text-xs text-muted-foreground">{description}</div>
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
