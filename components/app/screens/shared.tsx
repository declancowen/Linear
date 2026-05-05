"use client"

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import {
  GearSix,
  Kanban,
  CaretDown,
  CaretRight,
  Rows,
  Check,
  CheckCircle,
  Circle,
  CodesandboxLogo,
  NotePencil,
  Flame,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import { getLabelsForTeamScope } from "@/lib/domain/selectors"
import {
  getTextInputLimitState,
  labelNameConstraints,
} from "@/lib/domain/input-constraints"
import {
  canParentWorkItemTypeAcceptChild,
  getSingleChildWorkItemType,
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
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
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

export type PropertySelectOption = { value: string; label: string }
export type PropertySelectRender = (value: string, label: string) => ReactNode

export type PropertySelectCommonProps = {
  value: string
  options: PropertySelectOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  renderValue?: PropertySelectRender
  renderOption?: PropertySelectRender
}

function isListboxSelectKey(key: string) {
  return key === "Enter" || key === " "
}

function isTypeaheadKeyEvent(event: KeyboardEvent<HTMLDivElement>) {
  return (
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  )
}

export function getSelectedPropertySelectOption(
  options: PropertySelectOption[],
  value: string
) {
  return (
    options.find((option) => option.value === value) ??
    options.find((option) => option.value !== PROPERTY_SELECT_SEPARATOR_VALUE) ??
    null
  )
}

export const SCREEN_HEADER_CLASS_NAME =
  "flex min-h-10 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-2"

const LABEL_COLOR_TOKENS: Record<string, string> = {
  rose: "var(--label-1)",
  amber: "var(--label-2)",
  orange: "var(--label-2)",
  emerald: "var(--label-3)",
  blue: "var(--label-4)",
  cyan: "var(--label-4)",
  indigo: "var(--label-5)",
  violet: "var(--label-5)",
}

function getLabelColorValue(color?: string | null) {
  if (!color) {
    return "var(--fg-4)"
  }

  return LABEL_COLOR_TOKENS[color] ?? color
}

export function LabelColorDot({
  color,
  className,
}: {
  color?: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      data-label-color={color ?? undefined}
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: getLabelColorValue(color) }}
    />
  )
}

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

