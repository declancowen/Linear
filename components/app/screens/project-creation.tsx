"use client"

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  Check,
  FolderSimple,
  MagnifyingGlass,
  Tag,
  User,
  UsersThree,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
  getTemplateDefaultsForTeam,
  getVisibleWorkItems,
} from "@/lib/domain/selectors"
import {
  getTextInputLimitState,
  projectNameConstraints,
  projectSummaryConstraints,
} from "@/lib/domain/input-constraints"
import {
  createDefaultProjectPresentationConfig,
  getDefaultTemplateTypeForTeamExperience,
  priorityMeta,
  projectStatusMeta,
  type AppData,
  type DisplayProperty,
  type Priority,
  type ProjectPresentationConfig,
  type ProjectStatus,
  type ViewDefinition,
} from "@/lib/domain/types"
import { sortLabelsByName } from "@/lib/domain/labels"
import { getUsersForTeamMemberships } from "@/lib/domain/team-members"
import { useAppStore } from "@/lib/store/app-store"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { Button } from "@/components/ui/button"
import {
  ShortcutKeys,
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { PriorityIcon } from "@/components/app/screens/shared"
import { TeamSpaceCrumbPicker } from "@/components/app/screens/team-space-crumb-picker"
import { WorkItemAssigneeAvatar } from "@/components/app/screens/work-item-ui"
import {
  applyViewConfigPatch,
  cloneViewFilters,
  createEmptyViewFilters,
  getProjectPresentationGroupOptions,
  selectAppDataSnapshot,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  GroupChipPopover,
  LayoutChipPopover,
  LevelChipPopover,
  PropertiesChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
} from "@/components/app/screens/work-surface-controls"
import {
  PropertyDateChip,
  PropertySelectionPopover,
  propertyChipTriggerClass as chipTriggerClass,
  propertyChipTriggerDashedClass as chipTriggerDashedClass,
  propertyCrumbTriggerClass as crumbTriggerClass,
} from "@/components/app/screens/property-chips"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

const PROJECT_PRESENTATION_PROPERTY_OPTIONS: DisplayProperty[] = [
  "id",
  "status",
  "assignee",
  "priority",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
]

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  backlog: "var(--status-backlog)",
  planned: "var(--status-todo)",
  "in-progress": "var(--status-doing)",
  completed: "var(--status-done)",
  cancelled: "var(--priority-urgent)",
}

function matchesQuery(value: string, query: string) {
  if (!query.trim()) {
    return true
  }

  return value.toLowerCase().includes(query.trim().toLowerCase())
}

function toggleSelection(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
}

function ProjectMultiSelectPopover({
  children,
  disabled,
  hasSelection,
  open,
  popoverWidthClass,
  query,
  searchIcon,
  searchPlaceholder,
  selectedCount,
  triggerIcon,
  triggerText,
  onClear,
  onOpenChange,
  onQueryChange,
}: {
  children: ReactNode
  disabled?: boolean
  hasSelection: boolean
  open: boolean
  popoverWidthClass: string
  query: string
  searchIcon: ReactNode
  searchPlaceholder: string
  selectedCount: number
  triggerIcon: ReactNode
  triggerText: string
  onClear: () => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
}) {
  const trigger = (
    <button
      type="button"
      className={cn(chipTriggerClass, !hasSelection && chipTriggerDashedClass)}
      disabled={disabled}
    >
      {triggerIcon}
      <span
        className={cn("truncate", hasSelection && "font-medium text-foreground")}
      >
        {triggerText}
      </span>
      <CaretDown className="size-3 shrink-0 opacity-60" />
    </button>
  )

  return (
    <PropertySelectionPopover
      open={open}
      trigger={trigger}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
    >
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, popoverWidthClass)}
      >
        <PropertyPopoverSearch
          icon={searchIcon}
          placeholder={searchPlaceholder}
          value={query}
          onChange={onQueryChange}
          trailing={
            hasSelection ? (
              <button
                type="button"
                className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                onClick={onClear}
              >
                Clear
              </button>
            ) : undefined
          }
        />
        <PropertyPopoverList>{children}</PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>{selectedCount} selected</span>
        </PropertyPopoverFoot>
      </PopoverContent>
    </PropertySelectionPopover>
  )
}

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ background: PROJECT_STATUS_COLOR[status] }}
      />
      <span>{projectStatusMeta[status].label}</span>
    </span>
  )
}

