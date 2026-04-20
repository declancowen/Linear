"use client"

import { useState } from "react"
import {
  CaretDown,
  Check,
  Eye,
  FunnelSimple,
  MagnifyingGlass,
  Rows,
  SortAscending,
  SquaresFour,
} from "@phosphor-icons/react"

import type { ViewDefinition } from "@/lib/domain/types"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
  ViewTab,
} from "@/components/ui/template-primitives"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ViewsDirectoryGroupField = "none" | "entity" | "scope"
export type ViewsDirectorySortField = "updated" | "name" | "entity"
export type ViewsDirectoryProperty =
  | "description"
  | "scope"
  | "updated"
  | "configuration"
export type ViewsDirectoryScopeFilter = "workspace" | "team" | "personal"

export type ViewsDirectoryFilters = {
  entityKinds: ViewDefinition["entityKind"][]
  scopes: ViewsDirectoryScopeFilter[]
}

const chipBase =
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
const chipDefault =
  "border-line bg-surface text-fg-2 hover:text-foreground hover:bg-surface-3"
const chipSelected =
  "border-transparent bg-surface-3 text-foreground shadow-none hover:bg-surface-3"
const chipGhost =
  "border-transparent bg-transparent text-fg-2 hover:bg-surface-3 hover:text-foreground"

const GROUP_LABELS: Record<
  Exclude<ViewsDirectoryGroupField, "none">,
  string
> = {
  entity: "Entity",
  scope: "Scope",
}

const SORT_LABELS: Record<ViewsDirectorySortField, string> = {
  updated: "Updated",
  name: "Name",
  entity: "Entity",
}

const PROPERTY_LABELS: Record<ViewsDirectoryProperty, string> = {
  description: "Descriptions",
  scope: "Scope labels",
  updated: "Updated date",
  configuration: "Config badges",
}

const ENTITY_LABELS: Record<ViewDefinition["entityKind"], string> = {
  items: "Items",
  projects: "Projects",
  docs: "Docs",
}

const SCOPE_LABELS: Record<ViewsDirectoryScopeFilter, string> = {
  workspace: "Workspace",
  team: "Team",
  personal: "Personal",
}

export function ViewsDirectoryLayoutTabs({
  layout,
  onLayoutChange,
}: {
  layout: "list" | "board"
  onLayoutChange: (layout: "list" | "board") => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[
        {
          value: "list" as const,
          label: "List",
          icon: <Rows className="size-3.5" />,
        },
        {
          value: "board" as const,
          label: "Board",
          icon: <SquaresFour className="size-3.5" />,
        },
      ].map((tab) => (
        <ViewTab
          key={tab.value}
          active={layout === tab.value}
          onClick={() => onLayoutChange(tab.value)}
        >
          {tab.icon}
          {tab.label}
        </ViewTab>
      ))}
    </div>
  )
}