function LayoutSegmentedControl({
  boardLabel,
  layout,
  onLayoutChange,
}: {
  boardLabel: string
  layout: "list" | "board"
  onLayoutChange: (layout: "list" | "board") => void
}) {
  return (
    <div className="flex rounded-md bg-muted/50 p-0.5">
      {[
        {
          value: "list" as const,
          label: "List",
          icon: <Rows className="size-3" />,
        },
        {
          value: "board" as const,
          label: boardLabel,
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
          onClick={() => onLayoutChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
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
          <LayoutSegmentedControl
            boardLabel="Board"
            layout={layout}
            onLayoutChange={onLayoutChange}
          />
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
          <LayoutSegmentedControl
            boardLabel="Grid"
            layout={layout}
            onLayoutChange={onLayoutChange}
          />
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
  const iconStatus = getStatusIconStatus(status)

  if (iconStatus === "done") {
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

  if (iconStatus === "review") {
    return (
      <Circle className="size-3.5 shrink-0 text-status-review" weight="fill" />
    )
  }

  return (
    <StatusRing
      status={iconStatus}
      className={cn("size-3.5", iconStatus === "backlog" && "opacity-70")}
    />
  )
}

type StatusIconRingStatus =
  | "backlog"
  | "todo"
  | "in-progress"
  | "done"
  | "cancelled"
  | "duplicate"
type StatusIconStatus = StatusIconRingStatus | "review"

const STATUS_ICON_STATUS_BY_LABEL: Record<string, StatusIconStatus> = {
  backlog: "backlog",
  todo: "todo",
  done: "done",
  completed: "done",
  "in-progress": "in-progress",
  "in progress": "in-progress",
  "in-review": "review",
  "in review": "review",
  cancelled: "cancelled",
  duplicate: "duplicate",
}

function getStatusIconStatus(status: string): StatusIconStatus {
  return STATUS_ICON_STATUS_BY_LABEL[status.toLowerCase()] ?? "backlog"
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

export function WorkItemTypeIcon({
  itemType,
  className,
}: {
  itemType: WorkItem["type"]
  className?: string
}) {
  if (itemType === "task" || itemType === "sub-task") {
    return (
      <CheckCircle
        className={cn("size-[14px] shrink-0 text-fg-3", className)}
        weight="fill"
      />
    )
  }

  if (itemType === "issue" || itemType === "sub-issue") {
    return (
      <Circle
        className={cn("size-[14px] shrink-0 text-fg-3", className)}
        weight="fill"
      />
    )
  }

  return (
    <CodesandboxLogo
      className={cn("size-[14px] shrink-0 text-fg-3", className)}
      weight="fill"
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
} & PropertySelectCommonProps) {
  const controller = usePropertySelectController({
    accessibleLabel,
    label,
    onValueChange,
    options,
    value,
  })
  const trigger = (
    <PropertySelectPopover
      controller={controller}
      disabled={disabled}
      options={options}
      renderOption={renderOption}
      renderValue={renderValue}
    />
  )

  if (label) {
    return (
      <PropertySelectDefinitionRow label={label}>
        {trigger}
      </PropertySelectDefinitionRow>
    )
  }

  return <dd className="col-span-2 m-0">{trigger}</dd>
}

function usePropertySelectController({
  accessibleLabel,
  label,
  value,
  options,
  onValueChange,
}: {
  accessibleLabel?: string
  label: string
  value: string
  options: PropertySelectOption[]
  onValueChange: (value: string) => void
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

  function setOptionRef(value: string, element: HTMLButtonElement | null) {
    optionRefs.current[value] = element
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setActiveValue(
        selectableOptions.some((option) => option.value === selectedValue)
          ? selectedValue
          : (selectableOptions[0]?.value ?? "")
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

  const listboxNavigationHandlers: Partial<Record<string, () => void>> = {
    ArrowDown: () => moveActiveOption(1),
    ArrowUp: () => moveActiveOption(-1),
    Home: () => moveToBoundaryOption("first"),
    End: () => moveToBoundaryOption("last"),
  }

  function handleListboxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const navigationHandler = listboxNavigationHandlers[event.key]

    if (navigationHandler) {
      event.preventDefault()
      navigationHandler()
      return
    }

    if (isListboxSelectKey(event.key) && activeValue) {
      event.preventDefault()
      selectOption(activeValue)
      return
    }

    if (isTypeaheadKeyEvent(event)) {
      handleTypeahead(event.key)
    }
  }

  return {
    activeValue,
    handleListboxKeyDown,
    handleOpenChange,
    listboxId,
    open,
    resolvedAccessibleLabel,
    selectOption,
    selectedLabel,
    selectedValue,
    setActiveValue,
    setOptionRef,
  }
}

type PropertySelectController = ReturnType<typeof usePropertySelectController>

function PropertySelectPopover({
  controller,
  disabled,
  options,
  renderOption,
  renderValue,
}: {
  controller: PropertySelectController
  disabled?: boolean
  options: PropertySelectOption[]
  renderOption?: PropertySelectRender
  renderValue?: PropertySelectRender
}) {
  return (
    <Popover
      open={disabled ? false : controller.open}
      onOpenChange={disabled ? undefined : controller.handleOpenChange}
    >
      <PopoverTrigger asChild>
        <PropertySelectTriggerButton
          controller={controller}
          disabled={disabled}
          renderValue={renderValue}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[280px] overflow-hidden rounded-lg border border-line bg-surface p-0 shadow-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <PropertySelectListbox
          controller={controller}
          options={options}
          renderOption={renderOption}
        />
      </PopoverContent>
    </Popover>
  )
}

const PropertySelectTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    controller: PropertySelectController
    disabled?: boolean
    renderValue?: PropertySelectRender
  } & ComponentPropsWithoutRef<"button">
>(function PropertySelectTriggerButton(
  { className, controller, disabled, renderValue, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label={controller.resolvedAccessibleLabel}
      aria-controls={controller.open ? controller.listboxId : undefined}
      aria-expanded={controller.open}
      aria-haspopup="listbox"
      disabled={disabled}
      className={cn(
        "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-foreground transition-colors focus-visible:ring-0 focus-visible:outline-none",
        disabled
          ? "cursor-not-allowed text-fg-4 hover:bg-transparent"
          : "cursor-pointer hover:bg-surface-3",
        className
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {renderValue ? (
          renderValue(controller.selectedValue, controller.selectedLabel)
        ) : (
          <span className="truncate">{controller.selectedLabel}</span>
        )}
      </span>
      <CaretDown className="size-3 shrink-0 text-fg-4" />
    </button>
  )
})

function PropertySelectListbox({
  controller,
  options,
  renderOption,
}: {
  controller: PropertySelectController
  options: PropertySelectOption[]
  renderOption?: PropertySelectRender
}) {
  return (
    <div
      id={controller.listboxId}
      role="listbox"
      aria-label={controller.resolvedAccessibleLabel}
      className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1"
      onKeyDown={controller.handleListboxKeyDown}
    >
      {options.map((option, index) => (
        <PropertySelectOptionEntry
          key={option.value === PROPERTY_SELECT_SEPARATOR_VALUE ? index : option.value}
          controller={controller}
          index={index}
          option={option}
          renderOption={renderOption}
        />
      ))}
    </div>
  )
}

function PropertySelectOptionEntry({
  controller,
  index,
  option,
  renderOption,
}: {
  controller: PropertySelectController
  index: number
  option: PropertySelectOption
  renderOption?: PropertySelectRender
}) {
  if (option.value === PROPERTY_SELECT_SEPARATOR_VALUE) {
    return (
      <div key={`separator-${index}`} className="my-1 h-px bg-line-soft" />
    )
  }

  return (
    <button
      type="button"
      ref={(element) => {
        controller.setOptionRef(option.value, element)
      }}
      id={`${controller.listboxId}-${option.value}`}
      role="option"
      aria-selected={option.value === controller.selectedValue}
      tabIndex={option.value === controller.activeValue ? 0 : -1}
      className={cn(
        "flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
        option.value === controller.activeValue && "bg-surface-3 text-foreground"
      )}
      onFocus={() => controller.setActiveValue(option.value)}
      onClick={() => {
        controller.selectOption(option.value)
      }}
    >
      <span className="min-w-0 flex-1">
        {renderOption ? renderOption(option.value, option.label) : option.label}
      </span>
      {option.value === controller.selectedValue ? (
        <CheckCircle className="size-3.5 shrink-0 text-accent-fg" weight="fill" />
      ) : null}
    </button>
  )
}

function PropertySelectDefinitionRow({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <>
      <dt className="flex items-center gap-2 self-center py-1.5 text-fg-3">
        {label}
      </dt>
      <dd className="m-0">{children}</dd>
    </>
  )
}

export function useWorkItemLabelEditorState({
  item,
  labels,
  requireWorkspace,
  requireTrimmedName,
  workspaceId,
}: {
  item: WorkItem
  labels: AppData["labels"]
  requireWorkspace?: boolean
  requireTrimmedName?: boolean
  workspaceId: string | null | undefined
}) {
  const [newLabelName, setNewLabelName] = useState("")
  const labelNameLimitState = getTextInputLimitState(
    newLabelName,
    labelNameConstraints
  )
  const selectedLabels = labels.filter((label) => item.labelIds.includes(label.id))

  function toggleLabel(labelId: string) {
    const nextLabelIds = item.labelIds.includes(labelId)
      ? item.labelIds.filter((currentId) => currentId !== labelId)
      : [...item.labelIds, labelId]

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: nextLabelIds,
    })
  }

  async function handleCreateLabel() {
    if (
      !canCreateWorkItemLabel({
        labelNameLimitState,
        newLabelName,
        requireTrimmedName,
        requireWorkspace,
        workspaceId,
      })
    ) {
      return
    }

    const created = await useAppStore
      .getState()
      .createLabel(newLabelName, workspaceId ?? null)

    if (!created) {
      return
    }

    const latestItem =
      useAppStore.getState().workItems.find((entry) => entry.id === item.id) ??
      item

    setNewLabelName("")

    if (latestItem.labelIds.includes(created.id)) {
      return
    }

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: [...latestItem.labelIds, created.id],
    })
  }

  return {
    handleCreateLabel,
    labelNameLimitState,
    newLabelName,
    selectedLabels,
    setNewLabelName,
    toggleLabel,
  }
}

function canCreateWorkItemLabel({
  labelNameLimitState,
  newLabelName,
  requireTrimmedName,
  requireWorkspace,
  workspaceId,
}: {
  labelNameLimitState: ReturnType<typeof getTextInputLimitState>
  newLabelName: string
  requireTrimmedName?: boolean
  requireWorkspace?: boolean
  workspaceId: string | null | undefined
}) {
  if (!labelNameLimitState.canSubmit) {
    return false
  }

  if (requireWorkspace && !workspaceId) {
    return false
  }

  return !(requireTrimmedName && newLabelName.trim().length === 0)
}

export function WorkItemLabelsEditor({
  item,
  editable,
}: {
  item: WorkItem
  editable: boolean
}) {
  const itemWorkspaceId = useAppStore(
    (state) =>
      state.teams.find((team) => team.id === item.teamId)?.workspaceId ?? null
  )
  const availableLabels = useAppStore(
    useShallow((state) =>
      [...getLabelsForTeamScope(state, item.teamId)].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    )
  )
  const {
    handleCreateLabel,
    labelNameLimitState: newLabelNameLimitState,
    newLabelName,
    selectedLabels,
    setNewLabelName,
    toggleLabel,
  } = useWorkItemLabelEditorState({
    item,
    labels: availableLabels,
    workspaceId: itemWorkspaceId,
  })

  return (
    <div className="flex flex-col gap-2">
      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((label) => (
            <Badge
              key={label.id}
              variant="secondary"
              className="h-5 gap-1.5 px-2"
            >
              <LabelColorDot color={label.color} className="size-1.5" />
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
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => toggleLabel(label.id)}
                        disabled={!editable}
                      >
                        <LabelColorDot
                          color={label.color}
                          className="size-1.5"
                        />
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
                  maxLength={labelNameConstraints.max}
                  disabled={!editable}
                  className="h-8"
                />
                <Button
                  size="sm"
                  disabled={!editable || !newLabelNameLimitState.canSubmit}
                  onClick={() => void handleCreateLabel()}
                >
                  Create
                </Button>
              </div>
              <FieldCharacterLimit
                state={newLabelNameLimitState}
                limit={labelNameConstraints.max}
                className="mt-1"
              />
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
              event.target.value ? `${event.target.value}T00:00:00.000Z` : null
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

function getScalarPatchForField(field: GroupField, value: string) {
  if (field === "status") {
    return { status: value as WorkItem["status"] }
  }

  if (field === "priority") {
    return { priority: value as Priority }
  }

  return null
}

function getAssigneePatch(data: AppData, value: string) {
  const user = data.users.find((entry) => entry.name === value)
  return { assigneeId: user?.id ?? null }
}

function getProjectPatch(data: AppData, value: string) {
  const project = data.projects.find((entry) => entry.name === value)
  return { primaryProjectId: project?.id ?? null }
}

function getLabelPatch(data: AppData, item: WorkItem | null, value: string) {
  if (!item) {
    return {}
  }

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

function getHierarchyParentPatch(
  data: AppData,
  item: WorkItem | null,
  field: "epic" | "feature",
  value: string
) {
  if (!item || value === `No ${field}`) {
    return {}
  }

  const parent = data.workItems.find(
    (entry) => entry.type === field && `${entry.key} · ${entry.title}` === value
  )

  if (!parent || !canParentWorkItemTypeAcceptChild(parent.type, item.type)) {
    return {}
  }

  return { parentId: parent.id }
}

type FieldPatchResolverInput = {
  data: AppData
  item: WorkItem | null
  value: string
}

const FIELD_PATCH_RESOLVERS: Partial<
  Record<GroupField, (input: FieldPatchResolverInput) => Partial<WorkItem>>
> = {
  assignee: ({ data, value }) => getAssigneePatch(data, value),
  project: ({ data, value }) => getProjectPatch(data, value),
  label: ({ data, item, value }) => getLabelPatch(data, item, value),
  epic: ({ data, item, value }) =>
    getHierarchyParentPatch(data, item, "epic", value),
  feature: ({ data, item, value }) =>
    getHierarchyParentPatch(data, item, "feature", value),
}

export function getPatchForField(
  data: AppData,
  item: WorkItem | null,
  field: GroupField | null,
  value: string
) {
  if (!field || value === "all") return {}

  const scalarPatch = getScalarPatchForField(field, value)
  if (scalarPatch) {
    return scalarPatch
  }

  return FIELD_PATCH_RESOLVERS[field]?.({ data, item, value }) ?? {}
}

function getHierarchyCreateDefaults({
  data,
  field,
  item,
  options,
  value,
}: {
  data: AppData
  field: "epic" | "feature"
  item: WorkItem | null
  options?: {
    teamId?: string | null
  }
  value: string
}): ReturnType<typeof getCreateDefaultsForField> {
  const parent = findHierarchyCreateParent({ data, field, item, options, value })

  if (!parent) {
    return { patch: {} }
  }

  return {
    patch: { parentId: parent.id },
    defaultTeamId: parent.teamId,
    initialType: getHierarchyCreateInitialType(item, parent),
  }
}

function findHierarchyCreateParent({
  data,
  field,
  item,
  options,
  value,
}: {
  data: AppData
  field: "epic" | "feature"
  item: WorkItem | null
  options?: {
    teamId?: string | null
  }
  value: string
}) {
  const emptyValue = `No ${field}`

  if (value === emptyValue) {
    return null
  }

  const scopedTeamId = options?.teamId ?? item?.teamId ?? null

  if (!scopedTeamId) {
    return null
  }

  return data.workItems.find(
    (entry) =>
      entry.teamId === scopedTeamId &&
      entry.type === field &&
      `${entry.key} · ${entry.title}` === value
  )
}

function getHierarchyCreateInitialType(
  item: WorkItem | null,
  parent: WorkItem
) {
  if (item && canParentWorkItemTypeAcceptChild(parent.type, item.type)) {
    return item.type
  }

  return getSingleChildWorkItemType(parent.type)
}

export function getCreateDefaultsForField(
  data: AppData,
  item: WorkItem | null,
  field: GroupField | null,
  value: string,
  options?: {
    teamId?: string | null
  }
): {
  patch: Partial<
    Pick<
      WorkItem,
      | "status"
      | "priority"
      | "assigneeId"
      | "primaryProjectId"
      | "labelIds"
      | "parentId"
    >
  >
  defaultTeamId?: string | null
  initialType?: WorkItem["type"] | null
} {
  if (field === "epic" || field === "feature") {
    return getHierarchyCreateDefaults({ data, field, item, options, value })
  }

  return {
    patch: getPatchForField(data, item, field, value),
  }
}