function UserOption({
  user,
  secondaryLabel,
}: {
  user: AppData["users"][number]
  secondaryLabel?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <WorkItemAssigneeAvatar
        user={user}
        className="size-4 data-[size=sm]:size-4"
      />
      <span className="min-w-0 flex-1 truncate">
        <span>{user.name}</span>
        {secondaryLabel ? (
          <span className="ml-1 text-fg-3">{secondaryLabel}</span>
        ) : null}
      </span>
    </span>
  )
}

function getDialogTeamMembers(
  teamId: string,
  teamMemberships: AppData["teamMemberships"],
  users: AppData["users"]
) {
  return getUsersForTeamMemberships({
    teamId,
    teamMemberships,
    users,
  }).sort((left, right) => left.name.localeCompare(right.name))
}

function createInitialProjectPresentationConfig(
  templateType: Parameters<typeof createDefaultProjectPresentationConfig>[0]
): ProjectPresentationConfig {
  return {
    ...createDefaultProjectPresentationConfig(templateType, {
      layout: "list",
    }),
    layout: "list",
    ordering: "createdAt",
    displayProps: [],
    filters: createEmptyViewFilters(),
    showChildItems: false,
  }
}

type CreateProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTeamId?: string | null
}

export function CreateProjectDialog(props: CreateProjectDialogProps) {
  const dialogInstanceKey = props.open
    ? `open:${props.defaultTeamId ?? ""}`
    : "closed"

  return <CreateProjectDialogContent key={dialogInstanceKey} {...props} />
}

type ProjectTextLimitState = ReturnType<typeof getTextInputLimitState>
type ProjectDialogTeam = AppData["teams"][number]
type ProjectDialogUser = AppData["users"][number]
type ProjectDialogLabel = AppData["labels"][number]
type StringListStateSetter = Dispatch<SetStateAction<string[]>>

function getCollectionTriggerText<T extends { name: string }>(
  selectedItems: T[],
  emptyLabel: string,
  pluralLabel: string
) {
  if (selectedItems.length === 0) {
    return emptyLabel
  }

  if (selectedItems.length === 1) {
    return selectedItems[0]?.name ?? emptyLabel
  }

  return `${selectedItems.length} ${pluralLabel}`
}

function ProjectDialogHeader({
  availableTeams,
  selectedTeamId,
  onTeamSelect,
}: {
  availableTeams: ProjectDialogTeam[]
  selectedTeamId: string
  onTeamSelect: (teamId: string) => void
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
      <TeamSpaceCrumbPicker
        options={availableTeams.map((team) => ({
          id: team.id,
          label: team.name,
          teamId: team.id,
        }))}
        selectedId={selectedTeamId}
        onSelect={onTeamSelect}
        triggerClassName={crumbTriggerClass}
      />
      <span className={crumbTriggerClass}>
        <span className="font-medium text-foreground">Project</span>
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <DialogClose asChild>
          <button
            type="button"
            className="inline-grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-[14px]" />
          </button>
        </DialogClose>
      </div>
    </div>
  )
}

function ProjectBasicsFields({
  name,
  summary,
  summaryHint,
  nameLimitState,
  summaryLimitState,
  onNameChange,
  onSummaryChange,
}: {
  name: string
  summary: string
  summaryHint: string
  nameLimitState: ProjectTextLimitState
  summaryLimitState: ProjectTextLimitState
  onNameChange: (value: string) => void
  onSummaryChange: (value: string) => void
}) {
  return (
    <div className="px-[18px] pt-3 pb-0.5">
      <Input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Project name"
        maxLength={projectNameConstraints.max}
        className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <FieldCharacterLimit
        state={nameLimitState}
        limit={projectNameConstraints.max}
        className="mt-1"
      />
      <Textarea
        value={summary}
        onChange={(event) => onSummaryChange(event.target.value)}
        maxLength={projectSummaryConstraints.max}
        placeholder={summaryHint}
        rows={4}
        className="mt-0.5 min-h-[96px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
      />
      <FieldCharacterLimit
        state={summaryLimitState}
        limit={projectSummaryConstraints.max}
        className="mt-1"
      />
      <div className="pt-1 pb-2 text-[11.5px] text-fg-4">
        Configure the default project view before the team starts using it.
      </div>
    </div>
  )
}