export function ViewsDirectoryFilterPopover({
  filters,
  availableEntityKinds,
  availableScopes,
  onToggleEntityKind,
  onToggleScope,
  onClearFilters,
}: {
  filters: ViewsDirectoryFilters
  availableEntityKinds: ViewDefinition["entityKind"][]
  availableScopes: ViewsDirectoryScopeFilter[]
  onToggleEntityKind: (entityKind: ViewDefinition["entityKind"]) => void
  onToggleScope: (scope: ViewsDirectoryScopeFilter) => void
  onClearFilters: () => void
}) {
  const [query, setQuery] = useState("")
  const activeCount = filters.entityKinds.length + filters.scopes.length
  const normalizedQuery = query.trim().toLowerCase()

  function matches(label: string) {
    if (!normalizedQuery) {
      return true
    }

    return label.toLowerCase().includes(normalizedQuery)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(chipBase, activeCount > 0 ? chipSelected : chipDefault)}
        >
          <FunnelSimple className="size-3.5" />
          <span>Filter</span>
          {activeCount > 0 ? (
            <span className="ml-0.5 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-3.5" />}
          placeholder="Filter values…"
          value={query}
          onChange={setQuery}
        />
        <PropertyPopoverList>
          <PropertyPopoverGroup>Entity</PropertyPopoverGroup>
          {availableEntityKinds
            .filter((entityKind) => matches(ENTITY_LABELS[entityKind]))
            .map((entityKind) => {
              const active = filters.entityKinds.includes(entityKind)
              return (
                <PropertyPopoverItem
                  key={entityKind}
                  selected={active}
                  onClick={() => onToggleEntityKind(entityKind)}
                  trailing={
                    active ? (
                      <Check className="size-3.5 text-accent-fg" />
                    ) : null
                  }
                >
                  {ENTITY_LABELS[entityKind]}
                </PropertyPopoverItem>
              )
            })}
          {availableScopes.length > 0 ? (
            <>
              <PropertyPopoverGroup>Scope</PropertyPopoverGroup>
              {availableScopes
                .filter((scope) => matches(SCOPE_LABELS[scope]))
                .map((scope) => {
                  const active = filters.scopes.includes(scope)
                  return (
                    <PropertyPopoverItem
                      key={scope}
                      selected={active}
                      onClick={() => onToggleScope(scope)}
                      trailing={
                        active ? (
                          <Check className="size-3.5 text-accent-fg" />
                        ) : null
                      }
                    >
                      {SCOPE_LABELS[scope]}
                    </PropertyPopoverItem>
                  )
                })}
            </>
          ) : null}
        </PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>Filter the saved views directory</span>
          {activeCount > 0 ? (
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

export function ViewsDirectoryGroupChipPopover({
  grouping,
  subGrouping,
  onGroupingChange,
  onSubGroupingChange,
}: {
  grouping: ViewsDirectoryGroupField
  subGrouping: ViewsDirectoryGroupField
  onGroupingChange: (grouping: ViewsDirectoryGroupField) => void
  onSubGroupingChange: (grouping: ViewsDirectoryGroupField) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, chipDefault)}>
          <span>Group</span>
          {grouping !== "none" ? (
            <span className="font-semibold">· {GROUP_LABELS[grouping]}</span>
          ) : null}
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[320px]")}
      >
        <div className="grid grid-cols-2 divide-x divide-line-soft">
          <div className="flex min-w-0 flex-col">
            <PropertyPopoverGroup>Group by</PropertyPopoverGroup>
            <div className="flex flex-col p-1">
              <PropertyPopoverItem
                selected={grouping === "none"}
                onClick={() => onGroupingChange("none")}
                trailing={
                  grouping === "none" ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                None
              </PropertyPopoverItem>
              {(
                Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>
              ).map((field) => (
                <PropertyPopoverItem
                  key={field}
                  selected={grouping === field}
                  onClick={() => onGroupingChange(field)}
                  trailing={
                    grouping === field ? (
                      <Check className="size-3.5 text-accent-fg" />
                    ) : null
                  }
                >
                  {GROUP_LABELS[field]}
                </PropertyPopoverItem>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <PropertyPopoverGroup>Sub-group</PropertyPopoverGroup>
            <div className="flex flex-col p-1">
              <PropertyPopoverItem
                selected={subGrouping === "none"}
                onClick={() => onSubGroupingChange("none")}
                trailing={
                  subGrouping === "none" ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                None
              </PropertyPopoverItem>
              {(
                Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>
              ).map((field) => {
                const disabled = field === grouping
                const active = subGrouping === field
                return (
                  <PropertyPopoverItem
                    key={`sub-${field}`}
                    selected={active}
                    muted={disabled}
                    onClick={() => {
                      if (disabled) {
                        return
                      }
                      onSubGroupingChange(field)
                    }}
                    trailing={
                      active ? (
                        <Check className="size-3.5 text-accent-fg" />
                      ) : null
                    }
                  >
                    {GROUP_LABELS[field]}
                  </PropertyPopoverItem>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ViewsDirectorySortChipPopover({
  sortBy,
  onSortByChange,
}: {
  sortBy: ViewsDirectorySortField
  onSortByChange: (sortBy: ViewsDirectorySortField) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, chipDefault)}>
          <SortAscending className="size-3.5" />
          <span>{SORT_LABELS[sortBy]}</span>
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Sort by</PropertyPopoverGroup>
          {(Object.keys(SORT_LABELS) as ViewsDirectorySortField[]).map(
            (field) => {
              const active = sortBy === field
              return (
                <PropertyPopoverItem
                  key={field}
                  selected={active}
                  onClick={() => onSortByChange(field)}
                  trailing={
                    active ? (
                      <Check className="size-3.5 text-accent-fg" />
                    ) : null
                  }
                >
                  {SORT_LABELS[field]}
                </PropertyPopoverItem>
              )
            }
          )}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

export function ViewsDirectoryPropertiesChipPopover({
  properties,
  onToggleProperty,
  onClearProperties,
}: {
  properties: ViewsDirectoryProperty[]
  onToggleProperty: (property: ViewsDirectoryProperty) => void
  onClearProperties: () => void
}) {
  const [query, setQuery] = useState("")
  const filtered = (
    Object.keys(PROPERTY_LABELS) as Array<keyof typeof PROPERTY_LABELS>
  ).filter((property) =>
    PROPERTY_LABELS[property].toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chipBase,
            properties.length > 0 ? chipSelected : chipGhost
          )}
        >
          <Eye className="size-3.5" />
          <span>Properties</span>
          <span className="ml-0.5 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
            {properties.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-3.5" />}
          placeholder="Filter properties…"
          value={query}
          onChange={setQuery}
        />
        <PropertyPopoverList>
          <PropertyPopoverGroup>
            Visible · {properties.length}
          </PropertyPopoverGroup>
          {filtered.map((property) => {
            const active = properties.includes(property)
            return (
              <PropertyPopoverItem
                key={property}
                selected={active}
                onClick={() => onToggleProperty(property)}
                trailing={
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                {PROPERTY_LABELS[property]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>Show or hide saved-view metadata</span>
          {properties.length > 0 ? (
            <button
              type="button"
              className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
              onClick={onClearProperties}
            >
              Reset
            </button>
          ) : null}
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}
