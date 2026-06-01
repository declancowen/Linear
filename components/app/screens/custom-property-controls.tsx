"use client"

import { type ReactNode, useMemo, useState } from "react"
import {
  CalendarBlank,
  CaretDown,
  Check,
  Hash,
  Plus,
  TextAa,
  Trash,
} from "@phosphor-icons/react"

import { PhosphorIconPicker } from "@/components/app/phosphor-icon-picker"
import { useWorkItemSurfacePortalContainer } from "@/components/app/screens/work-item-surface-portal-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverItem,
  PropertyPopoverList,
} from "@/components/ui/template-primitives"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  customPropertyTypes,
  type AppData,
  type CustomPropertyOption,
  type CustomPropertyType,
  type CustomPropertyValue,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

const CUSTOM_PROPERTY_TYPE_LABELS: Record<CustomPropertyType, string> = {
  text: "Free text",
  integer: "Integer",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  email: "Email",
  phone: "Phone",
  person: "Person",
  select: "Select",
  multiSelect: "Multi-select",
}

const OPTION_COLORS = [
  "var(--status-backlog)",
  "var(--status-todo)",
  "var(--status-doing)",
  "var(--status-done)",
  "var(--priority-high)",
  "var(--priority-urgent)",
]

function createOption(label = "Option"): CustomPropertyOption {
  return {
    id: `option_${Math.random().toString(36).slice(2, 10)}`,
    label,
    color: OPTION_COLORS[Math.floor(Math.random() * OPTION_COLORS.length)]!,
  }
}

const CUSTOM_PROPERTY_VALUE_NORMALIZERS = {
  text: normalizeStringCustomPropertyValue,
  date: normalizeStringCustomPropertyValue,
  email: normalizeStringCustomPropertyValue,
  phone: normalizeStringCustomPropertyValue,
  person: normalizeStringCustomPropertyValue,
  select: normalizeStringCustomPropertyValue,
  url: normalizeStringCustomPropertyValue,
  integer: normalizeIntegerCustomPropertyValue,
  checkbox: normalizeCheckboxCustomPropertyValue,
  multiSelect: normalizeMultiSelectCustomPropertyValue,
} satisfies Record<
  CustomPropertyType,
  (value: CustomPropertyValue | undefined) => CustomPropertyValue
>

const TEXT_INPUT_TYPES: Partial<Record<CustomPropertyType, string>> = {
  date: "date",
  email: "email",
  integer: "number",
  url: "url",
}

function normalizeValueForType(
  type: CustomPropertyType,
  value: CustomPropertyValue | undefined
): CustomPropertyValue {
  return CUSTOM_PROPERTY_VALUE_NORMALIZERS[type](value)
}

function normalizeStringCustomPropertyValue(
  value: CustomPropertyValue | undefined
) {
  return typeof value === "string" ? value : null
}

function normalizeIntegerCustomPropertyValue(
  value: CustomPropertyValue | undefined
) {
  return typeof value === "number" ? value : null
}

function normalizeCheckboxCustomPropertyValue(
  value: CustomPropertyValue | undefined
) {
  return typeof value === "boolean" ? value : false
}

function normalizeMultiSelectCustomPropertyValue(
  value: CustomPropertyValue | undefined
) {
  return Array.isArray(value) ? value : []
}

type CustomPropertyDefinition = AppData["customPropertyDefinitions"][number]
type CustomPropertyControlVariant = "row" | "chip"
type CustomPropertyRendererProps = {
  commit: (nextValue: CustomPropertyValue) => void
  currentValue: CustomPropertyValue
  definition: CustomPropertyDefinition
  editable: boolean
  users: AppData["users"]
  variant: CustomPropertyControlVariant
}

function getChoiceSelectedIds(
  definition: CustomPropertyDefinition,
  currentValue: CustomPropertyValue
) {
  if (definition.type === "multiSelect") {
    return Array.isArray(currentValue) ? currentValue : []
  }

  return typeof currentValue === "string" ? [currentValue] : []
}

function getTextInputType(type: CustomPropertyType) {
  return TEXT_INPUT_TYPES[type] ?? "text"
}

function renderTextInputIcon(type: CustomPropertyType) {
  const className =
    "pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-4"

  if (type === "integer") {
    return <Hash className={className} />
  }

  if (type === "date") {
    return <CalendarBlank className={className} />
  }

  return <TextAa className={className} />
}

