"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { GearSix, Kanban, CaretDown, CaretRight, Rows, Check, CheckCircle, Circle, CodesandboxLogo, NotePencil, Flame } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import { getLabelsForTeamScope } from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  statusMeta,
  type AppData,
  type Document,
  type GroupField,
  type Priority,
  type ViewDefinition,
  type WorkItem,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { StatusRing } from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

export const PROPERTY_SELECT_SEPARATOR_VALUE = "__separator__"

export const SCREEN_HEADER_CLASS_NAME =
  "flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2"

export function ScreenHeader({
  title,
  icon,
  actions,
}: {
  title: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className={SCREEN_HEADER_CLASS_NAME}>
      <HeaderTitle icon={icon} title={title} />
      {actions}
    </div>
  )
}

export function ViewsDisplaySettingsPopover({
  layout,
  onLayoutChange,
  sortBy,
  showDescriptions,
  onSortByChange,
  onShowDescriptionsChange,
}: {
  layout: "list" | "board"
  onLayoutChange: (value: "list" | "board") => void
  sortBy: "updated" | "name" | "entity"
  showDescriptions: boolean
  onSortByChange: (value: "updated" | "name" | "entity") => void
  onShowDescriptionsChange: (value: boolean) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="border-b px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
            {[
              { value: "list", label: "List", icon: <Rows className="size-3" /> },
              {
                value: "board",
                label: "Board",
                icon: <Kanban className="size-3" />,
              },
            ].map((option) => (
              <button
                key={option.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  layout === option.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  onLayoutChange(option.value as "list" | "board")
                }
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col px-3 py-2">
          <ConfigSelect
            label="Sort by"
            value={sortBy}
            options={[
              { value: "updated", label: "Updated" },
              { value: "name", label: "Name" },
              { value: "entity", label: "Entity" },
            ]}
            onValueChange={(value) =>
              onSortByChange(value as "updated" | "name" | "entity")
            }
          />
          <ConfigSelect
            label="Details"
            value={showDescriptions ? "show" : "hide"}
            options={[
              { value: "show", label: "Visible" },
              { value: "hide", label: "Hidden" },
            ]}
            onValueChange={(value) =>
              onShowDescriptionsChange(value === "show")
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CollectionDisplaySettingsPopover({
  layout,
  onLayoutChange,
  extraAction,
}: {
  layout: "list" | "board"
  onLayoutChange: (layout: "list" | "board") => void
  extraAction?: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-0">
        <div className="px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
            {[
              { value: "list", label: "List", icon: <Rows className="size-3" /> },
              { value: "board", label: "Grid", icon: <Kanban className="size-3" /> },
            ].map((option) => (
              <button
                key={option.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  layout === option.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  onLayoutChange(option.value as "list" | "board")
                }
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {extraAction ? (
          <>
            <Separator />
            <div className="px-3 py-2">{extraAction}</div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function HeaderTitle({
  icon,
  title,
}: {
  icon?: ReactNode
  title: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <SidebarTrigger className="size-5 shrink-0" />
      {icon ? (
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      ) : null}
      <h1 className="truncate text-sm font-medium">{title}</h1>
    </div>
  )
}

export function StatusIcon({ status }: { status: string }) {
  const statusLower = status.toLowerCase()
  if (statusLower === "done" || statusLower === "completed") {
    return (
      <span className="relative inline-grid size-3.5 shrink-0 place-items-center">
        <StatusRing status="done" className="size-3.5" />
        <Check
          className="pointer-events-none absolute size-[7px]"
          style={{ color: "white" }}
          weight="bold"
        />
      </span>
    )
  }
  if (statusLower === "in-progress" || statusLower === "in progress") {
    return <StatusRing status="in-progress" className="size-3.5" />
  }
  if (statusLower === "in-review" || statusLower === "in review") {
    return (
      <Circle className="size-3.5 shrink-0 text-status-review" weight="fill" />
    )
  }
  if (statusLower === "cancelled") {
    return <StatusRing status="cancelled" className="size-3.5" />
  }
  if (statusLower === "todo") {
    return <StatusRing status="todo" className="size-3.5" />
  }
  if (statusLower === "duplicate") {
    return <StatusRing status="duplicate" className="size-3.5" />
  }

  return <StatusRing status="backlog" className="size-3.5 opacity-70" />
}

const PRIORITY_ICON_TOKEN: Record<Priority, string> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
  none: "var(--text-3)",
}

export function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === "none") {
    return (
      <Circle
        className="size-[14px] shrink-0"
        style={{ color: PRIORITY_ICON_TOKEN.none }}
      />
    )
  }

  return (
    <Flame
      className="size-[14px] shrink-0"
      weight="fill"
      style={{ color: PRIORITY_ICON_TOKEN[priority] }}
    />
  )
}

export function buildPropertyStatusOptions(statuses: WorkStatus[]) {
  const firstTerminalStatusIndex = statuses.findIndex(
    (status) =>
      status === "done" || status === "cancelled" || status === "duplicate"
  )

  return statuses.flatMap((status, index) => [
    ...(index === firstTerminalStatusIndex
      ? [{ value: PROPERTY_SELECT_SEPARATOR_VALUE, label: "" }]
      : []),
    {
      value: status,
      label: statusMeta[status].label,
    },
  ])
}

function getPriorityDotClassName(priority: string) {
  if (priority === "urgent") return "bg-priority-urgent"
  if (priority === "high") return "bg-priority-high"
  if (priority === "medium") return "bg-priority-medium"
  if (priority === "low") return "bg-priority-low"
  return "bg-muted-foreground/30"
}

export function PriorityDot({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-2 shrink-0 rounded-full",
        getPriorityDotClassName(priority)
      )}
    />
  )
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  layout = "stack",
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  layout?: "stack" | "grid"
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col">
      <button
        className="flex items-center gap-2 pt-4 pb-2 text-[11.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <CaretDown className="size-3" />
        ) : (
          <CaretRight className="size-3" />
        )}
        {title}
      </button>
      {open ? (
        layout === "grid" ? (
          <dl className="mt-1 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
            {children}
          </dl>
        ) : (
          <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>
        )
      ) : null}
    </div>
  )
}

export function PropertySelect({
  accessibleLabel,
  label,
  value,
  options,
  onValueChange,
  disabled,
  renderValue,
  renderOption,
}: {
  accessibleLabel?: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
  renderValue?: (value: string, label: string) => ReactNode
  renderOption?: (value: string, label: string) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [activeValue, setActiveValue] = useState(value)
  const listboxId = useId()
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const typeaheadBufferRef = useRef("")
  const typeaheadResetTimeoutRef = useRef<number | null>(null)
  const selectableOptions = useMemo(
    () =>
      options.filter(
        (option) => option.value !== PROPERTY_SELECT_SEPARATOR_VALUE
      ),
    [options]
  )
  const selectedOption =
    selectableOptions.find((option) => option.value === value) ?? null
  const selectedValue = selectedOption?.value ?? value
  const selectedLabel = selectedOption?.label ?? value
  const resolvedAccessibleLabel = accessibleLabel ?? (label || "Project")

  useEffect(() => {
    if (!open || !activeValue) {
      return
    }

    optionRefs.current[activeValue]?.focus()
  }, [activeValue, open])

  useEffect(() => {
    return () => {
      if (typeaheadResetTimeoutRef.current !== null) {
        window.clearTimeout(typeaheadResetTimeoutRef.current)
      }
    }
  }, [])

  function resetTypeaheadBuffer() {
    if (typeaheadResetTimeoutRef.current !== null) {
      window.clearTimeout(typeaheadResetTimeoutRef.current)
    }

    typeaheadResetTimeoutRef.current = window.setTimeout(() => {
      typeaheadBufferRef.current = ""
      typeaheadResetTimeoutRef.current = null
    }, 500)
  }

  function moveActiveOption(direction: 1 | -1) {
    if (selectableOptions.length === 0) {
      return
    }

    const currentIndex = selectableOptions.findIndex(
      (option) => option.value === activeValue
    )
    const baseIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex =
      (baseIndex + direction + selectableOptions.length) %
      selectableOptions.length
    const nextValue = selectableOptions[nextIndex]?.value

    if (nextValue) {
      setActiveValue(nextValue)
    }
  }

  function moveToBoundaryOption(boundary: "first" | "last") {
    const nextValue =
      boundary === "first"
        ? selectableOptions[0]?.value
        : selectableOptions[selectableOptions.length - 1]?.value

    if (nextValue) {
      setActiveValue(nextValue)
    }
  }

  function selectOption(nextValue: string) {
    setOpen(false)
    onValueChange(nextValue)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setActiveValue(
        selectableOptions.some((option) => option.value === selectedValue)
          ? selectedValue
          : selectableOptions[0]?.value ?? ""
      )
    }

    setOpen(nextOpen)
  }

  function handleTypeahead(key: string) {
    if (!key || key.length !== 1 || selectableOptions.length === 0) {
      return
    }

    typeaheadBufferRef.current += key.toLowerCase()
    resetTypeaheadBuffer()

    const currentIndex = selectableOptions.findIndex(
      (option) => option.value === activeValue
    )
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0
    const orderedOptions = [
      ...selectableOptions.slice(startIndex),
      ...selectableOptions.slice(0, startIndex),
    ]
    const match = orderedOptions.find((option) =>
      option.label.toLowerCase().startsWith(typeaheadBufferRef.current)
    )

    if (match) {
      setActiveValue(match.value)
    }
  }

  function handleListboxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        moveActiveOption(1)
        return
      case "ArrowUp":
        event.preventDefault()
        moveActiveOption(-1)
        return
      case "Home":
        event.preventDefault()
        moveToBoundaryOption("first")
        return
      case "End":
        event.preventDefault()
        moveToBoundaryOption("last")
        return
      case "Enter":
      case " ":
        if (!activeValue) {
          return
        }

        event.preventDefault()
        selectOption(activeValue)
        return
      default:
        if (
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          handleTypeahead(event.key)
        }
    }
  }

  const trigger = (
    <Popover
      open={disabled ? false : open}
      onOpenChange={disabled ? undefined : handleOpenChange}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={resolvedAccessibleLabel}
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-foreground transition-colors focus-visible:ring-0 focus-visible:outline-none",
            disabled
              ? "cursor-not-allowed text-fg-4 hover:bg-transparent"
              : "cursor-pointer hover:bg-surface-3"
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {renderValue ? (
              renderValue(selectedValue, selectedLabel)
            ) : (
              <span className="truncate">{selectedLabel}</span>
            )}
          </span>
          <CaretDown className="size-3 shrink-0 text-fg-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[280px] overflow-hidden rounded-lg border border-line bg-surface p-0 shadow-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label={resolvedAccessibleLabel}
          className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1"
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) =>
            option.value === PROPERTY_SELECT_SEPARATOR_VALUE ? (
              <div
                key={`separator-${index}`}
                className="my-1 h-px bg-line-soft"
              />
            ) : (
              <button
                key={option.value}
                type="button"
                ref={(element) => {
                  optionRefs.current[option.value] = element
                }}
                id={`${listboxId}-${option.value}`}
                role="option"
                aria-selected={option.value === selectedValue}
                tabIndex={option.value === activeValue ? 0 : -1}
                className={cn(
                  "flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
                  option.value === activeValue &&
                    "bg-surface-3 text-foreground"
                )}
                onFocus={() => setActiveValue(option.value)}
                onClick={() => {
                  selectOption(option.value)
                }}
              >
                <span className="min-w-0 flex-1">
                  {renderOption
                    ? renderOption(option.value, option.label)
                    : option.label}
                </span>
                {option.value === selectedValue ? (
                  <CheckCircle
                    className="size-3.5 shrink-0 text-accent-fg"
                    weight="fill"
                  />
                ) : null}
              </button>
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  )

  if (label) {
    return (
      <>
        <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
          {label}
        </dt>
        <dd className="m-0">{trigger}</dd>
      </>
    )
  }

  return (
    <dd className="col-span-2 m-0">
      {trigger}
    </dd>
  )
}

export function WorkItemLabelsEditor({
  item,
  editable,
}: {
  item: WorkItem
  editable: boolean
}) {
  const itemWorkspaceId = useAppStore(
    (state) => state.teams.find((team) => team.id === item.teamId)?.workspaceId ?? null
  )
  const availableLabels = useAppStore(
    useShallow((state) =>
      [...getLabelsForTeamScope(state, item.teamId)].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    )
  )
  const [newLabelName, setNewLabelName] = useState("")
  const selectedLabels = availableLabels.filter((label) =>
    item.labelIds.includes(label.id)
  )

  function toggleLabel(labelId: string) {
    const nextLabelIds = item.labelIds.includes(labelId)
      ? item.labelIds.filter((currentId) => currentId !== labelId)
      : [...item.labelIds, labelId]

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: nextLabelIds,
    })
  }

  async function handleCreateLabel() {
    const created = await useAppStore
      .getState()
      .createLabel(newLabelName, itemWorkspaceId)

    if (!created) {
      return
    }

    setNewLabelName("")

    const latestItem =
      useAppStore.getState().workItems.find((entry) => entry.id === item.id) ??
      item

    if (latestItem.labelIds.includes(created.id)) {
      return
    }

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: [...latestItem.labelIds, created.id],
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((label) => (
            <Badge key={label.id} variant="secondary" className="h-5 px-2">
              {label.name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">No labels</span>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={!editable}
          >
            Manage labels
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Labels
              </div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {availableLabels.length > 0 ? (
                  availableLabels.map((label) => {
                    const selected = item.labelIds.includes(label.id)

                    return (
                      <button
                        key={label.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => toggleLabel(label.id)}
                        disabled={!editable}
                      >
                        {label.name}
                      </button>
                    )
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No labels yet
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                New label
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Add label"
                  disabled={!editable}
                  className="h-8"
                />
                <Button
                  size="sm"
                  disabled={!editable || newLabelName.trim().length === 0}
                  onClick={() => void handleCreateLabel()}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function PropertyRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        {label}
      </dt>
      <dd className="m-0 flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 text-foreground">
        <span className="truncate">{value}</span>
      </dd>
    </>
  )
}

export function PropertyDateField({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}) {
  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
          !disabled && "hover:bg-surface-3"
        )}
      >
        <Input
          type="date"
          disabled={disabled}
          value={value ? value.slice(0, 10) : ""}
          onChange={(event) =>
            onValueChange(
              event.target.value
                ? `${event.target.value}T00:00:00.000Z`
                : null
            )
          }
          className="h-6 w-full border-none bg-transparent px-0 text-[12.5px] text-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </dd>
    </>
  )
}

export function ConfigSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-6 w-auto min-w-24 border-none bg-transparent text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-primary/30 bg-primary/10 font-medium text-foreground"
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function MissingState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: ElementType
  title: string
  subtitle?: string
}) {
  if (!Icon && !subtitle) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {title}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center justify-center text-center">
        {Icon ? <Icon className="size-8 text-muted-foreground/30" /> : null}
        <div className="mt-3 text-sm font-medium">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </div>
  )
}

export function formatEntityKind(entityKind: ViewDefinition["entityKind"]) {
  if (entityKind === "items") {
    return "Items"
  }

  if (entityKind === "projects") {
    return "Projects"
  }

  return "Docs"
}

export function getEntityKindIcon(entityKind: ViewDefinition["entityKind"]) {
  if (entityKind === "items") {
    return <CodesandboxLogo className="size-4" />
  }

  if (entityKind === "projects") {
    return <Kanban className="size-4" />
  }

  return <NotePencil className="size-4" />
}

function extractTextContent(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getDocumentPreview(
  document: Pick<Document, "content" | "title" | "previewText">
) {
  if (document.previewText && document.previewText.trim().length > 0) {
    return document.previewText.trim()
  }

  const rawPreview = extractTextContent(document.content)
  const preview = rawPreview.startsWith(document.title)
    ? rawPreview.slice(document.title.length).trim()
    : rawPreview

  return preview.length > 0 ? preview : ""
}

export function getPatchForField(
  data: AppData,
  item: WorkItem | null,
  field: GroupField | null,
  value: string
) {
  if (!field || value === "all") return {}
  if (field === "status") return { status: value as WorkItem["status"] }
  if (field === "priority") return { priority: value as Priority }
  if (field === "assignee") {
    const user = data.users.find((entry) => entry.name === value)
    return { assigneeId: user?.id ?? null }
  }
  if (field === "project") {
    const project = data.projects.find((entry) => entry.name === value)
    return { primaryProjectId: project?.id ?? null }
  }
  if (field === "label" && item) {
    if (value === "No label") {
      return { labelIds: [] }
    }

    const label = getLabelsForTeamScope(data, item.teamId).find(
      (entry) => entry.name === value
    )

    if (!label) {
      return {}
    }

    return {
      labelIds: [label.id, ...item.labelIds.filter((id) => id !== label.id)],
    }
  }
  if ((field === "epic" || field === "feature") && item) {
    const emptyValue = `No ${field}`

    if (value === emptyValue) {
      return {}
    }

    const parent = data.workItems.find(
      (entry) =>
        entry.type === field && `${entry.key} · ${entry.title}` === value
    )

    if (!parent || !canParentWorkItemTypeAcceptChild(parent.type, item.type)) {
      return {}
    }

    return { parentId: parent.id }
  }
  return {}
}