function ProjectStatusChip({
  open,
  status,
  onOpenChange,
  onStatusChange,
}: {
  open: boolean
  status: ProjectStatus
  onOpenChange: (open: boolean) => void
  onStatusChange: (status: ProjectStatus) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={chipTriggerClass}>
          <ProjectStatusBadge status={status} />
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          {PROJECT_STATUS_ORDER.map((value) => {
            const selected = value === status
            return (
              <PropertyPopoverItem
                key={value}
                selected={selected}
                onClick={() => {
                  onStatusChange(value)
                  onOpenChange(false)
                }}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                <ProjectStatusBadge status={value} />
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function ProjectPriorityChip({
  open,
  priority,
  onOpenChange,
  onPriorityChange,
}: {
  open: boolean
  priority: Priority
  onOpenChange: (open: boolean) => void
  onPriorityChange: (priority: Priority) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={chipTriggerClass}>
          <PriorityIcon priority={priority} />
          <span className="font-medium text-foreground">
            {priorityMeta[priority].label}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          {Object.keys(priorityMeta).map((value) => {
            const typedValue = value as Priority
            const selected = typedValue === priority

            return (
              <PropertyPopoverItem
                key={value}
                selected={selected}
                onClick={() => {
                  onPriorityChange(typedValue)
                  onOpenChange(false)
                }}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                <PriorityIcon priority={typedValue} />
                <span>{priorityMeta[typedValue].label}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function ProjectLeadChip({
  defaultLeadId,
  leadId,
  open,
  query,
  selectedLead,
  teamMembers,
  onLeadChange,
  onOpenChange,
  onQueryChange,
}: {
  defaultLeadId: string | null
  leadId: string | null
  open: boolean
  query: string
  selectedLead: ProjectDialogUser | null
  teamMembers: ProjectDialogUser[]
  onLeadChange: (leadId: string | null) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
}) {
  const trigger = (
    <button
      type="button"
      className={cn(chipTriggerClass, !selectedLead && chipTriggerDashedClass)}
      disabled={teamMembers.length === 0}
    >
      {selectedLead ? (
        <UserOption user={selectedLead} />
      ) : (
        <>
          <User className="size-[13px]" />
          <span>Lead</span>
        </>
      )}
      <CaretDown className="size-3 shrink-0 opacity-60" />
    </button>
  )

  return (
    <PropertySelectionPopover
      open={open}
      trigger={trigger}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
    >
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[300px]")}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Choose lead…"
          value={query}
          onChange={onQueryChange}
          trailing={
            leadId !== defaultLeadId && defaultLeadId ? (
              <button
                type="button"
                className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                onClick={() => onLeadChange(defaultLeadId)}
              >
                Clear
              </button>
            ) : undefined
          }
        />
        <PropertyPopoverList>
          {teamMembers
            .filter((member) => matchesQuery(member.name, query))
            .map((member) => {
              const selected = member.id === leadId
              return (
                <PropertyPopoverItem
                  key={member.id}
                  selected={selected}
                  onClick={() => {
                    onLeadChange(member.id)
                    onOpenChange(false)
                  }}
                  trailing={
                    selected ? (
                      <Check className="size-[14px] text-foreground" />
                    ) : null
                  }
                >
                  <UserOption user={member} />
                </PropertyPopoverItem>
              )
            })}
        </PropertyPopoverList>
      </PopoverContent>
    </PropertySelectionPopover>
  )
}

function ProjectMembersChip({
  memberIds,
  open,
  query,
  selectedMembers,
  teamMembers,
  leadId,
  triggerText,
  onMemberIdsChange,
  onOpenChange,
  onQueryChange,
}: {
  memberIds: string[]
  open: boolean
  query: string
  selectedMembers: ProjectDialogUser[]
  teamMembers: ProjectDialogUser[]
  leadId: string | null
  triggerText: string
  onMemberIdsChange: (updater: (current: string[]) => string[]) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
}) {
  return (
    <ProjectMultiSelectPopover
      disabled={teamMembers.length === 0}
      hasSelection={selectedMembers.length > 0}
      open={open}
      popoverWidthClass="w-[300px]"
      query={query}
      searchIcon={<MagnifyingGlass className="size-[14px]" />}
      searchPlaceholder="Add members…"
      selectedCount={selectedMembers.length}
      triggerIcon={<UsersThree className="size-[13px]" />}
      triggerText={triggerText}
      onClear={() => onMemberIdsChange(() => [])}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
    >
      {teamMembers
        .filter((member) => matchesQuery(member.name, query))
        .map((member) => {
          const selected = memberIds.includes(member.id)
          const isLead = member.id === leadId
          return (
            <PropertyPopoverItem
              key={member.id}
              selected={selected}
              onClick={() =>
                onMemberIdsChange((current) =>
                  toggleSelection(current, member.id)
                )
              }
              trailing={
                selected ? (
                  <Check className="size-[14px] text-foreground" />
                ) : null
              }
            >
              <UserOption
                user={member}
                secondaryLabel={isLead ? "Lead" : undefined}
              />
            </PropertyPopoverItem>
          )
        })}
    </ProjectMultiSelectPopover>
  )
}

function ProjectLabelsChip({
  availableLabels,
  labelQuery,
  labelsTriggerText,
  open,
  selectedLabelIds,
  selectedLabels,
  onLabelIdsChange,
  onOpenChange,
  onQueryChange,
}: {
  availableLabels: ProjectDialogLabel[]
  labelQuery: string
  labelsTriggerText: string
  open: boolean
  selectedLabelIds: string[]
  selectedLabels: ProjectDialogLabel[]
  onLabelIdsChange: (updater: (current: string[]) => string[]) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
}) {
  return (
    <ProjectMultiSelectPopover
      hasSelection={selectedLabels.length > 0}
      open={open}
      popoverWidthClass="w-[260px]"
      query={labelQuery}
      searchIcon={<Tag className="size-[14px]" />}
      searchPlaceholder="Filter labels…"
      selectedCount={selectedLabels.length}
      triggerIcon={<Tag className="size-[13px]" />}
      triggerText={labelsTriggerText}
      onClear={() => onLabelIdsChange(() => [])}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
    >
      {availableLabels
        .filter((label) => matchesQuery(label.name, labelQuery))
        .map((label) => {
          const selected = selectedLabelIds.includes(label.id)
          return (
            <PropertyPopoverItem
              key={label.id}
              selected={selected}
              onClick={() =>
                onLabelIdsChange((current) => toggleSelection(current, label.id))
              }
              trailing={
                selected ? (
                  <Check className="size-[14px] text-foreground" />
                ) : null
              }
            >
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: label.color }}
              />
              <span className="truncate">{label.name}</span>
            </PropertyPopoverItem>
          )
        })}
    </ProjectMultiSelectPopover>
  )
}

function ProjectPresentationControls({
  presentationView,
  scopedTeamItems,
  presentationGroupOptions,
  onUpdatePresentationView,
  onTogglePresentationFilterValue,
  onClearPresentationFilters,
  onTogglePresentationDisplayProperty,
  onReorderPresentationDisplayProperties,
  onClearPresentationDisplayProperties,
}: {
  presentationView: ViewDefinition | null
  scopedTeamItems: ReturnType<typeof getVisibleWorkItems>
  presentationGroupOptions: ReturnType<
    typeof getProjectPresentationGroupOptions
  >
  onUpdatePresentationView: (patch: ViewConfigPatch) => void
  onTogglePresentationFilterValue: (key: ViewFilterKey, value: string) => void
  onClearPresentationFilters: () => void
  onTogglePresentationDisplayProperty: (property: DisplayProperty) => void
  onReorderPresentationDisplayProperties: (
    displayProps: DisplayProperty[]
  ) => void
  onClearPresentationDisplayProperties: () => void
}) {
  if (!presentationView) {
    return null
  }

  return (
    <>
      <LayoutChipPopover
        view={presentationView}
        onUpdateView={onUpdatePresentationView}
      />
      <FilterPopover
        view={presentationView}
        items={scopedTeamItems}
        onToggleFilterValue={onTogglePresentationFilterValue}
        onClearFilters={onClearPresentationFilters}
        variant="chip"
        chipTone="default"
        dashedWhenEmpty
      />
      <LevelChipPopover
        view={presentationView}
        onUpdateView={onUpdatePresentationView}
      />
      <GroupChipPopover
        view={presentationView}
        groupOptions={presentationGroupOptions}
        onUpdateView={onUpdatePresentationView}
        tone="default"
        showValue={false}
        showSubGrouping={false}
      />
      <SortChipPopover
        view={presentationView}
        onUpdateView={onUpdatePresentationView}
        label="Sort"
        showValue={false}
      />
      <PropertiesChipPopover
        view={presentationView}
        onToggleDisplayProperty={onTogglePresentationDisplayProperty}
        onReorderDisplayProperties={onReorderPresentationDisplayProperties}
        onClearDisplayProperties={onClearPresentationDisplayProperties}
        tone="default"
        dashedWhenEmpty
        propertyOptions={PROJECT_PRESENTATION_PROPERTY_OPTIONS}
      />
    </>
  )
}

function ProjectDialogControlStrip({
  availableLabels,
  defaultLeadIdForSelectedTeam,
  labelQuery,
  labelsPickerOpen,
  labelsTriggerText,
  leadId,
  leadPickerOpen,
  leadQuery,
  memberIds,
  memberQuery,
  membersPickerOpen,
  membersTriggerText,
  presentationGroupOptions,
  presentationView,
  priority,
  priorityPickerOpen,
  scopedTeamItems,
  selectedLabelIds,
  selectedLabels,
  selectedLead,
  selectedMembers,
  startDate,
  status,
  statusPickerOpen,
  targetDate,
  teamMembers,
  onClearPresentationDisplayProperties,
  onClearPresentationFilters,
  onLabelIdsChange,
  onLabelsPickerOpenChange,
  onLabelQueryChange,
  onLeadChange,
  onLeadPickerOpenChange,
  onLeadQueryChange,
  onMemberIdsChange,
  onMembersPickerOpenChange,
  onMemberQueryChange,
  onPriorityChange,
  onPriorityPickerOpenChange,
  onReorderPresentationDisplayProperties,
  onStartDateChange,
  onStatusChange,
  onStatusPickerOpenChange,
  onTargetDateChange,
  onTogglePresentationDisplayProperty,
  onTogglePresentationFilterValue,
  onUpdatePresentationView,
}: {
  availableLabels: ProjectDialogLabel[]
  defaultLeadIdForSelectedTeam: string | null
  labelQuery: string
  labelsPickerOpen: boolean
  labelsTriggerText: string
  leadId: string | null
  leadPickerOpen: boolean
  leadQuery: string
  memberIds: string[]
  memberQuery: string
  membersPickerOpen: boolean
  membersTriggerText: string
  presentationGroupOptions: ReturnType<
    typeof getProjectPresentationGroupOptions
  >
  presentationView: ViewDefinition | null
  priority: Priority
  priorityPickerOpen: boolean
  scopedTeamItems: ReturnType<typeof getVisibleWorkItems>
  selectedLabelIds: string[]
  selectedLabels: ProjectDialogLabel[]
  selectedLead: ProjectDialogUser | null
  selectedMembers: ProjectDialogUser[]
  startDate: string | null
  status: ProjectStatus
  statusPickerOpen: boolean
  targetDate: string | null
  teamMembers: ProjectDialogUser[]
  onClearPresentationDisplayProperties: () => void
  onClearPresentationFilters: () => void
  onLabelIdsChange: StringListStateSetter
  onLabelsPickerOpenChange: (open: boolean) => void
  onLabelQueryChange: (query: string) => void
  onLeadChange: (leadId: string | null) => void
  onLeadPickerOpenChange: (open: boolean) => void
  onLeadQueryChange: (query: string) => void
  onMemberIdsChange: StringListStateSetter
  onMembersPickerOpenChange: (open: boolean) => void
  onMemberQueryChange: (query: string) => void
  onPriorityChange: (priority: Priority) => void
  onPriorityPickerOpenChange: (open: boolean) => void
  onReorderPresentationDisplayProperties: (
    displayProps: DisplayProperty[]
  ) => void
  onStartDateChange: (value: string | null) => void
  onStatusChange: (status: ProjectStatus) => void
  onStatusPickerOpenChange: (open: boolean) => void
  onTargetDateChange: (value: string | null) => void
  onTogglePresentationDisplayProperty: (property: DisplayProperty) => void
  onTogglePresentationFilterValue: (key: ViewFilterKey, value: string) => void
  onUpdatePresentationView: (patch: ViewConfigPatch) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
      <ProjectStatusChip
        open={statusPickerOpen}
        status={status}
        onOpenChange={onStatusPickerOpenChange}
        onStatusChange={onStatusChange}
      />
      <ProjectPriorityChip
        open={priorityPickerOpen}
        priority={priority}
        onOpenChange={onPriorityPickerOpenChange}
        onPriorityChange={onPriorityChange}
      />
      <ProjectLeadChip
        defaultLeadId={defaultLeadIdForSelectedTeam}
        leadId={leadId}
        open={leadPickerOpen}
        query={leadQuery}
        selectedLead={selectedLead}
        teamMembers={teamMembers}
        onLeadChange={onLeadChange}
        onOpenChange={onLeadPickerOpenChange}
        onQueryChange={onLeadQueryChange}
      />
      <ProjectMembersChip
        memberIds={memberIds}
        open={membersPickerOpen}
        query={memberQuery}
        selectedMembers={selectedMembers}
        teamMembers={teamMembers}
        leadId={leadId}
        triggerText={membersTriggerText}
        onMemberIdsChange={onMemberIdsChange}
        onOpenChange={onMembersPickerOpenChange}
        onQueryChange={onMemberQueryChange}
      />
      <PropertyDateChip
        label="Start date"
        value={startDate}
        onValueChange={onStartDateChange}
      />
      <PropertyDateChip
        label="Target date"
        value={targetDate}
        onValueChange={onTargetDateChange}
      />
      <ProjectLabelsChip
        availableLabels={availableLabels}
        labelQuery={labelQuery}
        labelsTriggerText={labelsTriggerText}
        open={labelsPickerOpen}
        selectedLabelIds={selectedLabelIds}
        selectedLabels={selectedLabels}
        onLabelIdsChange={onLabelIdsChange}
        onOpenChange={onLabelsPickerOpenChange}
        onQueryChange={onLabelQueryChange}
      />
      <ProjectPresentationControls
        presentationView={presentationView}
        scopedTeamItems={scopedTeamItems}
        presentationGroupOptions={presentationGroupOptions}
        onUpdatePresentationView={onUpdatePresentationView}
        onTogglePresentationFilterValue={onTogglePresentationFilterValue}
        onClearPresentationFilters={onClearPresentationFilters}
        onTogglePresentationDisplayProperty={
          onTogglePresentationDisplayProperty
        }
        onReorderPresentationDisplayProperties={
          onReorderPresentationDisplayProperties
        }
        onClearPresentationDisplayProperties={
          onClearPresentationDisplayProperties
        }
      />
    </div>
  )
}

function ProjectDialogFooter({
  canCreate,
  selectedTeam,
  shortcutModifierLabel,
  onCancel,
  onCreate,
}: {
  canCreate: boolean
  selectedTeam: ProjectDialogTeam | null
  shortcutModifierLabel: string
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
        <FolderSimple className="size-[13px] shrink-0" />
        <span className="truncate">
          {selectedTeam ? (
            <>
              Adding to{" "}
              <b className="font-medium text-foreground">{selectedTeam.name}</b>
            </>
          ) : (
            "Select a team space"
          )}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
          <ShortcutKeys
            keys={["Esc"]}
            className="ml-1"
            keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
          />
        </Button>
        <Button
          size="sm"
          disabled={!canCreate}
          onClick={onCreate}
          className="gap-1"
        >
          Create project
          <ShortcutKeys
            keys={[shortcutModifierLabel, "Enter"]}
            variant="inline"
            className="ml-0.5 gap-0.5 text-background/65"
          />
        </Button>
      </div>
    </div>
  )
}

function CreateProjectDialogContent({
  open,
  onOpenChange,
  defaultTeamId,
}: CreateProjectDialogProps) {
  const appData = useAppStore(useShallow(selectAppDataSnapshot))
  const availableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "projects"))
  )
  const { allLabels, currentUserId, teamMemberships, users } = useAppStore(
    useShallow((state) => ({
      allLabels: state.labels,
      currentUserId: state.currentUserId,
      teamMemberships: state.teamMemberships,
      users: state.users,
    }))
  )
  const shortcutModifierLabel = useShortcutModifierLabel()

  const initialTeamId =
    defaultTeamId && availableTeams.some((team) => team.id === defaultTeamId)
      ? defaultTeamId
      : (availableTeams[0]?.id ?? "")
  const initialTeam =
    availableTeams.find((entry) => entry.id === initialTeamId) ?? null
  const initialTeamMembers = getDialogTeamMembers(
    initialTeamId,
    teamMemberships,
    users
  )
  const initialTemplateType = getDefaultTemplateTypeForTeamExperience(
    initialTeam?.settings.experience
  )
  const initialLeadId =
    initialTeamMembers.find((member) => member.id === currentUserId)?.id ??
    initialTeamMembers[0]?.id ??
    null
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId)
  const settingsTeam = useMemo(
    () => availableTeams.find((entry) => entry.id === selectedTeamId) ?? null,
    [availableTeams, selectedTeamId]
  )
  const labels = useMemo(
    () =>
      settingsTeam
        ? allLabels.filter(
            (label) => label.workspaceId === settingsTeam.workspaceId
          )
        : [],
    [allLabels, settingsTeam]
  )
  const teamMembers = useMemo(
    () => getDialogTeamMembers(selectedTeamId, teamMemberships, users),
    [selectedTeamId, teamMemberships, users]
  )
  const availableLabels = useMemo(
    () => sortLabelsByName(labels),
    [labels]
  )
  const templateType = getDefaultTemplateTypeForTeamExperience(
    settingsTeam?.settings.experience
  )
  const templateDefaults = getTemplateDefaultsForTeam(
    settingsTeam,
    templateType
  )
  const [name, setName] = useState("")
  const [summary, setSummary] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("backlog")
  const [priority, setPriority] = useState<Priority>("none")
  const [leadId, setLeadId] = useState<string | null>(initialLeadId)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [targetDate, setTargetDate] = useState<string | null>(null)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [presentation, setPresentation] = useState<ProjectPresentationConfig>(
    () => createInitialProjectPresentationConfig(initialTemplateType)
  )
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [membersPickerOpen, setMembersPickerOpen] = useState(false)
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState("")
  const [memberQuery, setMemberQuery] = useState("")
  const [labelQuery, setLabelQuery] = useState("")
  const nameLimitState = getTextInputLimitState(name, projectNameConstraints)
  const summaryLimitState = getTextInputLimitState(
    summary,
    projectSummaryConstraints
  )
  const normalizedName = name.trim()
  const normalizedSummary = summary.trim()
  const resolvedSummary = normalizedSummary
  const resolvedMemberIds = useMemo(
    () => [...new Set(memberIds)].filter(Boolean),
    [memberIds]
  )
  const defaultLeadIdForSelectedTeam =
    teamMembers.find((member) => member.id === currentUserId)?.id ??
    teamMembers[0]?.id ??
    null
  const selectedLead = useMemo(
    () => teamMembers.find((member) => member.id === leadId) ?? null,
    [teamMembers, leadId]
  )
  const selectedMembers = useMemo(
    () => teamMembers.filter((member) => resolvedMemberIds.includes(member.id)),
    [teamMembers, resolvedMemberIds]
  )
  const selectedLabels = useMemo(
    () =>
      availableLabels.filter((label) => selectedLabelIds.includes(label.id)),
    [availableLabels, selectedLabelIds]
  )
  const canCreate =
    availableTeams.length > 0 &&
    nameLimitState.canSubmit &&
    summaryLimitState.canSubmit &&
    Boolean(selectedTeamId) &&
    Boolean(leadId)
  const presentationGroupOptions = useMemo(
    () => getProjectPresentationGroupOptions(templateType),
    [templateType]
  )
  const scopedTeamItems = useMemo(
    () =>
      selectedTeamId
        ? getVisibleWorkItems(appData, { teamId: selectedTeamId })
        : [],
    [appData, selectedTeamId]
  )
  const presentationView = useMemo<ViewDefinition | null>(() => {
    if (!selectedTeamId) {
      return null
    }

    return {
      id: "__draft_project_presentation__",
      name: "Project view",
      description: "",
      scopeType: "team",
      scopeId: selectedTeamId,
      entityKind: "items",
      itemLevel: presentation.itemLevel ?? null,
      showChildItems: presentation.showChildItems ?? false,
      layout: presentation.layout,
      filters: presentation.filters,
      grouping: presentation.grouping,
      subGrouping: null,
      ordering: presentation.ordering,
      displayProps: presentation.displayProps,
      hiddenState: {
        groups: [],
        subgroups: [],
      },
      isShared: true,
      route: settingsTeam ? `/team/${settingsTeam.slug}/projects` : "",
      createdAt: "__draft__",
      updatedAt: "__draft__",
    }
  }, [presentation, selectedTeamId, settingsTeam])

  function updatePresentationView(patch: ViewConfigPatch) {
    setPresentation((current) => applyViewConfigPatch(current, patch))
  }

  function togglePresentationFilterValue(key: ViewFilterKey, value: string) {
    setPresentation((current) => {
      const currentValues = current.filters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      return {
        ...current,
        filters: {
          ...current.filters,
          [key]: nextValues as never,
        },
      }
    })
  }

  function clearPresentationFilters() {
    setPresentation((current) => ({
      ...current,
      filters: createEmptyViewFilters(),
    }))
  }

  function clearPresentationDisplayProperties() {
    setPresentation((current) => ({
      ...current,
      displayProps: [],
    }))
  }

  function togglePresentationDisplayProperty(property: DisplayProperty) {
    if (property === "project") {
      return
    }

    setPresentation((current) => ({
      ...current,
      displayProps: current.displayProps.includes(property)
        ? current.displayProps.filter((value) => value !== property)
        : [...current.displayProps, property],
    }))
  }

  function reorderPresentationDisplayProperties(
    displayProps: DisplayProperty[]
  ) {
    setPresentation((current) => ({
      ...current,
      displayProps,
    }))
  }

  function syncTeamSelection(nextTeamId: string) {
    const nextTeam =
      availableTeams.find((entry) => entry.id === nextTeamId) ?? null
    const nextTemplateType = getDefaultTemplateTypeForTeamExperience(
      nextTeam?.settings.experience
    )
    const nextTeamMembers = getDialogTeamMembers(
      nextTeamId,
      teamMemberships,
      users
    )
    const nextLeadId =
      nextTeamMembers.find((member) => member.id === currentUserId)?.id ??
      nextTeamMembers[0]?.id ??
      null

    setSelectedTeamId(nextTeamId)
    setStatus("backlog")
    setPriority("none")
    setLeadId(nextLeadId)
    setMemberIds([])
    setStartDate(null)
    setTargetDate(null)
    setSelectedLabelIds([])
    setPresentation(createInitialProjectPresentationConfig(nextTemplateType))
  }

  const handleCreate = useCallback(() => {
    if (!selectedTeamId || !leadId) {
      return
    }

    useAppStore.getState().createProject({
      scopeType: "team",
      scopeId: selectedTeamId,
      templateType,
      name: normalizedName,
      summary: resolvedSummary,
      status,
      priority,
      leadId,
      memberIds: resolvedMemberIds,
      startDate,
      targetDate,
      labelIds: selectedLabelIds,
      settingsTeamId: selectedTeamId,
      presentation: {
        ...presentation,
        displayProps: [...presentation.displayProps],
        filters: cloneViewFilters(presentation.filters),
      },
    })
    onOpenChange(false)
  }, [
    leadId,
    normalizedName,
    onOpenChange,
    presentation,
    priority,
    resolvedMemberIds,
    resolvedSummary,
    selectedLabelIds,
    selectedTeamId,
    startDate,
    status,
    targetDate,
    templateType,
  ])

  useCommandEnterSubmit(open && canCreate, handleCreate)

  const labelsTriggerText = getCollectionTriggerText(
    selectedLabels,
    "Labels",
    "labels"
  )
  const membersTriggerText = getCollectionTriggerText(
    selectedMembers,
    "Members",
    "members"
  )

  const controlStripProps = {
    availableLabels,
    teamMembers,
    defaultLeadIdForSelectedTeam,
    selectedMembers,
    labelQuery,
    selectedLead,
    labelsPickerOpen,
    selectedLabels,
    labelsTriggerText,
    selectedLabelIds,
    leadId,
    scopedTeamItems,
    leadPickerOpen,
    priorityPickerOpen,
    leadQuery,
    priority,
    memberIds,
    presentationView,
    memberQuery,
    presentationGroupOptions,
    membersPickerOpen,
    membersTriggerText,
    startDate,
    status,
    statusPickerOpen,
    targetDate,
    onClearPresentationDisplayProperties: clearPresentationDisplayProperties,
    onClearPresentationFilters: clearPresentationFilters,
    onLabelIdsChange: setSelectedLabelIds,
    onLabelsPickerOpenChange: setLabelsPickerOpen,
    onLabelQueryChange: setLabelQuery,
    onLeadChange: setLeadId,
    onLeadPickerOpenChange: setLeadPickerOpen,
    onLeadQueryChange: setLeadQuery,
    onMemberIdsChange: setMemberIds,
    onMembersPickerOpenChange: setMembersPickerOpen,
    onMemberQueryChange: setMemberQuery,
    onPriorityChange: setPriority,
    onPriorityPickerOpenChange: setPriorityPickerOpen,
    onReorderPresentationDisplayProperties: reorderPresentationDisplayProperties,
    onStartDateChange: setStartDate,
    onStatusChange: setStatus,
    onStatusPickerOpenChange: setStatusPickerOpen,
    onTargetDateChange: setTargetDate,
    onTogglePresentationDisplayProperty: togglePresentationDisplayProperty,
    onTogglePresentationFilterValue: togglePresentationFilterValue,
    onUpdatePresentationView: updatePresentationView,
  } satisfies Parameters<typeof ProjectDialogControlStrip>[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-6 max-h-[calc(100vh-3rem)] translate-y-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-10 sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project and configure its default presentation before
            teammates start using it.
          </DialogDescription>
        </DialogHeader>

        <ProjectDialogHeader
          availableTeams={availableTeams}
          selectedTeamId={selectedTeamId}
          onTeamSelect={syncTeamSelection}
        />

        <ProjectBasicsFields
          name={name}
          summary={summary}
          summaryHint={templateDefaults.summaryHint}
          nameLimitState={nameLimitState}
          summaryLimitState={summaryLimitState}
          onNameChange={setName}
          onSummaryChange={setSummary}
        />

        <ProjectDialogControlStrip {...controlStripProps} />

        {availableTeams.length === 0 ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            No editable team spaces support project creation right now.
          </p>
        ) : null}

        <ProjectDialogFooter
          canCreate={canCreate}
          selectedTeam={settingsTeam}
          shortcutModifierLabel={shortcutModifierLabel}
          onCancel={() => onOpenChange(false)}
          onCreate={handleCreate}
        />
      </DialogContent>
    </Dialog>
  )
}