function parseTextInputValue(
  type: CustomPropertyType,
  rawValue: string
): CustomPropertyValue {
  if (!rawValue) {
    return null
  }

  if (type === "integer") {
    const parsed = Number(rawValue)
    return Number.isInteger(parsed) ? parsed : null
  }

  return rawValue
}

function getNextSingleSelectValue(selectedIds: string[], optionId: string) {
  return selectedIds.includes(optionId) ? null : optionId
}

function getNextMultiSelectValue(selectedIds: string[], optionId: string) {
  const nextIds = selectedIds.includes(optionId)
    ? selectedIds.filter((id) => id !== optionId)
    : [...selectedIds, optionId]

  return nextIds.length === 0 ? null : nextIds
}

function getNextChoiceValue(
  definition: CustomPropertyDefinition,
  selectedIds: string[],
  optionId: string
) {
  return definition.type === "multiSelect"
    ? getNextMultiSelectValue(selectedIds, optionId)
    : getNextSingleSelectValue(selectedIds, optionId)
}

export function CustomPropertyDefinitionDialog({
  open,
  scopeType = "team",
  teamId,
  onOpenChange,
}: {
  open: boolean
  scopeType?: "team"
  teamId: string
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("TextAa")
  const [type, setType] = useState<CustomPropertyType>("text")
  const [options, setOptions] = useState<CustomPropertyOption[]>([
    createOption("Option 1"),
  ])
  const createCustomPropertyDefinition = useAppStore(
    (state) => state.createCustomPropertyDefinition
  )
  const requiresOptions = type === "select" || type === "multiSelect"
  const canSave =
    name.trim().length > 0 &&
    (!requiresOptions ||
      options.every((option) => option.label.trim().length > 0))

  async function handleSave() {
    if (!canSave) {
      return
    }

    const result = await createCustomPropertyDefinition({
      teamId,
      scopeType,
      name: name.trim(),
      icon,
      type,
      options: requiresOptions ? options : [],
    })

    if (result) {
      setName("")
      setIcon("TextAa")
      setType("text")
      setOptions([createOption("Option 1")])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-line-soft px-4 py-3">
          <DialogTitle className="text-sm">New work property</DialogTitle>
          <DialogDescription>
            Add a typed property for work items in this team space.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
            <span className="text-[12.5px] text-fg-3">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Property name"
              maxLength={64}
            />
            <span className="text-[12.5px] text-fg-3">Icon</span>
            <PhosphorIconPicker value={icon} onValueChange={setIcon} />
            <span className="text-[12.5px] text-fg-3">Type</span>
            <Select
              value={type}
              onValueChange={(value) => setType(value as CustomPropertyType)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customPropertyTypes.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {CUSTOM_PROPERTY_TYPE_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresOptions ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-fg-3">Options</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setOptions((current) => [
                      ...current,
                      createOption(`Option ${current.length + 1}`),
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
              <div className="space-y-1.5">
                {options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: option.color }}
                    />
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((entry) =>
                            entry.id === option.id
                              ? { ...entry, label: event.target.value }
                              : entry
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove option"
                      className="inline-grid size-8 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
                      onClick={() =>
                        setOptions((current) =>
                          current.length > 1
                            ? current.filter((entry) => entry.id !== option.id)
                            : current
                        )
                      }
                    >
                      <Trash className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-soft px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave} onClick={handleSave}>
            Create property
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CustomPropertyChoiceControl({
  commit,
  currentValue,
  definition,
  editable,
  variant,
}: CustomPropertyRendererProps) {
  const portalContainer = useWorkItemSurfacePortalContainer()
  const selectedIds = getChoiceSelectedIds(definition, currentValue)
  const selectedOptions = definition.options.filter((option) =>
    selectedIds.includes(option.id)
  )
  const triggerText =
    selectedOptions.length === 0
      ? definition.name
      : selectedOptions.map((option) => option.label).join(", ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!editable}
          className={cn(
            "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground",
            variant === "chip" && "h-6 rounded-full text-[11px]"
          )}
        >
          <span className="truncate">{triggerText}</span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        portalContainer={portalContainer}
        className={cn(PROPERTY_POPOVER_CLASS, "w-[240px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverItem
            selected={selectedIds.length === 0}
            onClick={() => commit(null)}
            trailing={
              selectedIds.length === 0 ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <span className="text-fg-3">
              {definition.type === "multiSelect"
                ? "Clear values"
                : "No selection"}
            </span>
          </PropertyPopoverItem>
          {definition.options.map((option) => {
            const selected = selectedIds.includes(option.id)
            return (
              <PropertyPopoverItem
                key={option.id}
                selected={selected}
                onClick={() =>
                  commit(getNextChoiceValue(definition, selectedIds, option.id))
                }
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: option.color }}
                />
                <span>{option.label}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function CustomPropertyPersonControl({
  commit,
  currentValue,
  editable,
  users,
}: CustomPropertyRendererProps) {
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <Select
      value={typeof currentValue === "string" ? currentValue : "none"}
      disabled={!editable}
      onValueChange={(nextValue) =>
        commit(nextValue === "none" ? null : nextValue)
      }
    >
      <SelectTrigger className="h-7 min-w-0 text-[12px]">
        <SelectValue placeholder="Person" />
      </SelectTrigger>
      <SelectContent portalContainer={portalContainer}>
        <SelectItem value="none">No person</SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CustomPropertyTextControl({
  commit,
  currentValue,
  definition,
  editable,
  variant,
}: CustomPropertyRendererProps) {
  return (
    <div className="relative min-w-0">
      {renderTextInputIcon(definition.type)}
      <Input
        type={getTextInputType(definition.type)}
        defaultValue={
          typeof currentValue === "number" || typeof currentValue === "string"
            ? currentValue
            : ""
        }
        disabled={!editable}
        placeholder={definition.name}
        className={cn(
          "h-7 min-w-0 pl-7 text-[12px]",
          variant === "chip" && "h-6 rounded-full text-[11px]"
        )}
        onBlur={(event) =>
          commit(
            parseTextInputValue(definition.type, event.target.value.trim())
          )
        }
      />
    </div>
  )
}

function CustomPropertyCheckboxControl({
  commit,
  currentValue,
  editable,
}: CustomPropertyRendererProps) {
  return (
    <Switch
      size="sm"
      checked={Boolean(currentValue)}
      disabled={!editable}
      onCheckedChange={commit}
    />
  )
}

const CUSTOM_PROPERTY_VALUE_CONTROLS = {
  checkbox: CustomPropertyCheckboxControl,
  date: CustomPropertyTextControl,
  email: CustomPropertyTextControl,
  integer: CustomPropertyTextControl,
  multiSelect: CustomPropertyChoiceControl,
  person: CustomPropertyPersonControl,
  phone: CustomPropertyTextControl,
  select: CustomPropertyChoiceControl,
  text: CustomPropertyTextControl,
  url: CustomPropertyTextControl,
} satisfies Record<
  CustomPropertyType,
  (props: CustomPropertyRendererProps) => ReactNode
>

export function CustomPropertyValueControl({
  data,
  definition,
  item,
  value,
  editable,
  variant = "row",
}: {
  data: AppData
  definition: CustomPropertyDefinition
  item: WorkItem
  value?: AppData["customPropertyValues"][number] | null
  editable: boolean
  variant?: CustomPropertyControlVariant
}) {
  const setCustomPropertyValue = useAppStore(
    (state) => state.setCustomPropertyValue
  )
  const currentValue = normalizeValueForType(definition.type, value?.value)
  const users = useMemo(
    () =>
      data.teamMemberships
        .filter((membership) => membership.teamId === item.teamId)
        .map(
          (membership) =>
            data.users.find((user) => user.id === membership.userId) ?? null
        )
        .filter((user): user is AppData["users"][number] => user !== null),
    [data.teamMemberships, data.users, item.teamId]
  )

  function commit(nextValue: CustomPropertyValue) {
    setCustomPropertyValue(item.id, definition.id, nextValue)
  }

  const ValueControl = CUSTOM_PROPERTY_VALUE_CONTROLS[definition.type]
  return (
    <ValueControl
      commit={commit}
      currentValue={currentValue}
      definition={definition}
      editable={editable}
      users={users}
      variant={variant}
    />
  )
}
