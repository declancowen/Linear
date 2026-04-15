"use client"

import { useState, type ElementType, type ReactNode } from "react"
import { GearSix, Kanban, CaretDown, CaretRight, Rows, CheckCircle, Circle, XCircle, CodesandboxLogo, NotePencil } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export const PROPERTY_SELECT_SEPARATOR_VALUE = "__separator__"

export const SCREEN_HEADER_CLASS_NAME =
  "flex min-h-10 shrink-0 items-center justify-between gap-2 border-b px-4 py-2"

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
      <CheckCircle className="size-3.5 shrink-0 text-green-600" weight="fill" />
    )
  }
  if (statusLower === "in-progress" || statusLower === "in progress") {
    return (
      <Circle className="size-3.5 shrink-0 text-yellow-500" weight="fill" />
    )
  }
  if (statusLower === "cancelled" || statusLower === "duplicate") {
    return (
      <XCircle
        className="size-3.5 shrink-0 text-muted-foreground"
        weight="fill"
      />
    )
  }
  if (statusLower === "todo") {
    return <Circle className="size-3.5 shrink-0 text-muted-foreground" />
  }

  return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
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
  if (priority === "urgent") return "bg-red-500"
  if (priority === "high") return "bg-orange-500"
  if (priority === "medium") return "bg-yellow-500"
  if (priority === "low") return "bg-blue-500"
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
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col">
      <button
        className="flex items-center gap-1.5 py-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <CaretDown className="size-3" />
        ) : (
          <CaretRight className="size-3" />
        )}
        {title}
      </button>
      {open && <div className="mt-0.5 flex flex-col gap-0.5">{children}</div>}
    </div>
  )
}

export function PropertySelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
  renderValue,
  renderOption,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
  renderValue?: (value: string, label: string) => ReactNode
  renderOption?: (value: string, label: string) => ReactNode
}) {
  const selectedOption =
    options.find(
      (option) =>
        option.value !== PROPERTY_SELECT_SEPARATOR_VALUE &&
        option.value === value
    ) ?? null

  return (
    <div className="flex items-center justify-between py-1">
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <Select disabled={disabled} value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-7 w-auto min-w-28 border-none bg-transparent text-sm shadow-none">
          {renderValue ? (
            renderValue(
              selectedOption?.value ?? value,
              selectedOption?.label ?? value
            )
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option, index) =>
              option.value === PROPERTY_SELECT_SEPARATOR_VALUE ? (
                <SelectSeparator key={`separator-${index}`} />
              ) : (
                <SelectItem key={option.value} value={option.value}>
                  {renderOption
                    ? renderOption(option.value, option.label)
                    : option.label}
                </SelectItem>
              )
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function WorkItemLabelsEditor({
  item,
  editable,
}: {
  item: WorkItem
  editable: boolean
}) {
  const availableLabels = useAppStore(
    useShallow((state) =>
      [...state.labels].sort((left, right) => left.name.localeCompare(right.name))
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
    const created = await useAppStore.getState().createLabel(newLabelName)

    if (!created) {
      return
    }

    setNewLabelName("")

    if (item.labelIds.includes(created.id)) {
      return
    }

    useAppStore.getState().updateWorkItem(item.id, {
      labelIds: [...item.labelIds, created.id],
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
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input
        type="date"
        disabled={disabled}
        value={value ? value.slice(0, 10) : ""}
        onChange={(event) =>
          onValueChange(
            event.target.value ? `${event.target.value}T00:00:00.000Z` : null
          )
        }
        className="h-7 w-[9.5rem] border-none bg-transparent px-0 text-right text-sm shadow-none"
      />
    </div>
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
        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
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

export function getDocumentPreview(document: Pick<Document, "content" | "title">) {
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

    const label = data.labels.find((entry) => entry.name === value)

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
