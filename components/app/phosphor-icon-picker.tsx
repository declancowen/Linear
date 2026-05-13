"use client"

import * as PhosphorIcons from "@phosphor-icons/react"
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react"
import { createElement, useState, type ComponentType } from "react"

import {
  phosphorIconOptions,
  resolvePhosphorIconName,
  type PhosphorIconName,
} from "@/lib/domain/phosphor-icon-options"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
type IconComponent = ComponentType<{
  className?: string
  weight?: "regular" | "fill" | "duotone" | "bold" | "light" | "thin"
}>

const MissingIcon: IconComponent = ({ className }) => (
  <span aria-hidden className={className} />
)

function getIconComponent(icon: string): IconComponent {
  return (
    (PhosphorIcons as unknown as Record<string, IconComponent>)[
      resolvePhosphorIconName(icon)
    ] ?? MissingIcon
  )
}

function getIconLabel(icon: string) {
  return icon.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function PhosphorIconGlyph({
  icon,
  className,
  fallback = "FolderSimple",
}: {
  icon?: string | null
  className?: string
  fallback?: PhosphorIconName
}) {
  const Icon = getIconComponent(resolvePhosphorIconName(icon, fallback))

  return createElement(Icon, { className })
}

export function PhosphorIconPicker({
  value,
  onValueChange,
  className,
  triggerClassName,
  disabled = false,
}: {
  value: string
  onValueChange: (value: PhosphorIconName) => void
  className?: string
  triggerClassName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = resolvePhosphorIconName(value)
  const filteredOptions = phosphorIconOptions.filter((icon) =>
    getIconLabel(icon).toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface disabled:hover:text-fg-2",
            triggerClassName
          )}
        >
          <PhosphorIconGlyph icon={selected} className="size-[13px]" />
          <span className="truncate">{getIconLabel(selected)}</span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]", className)}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Search icons..."
          value={query}
          onChange={setQuery}
        />
        <div className="grid max-h-[260px] grid-cols-8 gap-1 overflow-y-auto p-1">
          {filteredOptions.map((icon) => {
            const Icon = getIconComponent(icon)
            const isSelected = icon === selected

            return (
              <button
                key={icon}
                type="button"
                aria-label={getIconLabel(icon)}
                title={getIconLabel(icon)}
                className={cn(
                  "relative grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                  isSelected && "bg-surface-3 text-foreground"
                )}
                onClick={() => {
                  onValueChange(icon)
                  setOpen(false)
                }}
              >
                {createElement(Icon, {
                  className: "size-[15px] shrink-0",
                })}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
