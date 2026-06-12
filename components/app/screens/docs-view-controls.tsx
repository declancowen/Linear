"use client"

import {
  CaretDown,
  Check,
  FunnelSimple,
  SortAscending,
  TreeStructure,
} from "@phosphor-icons/react"

import { DocsFilterOptionsList } from "@/components/app/screens/docs-filter-options-list"
import {
  buildDocsFilterOptions,
  DOCS_GROUP_OPTIONS,
  DOCS_ORDERING_LABEL,
  DOCS_ORDERING_OPTIONS,
  getDocsFilterCount,
  groupDocsFilterOptions,
} from "@/components/app/screens/docs-view-config"
import type {
  AppData,
  Document,
  GroupField,
  OrderingField,
  ViewDefinition,
} from "@/lib/domain/types"
import type { ViewFilterKey } from "@/components/app/screens/helpers"
import type { ViewConfigPatch } from "@/components/app/screens/work-surface-controls"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
} from "@/components/ui/template-primitives"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getGroupFieldOptionLabel } from "@/components/app/screens/work-surface-controls"

const DOCS_CHIP_BASE =
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
const DOCS_CHIP_DEFAULT =
  "border-line bg-surface text-fg-2 hover:bg-surface-3 hover:text-foreground"
const DOCS_CHIP_SELECTED =
  "border-transparent bg-surface-3 text-foreground shadow-none"

function getDocsChipClassName(selected = false) {
  return cn(DOCS_CHIP_BASE, selected ? DOCS_CHIP_SELECTED : DOCS_CHIP_DEFAULT)
}

export function DocsFilterPopover({
  data,
  documents,
  onClearFilters,
  onToggleFilter,
  view,
}: {
  data: AppData
  documents: Document[]
  onClearFilters: () => void
  onToggleFilter: (key: ViewFilterKey, value: string) => void
  view: ViewDefinition
}) {
  const optionGroups = groupDocsFilterOptions(
    buildDocsFilterOptions(data, documents)
  )
  const count = getDocsFilterCount(view)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName(count > 0)}>
          <FunnelSimple className="size-3.5" />
          Filter
          {count > 0 ? (
            <span className="rounded-full bg-background/60 px-1 text-[10px]">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <DocsFilterOptionsList
          checkClassName="size-3.5 text-accent-fg"
          optionGroups={optionGroups}
          view={view}
          onToggleFilter={onToggleFilter}
        />
        <PropertyPopoverFoot>
          <span>{count} active</span>
          {count > 0 ? (
            <button
              type="button"
              className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
              onClick={onClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

export function DocsGroupPopover({
  onUpdateView,
  view,
}: {
  onUpdateView: (patch: ViewConfigPatch) => void
  view: ViewDefinition
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName()}>
          <TreeStructure className="size-3.5" />
          Group
          <span className="font-medium text-foreground">
            · {getGroupFieldOptionLabel(view.grouping)}
          </span>
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Group by</PropertyPopoverGroup>
          {DOCS_GROUP_OPTIONS.map((option) => {
            const selected = view.grouping === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() => onUpdateView({ grouping: option as GroupField })}
                trailing={
                  selected ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                {getGroupFieldOptionLabel(option)}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

export function DocsSortPopover({
  onUpdateView,
  view,
}: {
  onUpdateView: (patch: ViewConfigPatch) => void
  view: ViewDefinition
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={getDocsChipClassName()}>
          <SortAscending className="size-3.5" />
          <span>{DOCS_ORDERING_LABEL[view.ordering]}</span>
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
          {DOCS_ORDERING_OPTIONS.map((option) => {
            const selected = view.ordering === option

            return (
              <PropertyPopoverItem
                key={option}
                selected={selected}
                onClick={() =>
                  onUpdateView({ ordering: option as OrderingField })
                }
                trailing={
                  selected ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                {DOCS_ORDERING_LABEL[option]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}
