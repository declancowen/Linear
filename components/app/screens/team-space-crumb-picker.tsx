"use client"

import { useMemo, useState } from "react"
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

const TEAM_DOT_COLORS = [
  "var(--label-1)",
  "var(--label-2)",
  "var(--label-3)",
  "var(--label-4)",
  "var(--label-5)",
]

function getTeamDotColor(teamId: string | null | undefined) {
  if (!teamId) {
    return TEAM_DOT_COLORS[3]
  }

  let hash = 0
  for (let index = 0; index < teamId.length; index += 1) {
    hash = (hash * 31 + teamId.charCodeAt(index)) >>> 0
  }

  return TEAM_DOT_COLORS[hash % TEAM_DOT_COLORS.length]
}

function matchesQuery(value: string, query: string) {
  if (!query.trim()) {
    return true
  }

  return value.toLowerCase().includes(query.trim().toLowerCase())
}

export function TeamSpaceCrumbPicker({
  options,
  selectedId,
  onSelect,
  triggerClassName,
  placeholder = "Team space",
}: {
  options: Array<{
    id: string
    label: string
    teamId?: string | null
  }>
  selectedId: string
  onSelect: (id: string) => void
  triggerClassName: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId]
  )
  const filteredOptions = useMemo(
    () => options.filter((option) => matchesQuery(option.label, query)),
    [options, query]
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
          className={cn(triggerClassName, "min-w-0")}
          disabled={options.length === 0}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-full"
              style={{
                background: getTeamDotColor(selectedOption?.teamId ?? selectedId),
              }}
            />
            <span className="truncate font-medium text-foreground">
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Switch team space…"
          value={query}
          onChange={setQuery}
        />
        <PropertyPopoverList>
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
              No team spaces
            </div>
          ) : (
            <>
              <PropertyPopoverGroup>Team spaces</PropertyPopoverGroup>
              {filteredOptions.map((option) => {
                const selected = option.id === selectedId
                return (
                  <PropertyPopoverItem
                    key={option.id}
                    selected={selected}
                    onClick={() => {
                      onSelect(option.id)
                      setOpen(false)
                      setQuery("")
                    }}
                    trailing={
                      selected ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <span
                      aria-hidden
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{
                        background: getTeamDotColor(option.teamId ?? option.id),
                      }}
                    />
                    <span className="truncate">{option.label}</span>
                  </PropertyPopoverItem>
                )
              })}
            </>
          )}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}
