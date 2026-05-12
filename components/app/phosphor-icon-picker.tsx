"use client"

import * as PhosphorIcons from "@phosphor-icons/react"
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react"
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
  PropertyPopoverItem,
  PropertyPopoverList,
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
}: {
  value: string
  onValueChange: (value: PhosphorIconName) => void
  className?: string
  triggerClassName?: string
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
          className={cn(
            "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
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
        <PropertyPopoverList>
          {filteredOptions.map((icon) => {
            const Icon = getIconComponent(icon)
            const isSelected = icon === selected

            return (
              <PropertyPopoverItem
                key={icon}
                selected={isSelected}
                onClick={() => {
                  onValueChange(icon)
                  setOpen(false)
                }}
                trailing={
                  isSelected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                {createElement(Icon, {
                  className: "size-[14px] shrink-0 text-fg-3",
                })}
                <span>{getIconLabel(icon)}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}
