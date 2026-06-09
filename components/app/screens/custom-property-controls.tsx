"use client"

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarBlank,
  CaretDown,
  Check,
  CheckSquare,
  EnvelopeSimple,
  Hash,
  LinkSimple,
  ListBullets,
  ListChecks,
  Phone,
  Plus,
  TextAa,
  Trash,
  User,
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
  type Document as AppDocument,
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

const CUSTOM_PROPERTY_TYPE_ICONS: Record<
  CustomPropertyType,
  typeof TextAa
> = {
  text: TextAa,
  integer: Hash,
  date: CalendarBlank,
  checkbox: CheckSquare,
  url: LinkSimple,
  email: EnvelopeSimple,
  phone: Phone,
  person: User,
  select: ListBullets,
  multiSelect: ListChecks,
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

type CustomPropertyDefinitionDialogDraft = {
  icon: string
  name: string
  options: CustomPropertyOption[]
  requiresOptions: boolean
  type: CustomPropertyType
}

type CustomPropertyDefinitionCreatePayload = {
  icon: string
  name: string
  options: CustomPropertyOption[]
  targetType: "workItem" | "document"
  type: CustomPropertyType
} & (
  | {
      scopeType: "private" | "workspace"
      workspaceId: string
    }
  | {
      scopeType: "team"
      teamId: string
    }
)

function getSavedCustomPropertyOptions(
  draft: CustomPropertyDefinitionDialogDraft
) {
  return draft.requiresOptions ? draft.options : []
}

function getCustomPropertyDefinitionPatch(
  draft: CustomPropertyDefinitionDialogDraft
) {
  return {
    name: draft.name.trim(),
    icon: draft.icon,
    type: draft.type,
    options: getSavedCustomPropertyOptions(draft),
  }
}

function getCustomPropertyDefinitionCreatePayload({
  draft,
  scopeType,
  targetType,
  teamId,
  workspaceId,
}: {
  draft: CustomPropertyDefinitionDialogDraft
  scopeType: "team" | "workspace" | "private"
  targetType: "workItem" | "document"
  teamId?: string | null
  workspaceId?: string | null
}): CustomPropertyDefinitionCreatePayload | null {
  const base = {
    ...getCustomPropertyDefinitionPatch(draft),
    targetType,
  }

  if (scopeType === "team") {
    return teamId ? { ...base, scopeType, teamId } : null
  }

  return workspaceId ? { ...base, scopeType, workspaceId } : null
}

export function CustomPropertyDefinitionDialog({
  open,
  scopeType = "team",
  targetType = "workItem",
  teamId,
  workspaceId,
  definition,
  onOpenChange,
}: {
  open: boolean
  scopeType?: "team" | "workspace" | "private"
  targetType?: "workItem" | "document"
  teamId?: string | null
  workspaceId?: string | null
  definition?: CustomPropertyDefinition | null
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
  const updateCustomPropertyDefinition = useAppStore(
    (state) => state.updateCustomPropertyDefinition
  )
  const definitionRef = useRef(definition)
  const isEditing = Boolean(definition)
  const targetLabel = targetType === "document" ? "documents" : "work items"

  useEffect(() => {
    definitionRef.current = definition
  }, [definition])

  useEffect(() => {
    if (!open) {
      return
    }

    const current = definitionRef.current

    if (current) {
      setName(current.name)
      setIcon(current.icon)
      setType(current.type)
      setOptions(
        current.options.length > 0 ? current.options : [createOption("Option 1")]
      )
      return
    }

    setName("")
    setIcon("TextAa")
    setType("text")
    setOptions([createOption("Option 1")])
  }, [open])

  const requiresOptions = type === "select" || type === "multiSelect"
  const canSave =
    name.trim().length > 0 &&
    (!requiresOptions ||
      options.every((option) => option.label.trim().length > 0))

  async function handleSave() {
    if (!canSave) {
      return
    }

    const draft = {
      icon,
      name,
      options,
      requiresOptions,
      type,
    }
    const editing = definitionRef.current

    if (editing) {
      const updated = await updateCustomPropertyDefinition(
        editing.id,
        getCustomPropertyDefinitionPatch(draft)
      )

      if (updated) {
        onOpenChange(false)
      }

      return
    }

    const payload = getCustomPropertyDefinitionCreatePayload({
      draft,
      scopeType,
      targetType,
      teamId,
      workspaceId,
    })

    if (!payload) {
      return
    }

    const result = await createCustomPropertyDefinition(payload)

    if (result) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 sm:max-w-[480px]">
        <DialogHeader className="space-y-1 border-b border-line-soft px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {isEditing ? "Edit property" : "New property"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            {isEditing
              ? "Update this property’s name, icon, type, and options."
              : `Add a typed property for ${targetLabel} in this scope.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold tracking-wide text-fg-3 uppercase">
              Name
            </label>
            <div className="flex items-center gap-2">
              <PhosphorIconPicker value={icon} onValueChange={setIcon} />
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Property name"
                maxLength={64}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold tracking-wide text-fg-3 uppercase">
              Type
            </label>
            <div
              role="radiogroup"
              aria-label="Property type"
              className="grid grid-cols-2 gap-1.5"
            >
              {customPropertyTypes.map((entry) => {
                const TypeIcon = CUSTOM_PROPERTY_TYPE_ICONS[entry]
                const selected = type === entry

                return (
                  <button
                    key={entry}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isEditing && !selected}
                    onClick={() => setType(entry)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-line-soft bg-background text-fg-2 hover:border-line hover:bg-surface-2",
                      isEditing && !selected && "opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-md",
                        selected
                          ? "bg-primary/15 text-primary"
                          : "bg-surface-3 text-fg-3"
                      )}
                    >
                      <TypeIcon className="size-3.5" />
                    </span>
                    <span className="truncate">
                      {CUSTOM_PROPERTY_TYPE_LABELS[entry]}
                    </span>
                    {selected ? (
                      <Check className="ml-auto size-3.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                )
              })}
            </div>
            {isEditing ? (
              <p className="text-[11.5px] text-fg-3">
                Type can’t be changed after a property is created.
              </p>
            ) : null}
          </div>

          {requiresOptions ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-semibold tracking-wide text-fg-3 uppercase">
                  Options
                </label>
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
                  Add option
                </Button>
              </div>
              <div className="space-y-1.5">
                {options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-2 rounded-md border border-line-soft bg-background px-2 py-1.5"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: option.color }}
                    />
                    <Input
                      value={option.label}
                      placeholder="Option label"
                      className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
                      disabled={options.length <= 1}
                      className="inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        setOptions((current) =>
                          current.length > 1
                            ? current.filter((entry) => entry.id !== option.id)
                            : current
                        )
                      }
                    >
                      <Trash className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave} onClick={handleSave}>
            {isEditing ? "Save changes" : "Create property"}
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

function resolveCustomPropertyPersonUsers(
  users: AppData["users"],
  memberships: Array<{ userId: string }>
) {
  return memberships
    .map(
      (membership) =>
        users.find((user) => user.id === membership.userId) ?? null
    )
    .filter((user): user is AppData["users"][number] => user !== null)
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
  document,
  definition,
  item,
  value,
  editable,
  variant = "row",
}: {
  data: AppData
  document?: AppDocument | null
  definition: CustomPropertyDefinition
  item?: WorkItem | null
  value?: AppData["customPropertyValues"][number] | null
  editable: boolean
  variant?: CustomPropertyControlVariant
}) {
  const setCustomPropertyValue = useAppStore(
    (state) => state.setCustomPropertyValue
  )
  const currentValue = normalizeValueForType(definition.type, value?.value)
  const { teamMemberships, users: availableUsers, workspaceMemberships } = data
  const workspaceId =
    item?.workspaceId ?? document?.workspaceId ?? definition.workspaceId
  const teamId = item?.teamId ?? document?.teamId ?? definition.teamId
  const users = useMemo(() => {
    const workspaceProperty = (definition.scopeType ?? "team") !== "team"

    if (workspaceProperty) {
      return resolveCustomPropertyPersonUsers(
        availableUsers,
        workspaceMemberships.filter(
          (membership) => membership.workspaceId === workspaceId
        )
      )
    }

    return resolveCustomPropertyPersonUsers(
      availableUsers,
      teamMemberships.filter((membership) => membership.teamId === teamId)
    )
  }, [
    availableUsers,
    definition.scopeType,
    teamId,
    teamMemberships,
    workspaceId,
    workspaceMemberships,
  ])

  function commit(nextValue: CustomPropertyValue) {
    if (document) {
      setCustomPropertyValue("document", document.id, definition.id, nextValue)
      return
    }

    if (item) {
      setCustomPropertyValue("workItem", item.id, definition.id, nextValue)
    }
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
