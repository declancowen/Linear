"use client"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  Check,
  FolderSimple,
  MagnifyingGlass,
  Tag,
  TreeStructure,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
  getStatusOrderForTeam,
} from "@/lib/domain/selectors"
import {
  getTextInputLimitState,
  labelNameConstraints,
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
import {
  canParentWorkItemTypeAcceptChild,
  getAllowedWorkItemTypesForTemplate,
  getDefaultRootWorkItemTypesForTeamExperience,
  getDefaultTemplateTypeForTeamExperience,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  type Label,
  type Priority,
  type Project,
  type Team,
  type TeamMembership,
  type UserProfile,
  type WorkItem,
  type WorkItemType,
  type WorkItemVisibility,
  type WorkStatus,
} from "@/lib/domain/types"
import { getLabelScopeType, sortLabelsByName } from "@/lib/domain/labels"
import { useAppStore } from "@/lib/store/app-store"
import {
  getBrowserTimeZone,
  getSupportedTimeZones,
  normalizeTimeZone,
} from "@/lib/time-zone"
import { Button } from "@/components/ui/button"
import { ProjectIconGlyph } from "@/components/app/entity-icons"
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
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { prepareRichTextForStorage } from "@/lib/content/rich-text-security"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  createLabelAndSelect,
  NewLabelInput,
} from "@/components/app/screens/create-work-item-labels"
import { getPreferredCreateDialogType } from "@/components/app/screens/helpers"
import {
  PropertyDateChip,
  PropertyAssigneePicker,
  WorkItemPriorityPropertyPicker,
  WorkItemStatusPropertyPicker,
  WorkItemTypePropertyPicker,
  PropertySelectionPopover,
  matchesPropertyQuery,
  propertyChipTriggerClass as chipTriggerClass,
  propertyChipTriggerDashedClass as chipTriggerDashedClass,
  propertyCrumbTriggerClass as crumbTriggerClass,
} from "@/components/app/screens/property-chips"
import { LabelColorDot } from "@/components/app/screens/shared"
import { cn } from "@/lib/utils"
import { TeamSpaceCrumbPicker } from "./team-space-crumb-picker"
import { useWorkItemCorePickerState } from "./work-item-picker-state"

type TextLimitState = ReturnType<typeof getTextInputLimitState>

const EMPTY_CREATE_TITLE_CAN_SUBMIT = getTextInputLimitState(
  "",
  workItemTitleConstraints
).canSubmit

function CreateWorkItemCrumbRow({
  destinationOptions,
  selectedDestinationId,
  team,
  onSelectDestination,
  typePickerOpen,
  onTypePickerOpenChange,
  availableItemTypes,
  selectedType,
  selectedTypeLabel,
  onSelectType,
  secondaryContextLabel,
}: {
  destinationOptions: Array<{
    id: string
    label: string
    teamId?: string | null
  }>
  selectedDestinationId: string
  team: Team | null
  onSelectDestination: (destinationId: string) => void
  typePickerOpen: boolean
  onTypePickerOpenChange: (open: boolean) => void
  availableItemTypes: WorkItemType[]
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  onSelectType: (type: WorkItemType) => void
  secondaryContextLabel: string | null
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
      <TeamSpaceCrumbPicker
        options={destinationOptions}
        selectedId={selectedDestinationId}
        onSelect={onSelectDestination}
        groupLabel="Destinations"
        searchPlaceholder="Switch destination…"
        emptyLabel="No destinations"
        triggerClassName={crumbTriggerClass}
      />

      <WorkItemTypePropertyPicker
        open={typePickerOpen}
        onOpenChange={onTypePickerOpenChange}
        availableItemTypes={availableItemTypes}
        selectedType={selectedType}
        selectedTypeLabel={selectedTypeLabel}
        team={team}
        onSelect={onSelectType}
      />

      {secondaryContextLabel ? (
        <span className="ml-0.5 text-fg-4">-&gt; {secondaryContextLabel}</span>
      ) : null}

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

function CreateWorkItemTitleFields({
  titlePlaceholder,
  onTitleDraftChange,
  onDescriptionDraftChange,
}: {
  titlePlaceholder: string
  onTitleDraftChange: (title: string, canSubmit: boolean) => void
  onDescriptionDraftChange: (description: string) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const titleLimitState = useMemo(
    () => getTextInputLimitState(title, workItemTitleConstraints),
    [title]
  )

  function handleTitleChange(nextTitle: string) {
    const nextLimitState = getTextInputLimitState(
      nextTitle,
      workItemTitleConstraints
    )

    setTitle(nextTitle)
    onTitleDraftChange(nextTitle, nextLimitState.canSubmit)
  }

  function handleDescriptionChange(nextDescription: string) {
    setDescription(nextDescription)
    onDescriptionDraftChange(nextDescription)
  }

  return (
    <div className="px-[18px] pt-3 pb-0.5">
      <Input
        value={title}
        onChange={(event) => handleTitleChange(event.target.value)}
        placeholder={titlePlaceholder}
        maxLength={workItemTitleConstraints.max}
        className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <FieldCharacterLimit
        state={titleLimitState}
        limit={workItemTitleConstraints.max}
        className="mt-1"
      />
      <RichTextEditor
        content={description}
        onChange={handleDescriptionChange}
        placeholder="Add description…"
        compact
        showToolbar={false}
        showStats={false}
        className="mt-0.5 min-h-[60px] text-[13.5px] leading-[1.6] text-fg-2"
      />
    </div>
  )
}

function AssigneePicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  teamMembers,
  selectedAssignees,
  effectiveAssigneeIds,
  onAssigneeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  teamMembers: UserProfile[]
  selectedAssignees: UserProfile[]
  effectiveAssigneeIds: string[]
  onAssigneeChange: (assigneeId: string) => void
}) {
  return (
    <PropertyAssigneePicker
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={onQueryChange}
      members={teamMembers}
      selectedAssignees={selectedAssignees}
      selectedAssigneeIds={effectiveAssigneeIds}
      selectionMode="multiple"
      disabled={!team}
      onSelect={onAssigneeChange}
    />
  )
}

function ProjectPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  teamProjects,
  selectedProject,
  effectiveProjectId,
  selectedParentItem,
  onProjectChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  teamProjects: Project[]
  selectedProject: Project | null
  effectiveProjectId: string
  selectedParentItem: WorkItem | null
  onProjectChange: (projectId: string) => void
}) {
  const matches = teamProjects.filter((project) =>
    matchesPropertyQuery(project.name, query)
  )

  return (
    <PropertySelectionPopover
      open={open}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
      trigger={
        <button
          type="button"
          className={cn(
            chipTriggerClass,
            !selectedProject && chipTriggerDashedClass
          )}
          disabled={!team || Boolean(selectedParentItem?.primaryProjectId)}
        >
          {selectedProject ? (
            <ProjectIconGlyph
              project={selectedProject}
              className="size-[13px] shrink-0"
            />
          ) : (
            <FolderSimple className="size-[13px] shrink-0" />
          )}
          <span
            className={cn(
              "truncate",
              selectedProject && "font-medium text-foreground"
            )}
          >
            {selectedProject ? selectedProject.name : "Project"}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      }
    >
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Find project…"
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Projects</PropertyPopoverGroup>
              {matches.map((project) => {
                const selected = project.id === effectiveProjectId
                return (
                  <PropertyPopoverItem
                    key={project.id}
                    selected={selected}
                    onClick={() => onProjectChange(project.id)}
                    trailing={
                      selected ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <ProjectIconGlyph
                      project={project}
                      className="size-[14px] shrink-0 text-fg-3"
                    />
                    <span className="truncate">{project.name}</span>
                  </PropertyPopoverItem>
                )
              })}
            </>
          ) : (
            <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
              No projects match
            </div>
          )}
          <PropertyPopoverItem
            muted
            selected={effectiveProjectId === "none"}
            onClick={() => onProjectChange("none")}
            trailing={
              effectiveProjectId === "none" ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>No project</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </PropertySelectionPopover>
  )
}

function ParentPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  parentOptions,
  selectedParentId,
  selectedParentItem,
  onParentChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  parentOptions: WorkItem[]
  selectedParentId: string
  selectedParentItem: WorkItem | null
  onParentChange: (parentId: string) => void
}) {
  const matches = parentOptions.filter(
    (item) =>
      matchesPropertyQuery(item.key, query) ||
      matchesPropertyQuery(item.title, query)
  )

  return (
    <PropertySelectionPopover
      open={open}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
      trigger={
        <button
          type="button"
          className={cn(
            chipTriggerClass,
            !selectedParentItem && chipTriggerDashedClass
          )}
          disabled={!team || parentOptions.length === 0}
        >
          <TreeStructure className="size-[13px]" />
          <span
            className={cn(
              "truncate",
              selectedParentItem && "font-medium text-foreground"
            )}
          >
            {selectedParentItem ? `${selectedParentItem.key}` : "Parent"}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      }
    >
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Find parent…"
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Available parents</PropertyPopoverGroup>
              {matches.map((parentOption) => {
                const selected = parentOption.id === selectedParentId
                return (
                  <PropertyPopoverItem
                    key={parentOption.id}
                    selected={selected}
                    onClick={() => onParentChange(parentOption.id)}
                    className="h-auto min-h-9 py-1.5"
                    trailing={
                      selected ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <TreeStructure className="size-[14px] shrink-0 text-fg-3" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[11px] leading-none text-fg-3">
                        {parentOption.key}
                      </span>
                      <span className="truncate leading-4 text-foreground">
                        {parentOption.title}
                      </span>
                    </span>
                  </PropertyPopoverItem>
                )
              })}
            </>
          ) : (
            <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
              No parents available
            </div>
          )}
          <PropertyPopoverItem
            muted
            selected={selectedParentId === "none"}
            onClick={() => onParentChange("none")}
            trailing={
              selectedParentId === "none" ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>No parent</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </PropertySelectionPopover>
  )
}

function getLabelsTriggerText(selectedLabels: Label[]) {
  if (selectedLabels.length === 0) {
    return "Add label"
  }

  if (selectedLabels.length === 1) {
    return selectedLabels[0]?.name ?? "Labels"
  }

  return `${selectedLabels[0]?.name ?? "Label"} +${selectedLabels.length - 1}`
}

function getMatchedLabelGroups(input: {
  availableLabels: Label[]
  query: string
  selectedLabelIds: string[]
}) {
  const matched = input.availableLabels.filter((label) =>
    matchesPropertyQuery(label.name, input.query.trim())
  )

  return {
    matched,
    selected: matched.filter((label) =>
      input.selectedLabelIds.includes(label.id)
    ),
    unselected: matched.filter(
      (label) => !input.selectedLabelIds.includes(label.id)
    ),
  }
}

function LabelOptionItem({
  label,
  selected,
  onToggleLabel,
}: {
  label: Label
  selected?: boolean
  onToggleLabel: (labelId: string) => void
}) {
  return (
    <PropertyPopoverItem
      selected={selected}
      onClick={() => onToggleLabel(label.id)}
      trailing={
        selected ? <Check className="size-[14px] text-foreground" /> : null
      }
    >
      <LabelColorDot color={label.color} className="size-2" />
      <span className="truncate">{label.name}</span>
    </PropertyPopoverItem>
  )
}

function LabelOptionsGroup({
  labels,
  selected,
  title,
  onToggleLabel,
}: {
  labels: Label[]
  selected?: boolean
  title: string
  onToggleLabel: (labelId: string) => void
}) {
  if (labels.length === 0) {
    return null
  }

  return (
    <>
      <PropertyPopoverGroup>{title}</PropertyPopoverGroup>
      {labels.map((label) => (
        <LabelOptionItem
          key={label.id}
          label={label}
          selected={selected}
          onToggleLabel={onToggleLabel}
        />
      ))}
    </>
  )
}

function LabelsEmptyState({
  availableLabels,
  matchedLabels,
}: {
  availableLabels: Label[]
  matchedLabels: Label[]
}) {
  if (matchedLabels.length > 0) {
    return null
  }

  return (
    <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
      {availableLabels.length === 0 ? "No labels yet" : "No labels match"}
    </div>
  )
}

function LabelsPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  availableLabels,
  selectedLabels,
  selectedLabelIds,
  newLabelName,
  onNewLabelNameChange,
  labelNameLimitState,
  creatingLabel,
  onToggleLabel,
  onClearLabels,
  onCreateLabel,
  canCreateLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  availableLabels: Label[]
  selectedLabels: Label[]
  selectedLabelIds: string[]
  newLabelName: string
  onNewLabelNameChange: (name: string) => void
  labelNameLimitState: TextLimitState
  creatingLabel: boolean
  onToggleLabel: (labelId: string) => void
  onClearLabels: () => void
  onCreateLabel: () => void
  canCreateLabel: boolean
}) {
  const labelsTriggerText = getLabelsTriggerText(selectedLabels)
  const { matched, selected, unselected } = getMatchedLabelGroups({
    availableLabels,
    query,
    selectedLabelIds,
  })

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
          onNewLabelNameChange("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chipTriggerClass,
            selectedLabels.length === 0 && chipTriggerDashedClass
          )}
          disabled={!canCreateLabel}
        >
          <Tag className="size-[13px]" />
          <span
            className={cn(
              "truncate",
              selectedLabels.length > 0 && "font-medium text-foreground"
            )}
          >
            {labelsTriggerText}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[260px]")}
      >
        <PropertyPopoverSearch
          icon={<Tag className="size-[14px]" />}
          placeholder="Filter labels…"
          value={query}
          onChange={onQueryChange}
          trailing={
            selectedLabelIds.length > 0 ? (
              <button
                type="button"
                className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                onClick={onClearLabels}
              >
                Clear
              </button>
            ) : undefined
          }
        />
        <PropertyPopoverList>
          <LabelOptionsGroup
            labels={selected}
            selected
            title={`Selected · ${selected.length}`}
            onToggleLabel={onToggleLabel}
          />
          <LabelOptionsGroup
            labels={unselected}
            title="All"
            onToggleLabel={onToggleLabel}
          />
          <LabelsEmptyState
            availableLabels={availableLabels}
            matchedLabels={matched}
          />
          <NewLabelInput
            creatingLabel={creatingLabel}
            canCreateLabel={canCreateLabel}
            labelNameLimitState={labelNameLimitState}
            newLabelName={newLabelName}
            team={team}
            onCreateLabel={onCreateLabel}
            onNewLabelNameChange={onNewLabelNameChange}
          />
        </PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>Tap to toggle · Esc to close</span>
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function CreateWorkItemPropertiesRow({
  showAssignee,
  showLabels,
  showProject,
  team,
  status,
  teamStatuses,
  statusPickerOpen,
  setStatusPickerOpen,
  statusQuery,
  setStatusQuery,
  onStatusChange,
  priority,
  priorityPickerOpen,
  setPriorityPickerOpen,
  onPriorityChange,
  assigneePickerOpen,
  setAssigneePickerOpen,
  assigneeQuery,
  setAssigneeQuery,
  teamMembers,
  selectedAssignees,
  effectiveAssigneeIds,
  onAssigneeChange,
  projectPickerOpen,
  setProjectPickerOpen,
  projectQuery,
  setProjectQuery,
  teamProjects,
  selectedProject,
  effectiveProjectId,
  selectedParentItem,
  onProjectChange,
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  targetDate,
  setTargetDate,
  endTime,
  setEndTime,
  scheduleTimeZone,
  setScheduleTimeZone,
  showParentSelect,
  parentPickerOpen,
  setParentPickerOpen,
  parentQuery,
  setParentQuery,
  parentOptions,
  selectedParentId,
  onParentChange,
  labelsPickerOpen,
  canCreateLabel,
  setLabelsPickerOpen,
  labelQuery,
  setLabelQuery,
  availableLabels,
  selectedLabels,
  selectedLabelIds,
  newLabelName,
  setNewLabelName,
  labelNameLimitState,
  creatingLabel,
  onToggleLabel,
  onClearLabels,
  onCreateLabel,
}: {
  showAssignee: boolean
  showLabels: boolean
  showProject: boolean
  team: Team | null
  status: WorkStatus
  teamStatuses: WorkStatus[]
  statusPickerOpen: boolean
  setStatusPickerOpen: Dispatch<SetStateAction<boolean>>
  statusQuery: string
  setStatusQuery: Dispatch<SetStateAction<string>>
  onStatusChange: (status: WorkStatus) => void
  priority: Priority
  priorityPickerOpen: boolean
  setPriorityPickerOpen: Dispatch<SetStateAction<boolean>>
  onPriorityChange: (priority: Priority) => void
  assigneePickerOpen: boolean
  setAssigneePickerOpen: Dispatch<SetStateAction<boolean>>
  assigneeQuery: string
  setAssigneeQuery: Dispatch<SetStateAction<string>>
  teamMembers: UserProfile[]
  selectedAssignees: UserProfile[]
  effectiveAssigneeIds: string[]
  onAssigneeChange: (assigneeId: string) => void
  projectPickerOpen: boolean
  setProjectPickerOpen: Dispatch<SetStateAction<boolean>>
  projectQuery: string
  setProjectQuery: Dispatch<SetStateAction<string>>
  teamProjects: Project[]
  selectedProject: Project | null
  effectiveProjectId: string
  selectedParentItem: WorkItem | null
  onProjectChange: (projectId: string) => void
  startDate: string | null
  setStartDate: Dispatch<SetStateAction<string | null>>
  startTime: string | null
  setStartTime: Dispatch<SetStateAction<string | null>>
  targetDate: string | null
  setTargetDate: Dispatch<SetStateAction<string | null>>
  endTime: string | null
  setEndTime: Dispatch<SetStateAction<string | null>>
  scheduleTimeZone: string | null
  setScheduleTimeZone: Dispatch<SetStateAction<string | null>>
  showParentSelect: boolean
  parentPickerOpen: boolean
  setParentPickerOpen: Dispatch<SetStateAction<boolean>>
  parentQuery: string
  setParentQuery: Dispatch<SetStateAction<string>>
  parentOptions: WorkItem[]
  selectedParentId: string
  onParentChange: (parentId: string) => void
  labelsPickerOpen: boolean
  canCreateLabel: boolean
  setLabelsPickerOpen: Dispatch<SetStateAction<boolean>>
  labelQuery: string
  setLabelQuery: Dispatch<SetStateAction<string>>
  availableLabels: Label[]
  selectedLabels: Label[]
  selectedLabelIds: string[]
  newLabelName: string
  setNewLabelName: Dispatch<SetStateAction<string>>
  labelNameLimitState: TextLimitState
  creatingLabel: boolean
  onToggleLabel: (labelId: string) => void
  onClearLabels: () => void
  onCreateLabel: () => void
}) {
  const timeZoneOptions = useMemo(() => getSupportedTimeZones(), [])

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
      <WorkItemStatusPropertyPicker
        open={statusPickerOpen}
        onOpenChange={setStatusPickerOpen}
        query={statusQuery}
        onQueryChange={setStatusQuery}
        team={team}
        status={status}
        teamStatuses={teamStatuses}
        onSelect={onStatusChange}
      />

      <WorkItemPriorityPropertyPicker
        open={priorityPickerOpen}
        onOpenChange={setPriorityPickerOpen}
        team={team}
        priority={priority}
        onSelect={onPriorityChange}
      />

      {showAssignee ? (
        <AssigneePicker
          open={assigneePickerOpen}
          onOpenChange={setAssigneePickerOpen}
          query={assigneeQuery}
          onQueryChange={setAssigneeQuery}
          team={team}
          teamMembers={teamMembers}
          selectedAssignees={selectedAssignees}
          effectiveAssigneeIds={effectiveAssigneeIds}
          onAssigneeChange={onAssigneeChange}
        />
      ) : null}

      {showProject ? (
        <ProjectPicker
          open={projectPickerOpen}
          onOpenChange={setProjectPickerOpen}
          query={projectQuery}
          onQueryChange={setProjectQuery}
          team={team}
          teamProjects={teamProjects}
          selectedProject={selectedProject}
          effectiveProjectId={effectiveProjectId}
          selectedParentItem={selectedParentItem}
          onProjectChange={onProjectChange}
        />
      ) : null}

      <PropertyDateChip
        value={startDate}
        label="Start date"
        timeValue={startTime}
        timeZoneValue={scheduleTimeZone}
        timeZoneOptions={timeZoneOptions}
        onTimeValueChange={setStartTime}
        onTimeZoneValueChange={setScheduleTimeZone}
        onValueChange={setStartDate}
      />
      <PropertyDateChip
        value={targetDate}
        label="Target date"
        timeValue={endTime}
        timeZoneValue={scheduleTimeZone}
        timeZoneOptions={timeZoneOptions}
        onTimeValueChange={setEndTime}
        onTimeZoneValueChange={setScheduleTimeZone}
        onValueChange={setTargetDate}
      />

      {showParentSelect ? (
        <ParentPicker
          open={parentPickerOpen}
          onOpenChange={setParentPickerOpen}
          query={parentQuery}
          onQueryChange={setParentQuery}
          team={team}
          parentOptions={parentOptions}
          selectedParentId={selectedParentId}
          selectedParentItem={selectedParentItem}
          onParentChange={onParentChange}
        />
      ) : null}

      {showLabels ? (
        <LabelsPicker
          open={labelsPickerOpen}
          onOpenChange={setLabelsPickerOpen}
          query={labelQuery}
          onQueryChange={setLabelQuery}
          team={team}
          availableLabels={availableLabels}
          selectedLabels={selectedLabels}
          selectedLabelIds={selectedLabelIds}
          newLabelName={newLabelName}
          onNewLabelNameChange={setNewLabelName}
          labelNameLimitState={labelNameLimitState}
          creatingLabel={creatingLabel}
          canCreateLabel={canCreateLabel}
          onToggleLabel={onToggleLabel}
          onClearLabels={onClearLabels}
          onCreateLabel={onCreateLabel}
        />
      ) : null}
    </div>
  )
}

function CreateWorkItemWarnings({
  hasEditableTeams,
  hasAvailableItemTypes,
}: {
  hasEditableTeams: boolean
  hasAvailableItemTypes: boolean
}) {
  return (
    <>
      {!hasEditableTeams ? (
        <p className="px-[18px] pt-2 text-xs text-destructive">
          No editable team spaces support this work item type yet.
        </p>
      ) : null}

      {hasEditableTeams && !hasAvailableItemTypes ? (
        <p className="px-[18px] pt-2 text-xs text-destructive">
          This team space cannot create top-level work items in the current
          configuration.
        </p>
      ) : null}
    </>
  )
}

function CreateWorkItemFooter({
  destinationLabel,
  selectedProject,
  team,
  canCreate,
  selectedTypeLabel,
  shortcutModifierLabel,
  onCancel,
  onCreate,
}: {
  destinationLabel?: string | null
  selectedProject: Project | null
  team: Team | null
  canCreate: boolean
  selectedTypeLabel: string
  shortcutModifierLabel: string
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
        {selectedProject ? (
          <ProjectIconGlyph
            project={selectedProject}
            className="size-[13px] shrink-0"
          />
        ) : (
          <FolderSimple className="size-[13px] shrink-0" />
        )}
        <span className="truncate">
          {destinationLabel ? (
            <>
              Adding to{" "}
              <b className="font-medium text-foreground">{destinationLabel}</b>
            </>
          ) : selectedProject ? (
            <>
              Adding to{" "}
              <b className="font-medium text-foreground">
                {selectedProject.name}
              </b>
            </>
          ) : team ? (
            <>
              Adding to{" "}
              <b className="font-medium text-foreground">{team.name}</b>
            </>
          ) : (
            "Select a team space"
          )}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-fg-2"
        >
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
          className="gap-1 bg-foreground text-background hover:bg-foreground/90"
        >
          Create {selectedTypeLabel.toLowerCase()}
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

type CreateWorkItemDefaultValues = Partial<{
  status: WorkStatus
  priority: Priority
  assigneeId: string | null
  assigneeIds: string[]
  primaryProjectId: string | null
  parentId: string | null
  labelIds: string[]
  visibility: WorkItemVisibility
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
  startTime: string | null
  endTime: string | null
  scheduleTimeZone: string | null
}>

type InitialCreateWorkItemState = {
  teamId: string
  type: WorkItemType
  status: WorkStatus
  priority: Priority
  assigneeIds: string[]
  projectId: string
}

type WorkSurfaceCopy = ReturnType<typeof getWorkSurfaceCopy>
type CreateWorkItemDestination = "private" | "team"

const PRIVATE_TASK_DESTINATION_ID = "private-tasks"
const PRIVATE_TASK_ITEM_TYPES: WorkItemType[] = ["task", "sub-task"]

function hasItems(items: readonly unknown[]) {
  return items.length > 0
}

function getDefaultPriority(
  defaultValues: CreateWorkItemDefaultValues | undefined
) {
  return defaultValues?.priority ?? "none"
}

function getHasExplicitProjectDefault(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  defaultProjectId: string | null | undefined
) {
  if (
    defaultValues?.parentId &&
    defaultValues.primaryProjectId == null &&
    defaultProjectId == null
  ) {
    return false
  }

  return (
    defaultValues?.primaryProjectId !== undefined ||
    defaultProjectId !== undefined
  )
}

function getHasExplicitProjectDefaultForDestination({
  defaultValues,
  defaultProjectId,
  privateLaunchMode,
  privateTaskMode,
}: {
  defaultValues: CreateWorkItemDefaultValues | undefined
  defaultProjectId: string | null | undefined
  privateLaunchMode: boolean
  privateTaskMode: boolean
}) {
  if (privateLaunchMode && !privateTaskMode) {
    return defaultProjectId !== undefined
  }

  return getHasExplicitProjectDefault(defaultValues, defaultProjectId)
}

function getInitialDates(
  defaultValues: CreateWorkItemDefaultValues | undefined
) {
  return {
    startDate: defaultValues?.startDate ?? null,
    dueDate: defaultValues?.dueDate ?? null,
    targetDate: defaultValues?.targetDate ?? null,
    startTime: defaultValues?.startTime ?? null,
    endTime: defaultValues?.endTime ?? null,
    scheduleTimeZone: defaultValues?.scheduleTimeZone ?? null,
  }
}

function getWorkCopyForTeam(team: Team | null) {
  return getWorkSurfaceCopy(team?.settings.experience)
}

function getFilteredTeamsForInitialType(
  availableTeams: Team[],
  initialType: WorkItemType | null | undefined
) {
  return availableTeams.filter((team) => {
    if (!initialType) {
      return true
    }

    return getDefaultWorkItemTypesForTeamExperience(
      team.settings.experience
    ).includes(initialType)
  })
}

function getTeamById(teams: Team[], teamId: string) {
  return teams.find((entry) => entry.id === teamId) ?? null
}

function getInitialTeamId(
  filteredTeams: Team[],
  defaultTeamId: string | null | undefined
) {
  if (
    defaultTeamId &&
    filteredTeams.some((team) => team.id === defaultTeamId)
  ) {
    return defaultTeamId
  }

  return filteredTeams[0]?.id ?? ""
}

function getInitialDestination(
  defaultValues: CreateWorkItemDefaultValues | undefined
): CreateWorkItemDestination {
  return defaultValues?.visibility === "private" ? "private" : "team"
}

function getDestinationOptions(teams: Team[]) {
  return [
    {
      id: PRIVATE_TASK_DESTINATION_ID,
      label: "Private tasks",
      teamId: null,
    },
    ...teams.map((teamOption) => ({
      id: teamOption.id,
      label: teamOption.name,
      teamId: teamOption.id,
    })),
  ]
}

function getProjectsForTeamCreateScope(projects: Project[], team: Team | null) {
  if (!team) {
    return []
  }

  return projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === team.id) ||
      (project.scopeType === "workspace" &&
        project.scopeId === team.workspaceId)
  )
}

function getInitialWorkItemType(
  initialType: WorkItemType | null | undefined,
  team: Team | null
) {
  const templateType = getDefaultTemplateTypeForTeamExperience(
    team?.settings.experience
  )

  if (
    initialType &&
    getDefaultWorkItemTypesForTeamExperience(
      team?.settings.experience
    ).includes(initialType)
  ) {
    return initialType
  }

  return getPreferredCreateDialogType(templateType)
}

function getInitialStatus(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  statuses: WorkStatus[]
) {
  if (defaultValues?.status && statuses.includes(defaultValues.status)) {
    return defaultValues.status
  }

  if (statuses.includes("todo")) {
    return "todo"
  }

  return statuses[0] ?? "backlog"
}

function getTeamMemberIds(teamMemberships: TeamMembership[], teamId: string) {
  return new Set(
    teamMemberships
      .filter((membership) => membership.teamId === teamId)
      .map((membership) => membership.userId)
  )
}

function getInitialAssigneeIds(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  teamMemberships: TeamMembership[],
  teamId: string
) {
  const memberIds = getTeamMemberIds(teamMemberships, teamId)
  const defaultAssigneeIds = [
    ...(defaultValues?.assigneeIds ?? []),
    ...(defaultValues?.assigneeId ? [defaultValues.assigneeId] : []),
  ]
  const assigneeIds = [
    ...new Set(
      defaultAssigneeIds.filter((assigneeId) => memberIds.has(assigneeId))
    ),
  ]

  return assigneeIds
}

function getInitialProjectId({
  defaultValues,
  defaultProjectId,
  projects,
}: {
  defaultValues: CreateWorkItemDefaultValues | undefined
  defaultProjectId: string | null | undefined
  projects: Project[]
}) {
  if (
    defaultValues?.primaryProjectId &&
    projects.some((project) => project.id === defaultValues.primaryProjectId)
  ) {
    return defaultValues.primaryProjectId
  }

  if (
    defaultProjectId &&
    projects.some((project) => project.id === defaultProjectId)
  ) {
    return defaultProjectId
  }

  return "none"
}

function getInitialCreateWorkItemState({
  filteredTeams,
  defaultTeamId,
  initialType,
  projects,
  defaultProjectId,
  defaultValues,
  teamMemberships,
  privateTaskMode,
}: {
  filteredTeams: Team[]
  defaultTeamId: string | null | undefined
  initialType: WorkItemType | null | undefined
  projects: Project[]
  defaultProjectId: string | null | undefined
  defaultValues: CreateWorkItemDefaultValues | undefined
  teamMemberships: TeamMembership[]
  privateTaskMode: boolean
}): InitialCreateWorkItemState {
  const teamId = getInitialTeamId(filteredTeams, defaultTeamId)
  const team = getTeamById(filteredTeams, teamId)
  const statuses = getStatusOrderForTeam(team)
  const scopedProjects = getProjectsForTeamCreateScope(projects, team)

  return {
    teamId,
    type: privateTaskMode ? "task" : getInitialWorkItemType(initialType, team),
    status: getInitialStatus(defaultValues, statuses),
    priority: defaultValues?.priority ?? "none",
    assigneeIds: privateTaskMode
      ? []
      : getInitialAssigneeIds(defaultValues, teamMemberships, teamId),
    projectId: getInitialProjectId({
      defaultValues,
      defaultProjectId,
      projects: scopedProjects,
    }),
  }
}

function getLabelsForTeam({
  currentUserId,
  labels,
  team,
  visibility,
  workspaceId,
}: {
  currentUserId: string
  labels: Label[]
  team: Team | null
  visibility: WorkItemVisibility
  workspaceId: string | null
}) {
  const resolvedWorkspaceId = team?.workspaceId ?? workspaceId

  if (!resolvedWorkspaceId) {
    return []
  }

  return labels.filter((label) => {
    if (label.workspaceId !== resolvedWorkspaceId) {
      return false
    }

    if (visibility === "private") {
      return (
        getLabelScopeType(label) === "private" &&
        label.ownerId === currentUserId
      )
    }

    return getLabelScopeType(label) === "workspace"
  })
}

function getTeamMembers(
  users: UserProfile[],
  teamMemberships: TeamMembership[],
  teamId: string
) {
  const memberIds = getTeamMemberIds(teamMemberships, teamId)
  return users.filter((user) => memberIds.has(user.id))
}

function getSelectedProject(projectId: string, teamProjects: Project[]) {
  return projectId === "none"
    ? null
    : (teamProjects.find((project) => project.id === projectId) ?? null)
}

function getEffectiveAssigneeIds(
  assigneeIds: string[],
  teamMembers: UserProfile[]
) {
  const memberIds = new Set(teamMembers.map((member) => member.id))
  return assigneeIds.filter((assigneeId) => memberIds.has(assigneeId))
}

function getSelectedAssignees(
  effectiveAssigneeIds: string[],
  teamMembers: UserProfile[]
) {
  const assigneeIdSet = new Set(effectiveAssigneeIds)
  return teamMembers.filter((user) => assigneeIdSet.has(user.id))
}

function isPrivateParentOption(input: {
  currentUserId: string
  item: WorkItem
  selectedWorkspaceId: string | null
}) {
  return (
    input.item.visibility === "private" &&
    input.item.creatorId === input.currentUserId &&
    (input.item.workspaceId ?? null) === input.selectedWorkspaceId
  )
}

function isTeamParentOption(item: WorkItem, selectedTeamId: string) {
  return (
    item.teamId === selectedTeamId && (item.visibility ?? "team") === "team"
  )
}

function isParentOptionInProjectScope({
  item,
  scopedProjectId,
  selectedParentId,
}: {
  item: WorkItem
  scopedProjectId: string | null
  selectedParentId: string
}) {
  return (
    !scopedProjectId ||
    item.primaryProjectId === scopedProjectId ||
    item.id === selectedParentId
  )
}

function canUseParentOption(input: {
  currentUserId: string
  item: WorkItem
  privateTaskMode: boolean
  selectedTeamId: string
  selectedType: WorkItemType
  selectedWorkspaceId: string | null
}) {
  if (!canParentWorkItemTypeAcceptChild(input.item.type, input.selectedType)) {
    return false
  }

  return input.privateTaskMode
    ? isPrivateParentOption(input)
    : isTeamParentOption(input.item, input.selectedTeamId)
}

function getParentOptionsForCreate({
  currentUserId,
  privateTaskMode,
  selectedWorkspaceId,
  workItems,
  selectedTeamId,
  selectedType,
  scopedProjectId,
  selectedParentId,
}: {
  currentUserId: string
  privateTaskMode: boolean
  selectedWorkspaceId: string | null
  workItems: WorkItem[]
  selectedTeamId: string
  selectedType: WorkItemType | null
  scopedProjectId: string | null
  selectedParentId: string
}) {
  if (!selectedType || (!privateTaskMode && !selectedTeamId)) {
    return []
  }

  return [...workItems]
    .filter((item) =>
      canUseParentOption({
        currentUserId,
        item,
        privateTaskMode,
        selectedTeamId,
        selectedType,
        selectedWorkspaceId,
      })
    )
    .filter((item) =>
      isParentOptionInProjectScope({
        item,
        scopedProjectId,
        selectedParentId,
      })
    )
    .sort((left, right) =>
      left.key.localeCompare(right.key, undefined, { numeric: true })
    )
}

function getSelectedParentItem(
  selectedParentId: string,
  parentOptions: WorkItem[]
) {
  return selectedParentId === "none"
    ? null
    : (parentOptions.find((item) => item.id === selectedParentId) ?? null)
}

function getEffectiveProjectId({
  hasExplicitProjectDefault,
  projectId,
  selectedParentItem,
}: {
  hasExplicitProjectDefault: boolean
  projectId: string
  selectedParentItem: WorkItem | null
}) {
  return hasExplicitProjectDefault
    ? projectId
    : (selectedParentItem?.primaryProjectId ?? projectId)
}

function getActiveTemplateType(
  selectedProject: Project | null,
  team: Team | null
) {
  return (
    selectedProject?.templateType ??
    getDefaultTemplateTypeForTeamExperience(team?.settings.experience)
  )
}

function getSelectedWorkItemType(
  availableItemTypes: WorkItemType[],
  type: WorkItemType
) {
  return (
    availableItemTypes.find((value) => value === type) ??
    availableItemTypes[0] ??
    null
  )
}

function getSelectedLabels(
  availableLabels: Label[],
  selectedLabelIds: string[]
) {
  return availableLabels.filter((label) => selectedLabelIds.includes(label.id))
}

function getSelectedTypeLabel({
  selectedType,
  team,
  workCopy,
}: {
  selectedType: WorkItemType | null
  team: Team | null
  workCopy: WorkSurfaceCopy
}) {
  return selectedType
    ? getDisplayLabelForWorkItemType(selectedType, team?.settings.experience)
    : workCopy.singularLabel
}

function getSecondaryContextLabel(
  selectedParentItem: WorkItem | null,
  selectedProject: Project | null
) {
  return selectedParentItem ? null : (selectedProject?.name ?? null)
}

function getTitlePlaceholder({
  selectedType,
  selectedTypeLabel,
  workCopy,
}: {
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  workCopy: WorkSurfaceCopy
}) {
  return selectedType ? `${selectedTypeLabel} title` : workCopy.titlePlaceholder
}

function requiresParentType(selectedType: WorkItemType | null) {
  return selectedType === "sub-task" || selectedType === "sub-issue"
}

function shouldShowParentSelect({
  selectedType,
  requiresParent,
  parentOptions,
  selectedParentItem,
}: {
  selectedType: WorkItemType | null
  requiresParent: boolean
  parentOptions: WorkItem[]
  selectedParentItem: WorkItem | null
}) {
  return (
    Boolean(selectedType) &&
    (requiresParent || parentOptions.length > 0 || selectedParentItem !== null)
  )
}

function canSubmitCreateWorkItem({
  hasCreateScope,
  titleCanSubmit,
  selectedType,
  requiresParent,
  selectedParentItem,
}: {
  hasCreateScope: boolean
  titleCanSubmit: boolean
  selectedType: WorkItemType | null
  requiresParent: boolean
  selectedParentItem: WorkItem | null
}) {
  return (
    hasCreateScope &&
    titleCanSubmit &&
    selectedType !== null &&
    (!requiresParent || selectedParentItem !== null)
  )
}

function getTeamWorkspaceId(
  team: Team | null,
  fallbackWorkspaceId?: string | null
) {
  return team?.workspaceId ?? fallbackWorkspaceId ?? null
}

function canUseCommandSubmit(open: boolean, canCreate: boolean) {
  return open && canCreate
}

function getDefaultTypeForTeamSelection(
  team: Team | null,
  initialType: WorkItemType | null | undefined
) {
  if (
    initialType &&
    getDefaultRootWorkItemTypesForTeamExperience(
      team?.settings.experience
    ).includes(initialType)
  ) {
    return initialType
  }

  return getPreferredCreateDialogType(
    getDefaultTemplateTypeForTeamExperience(team?.settings.experience)
  )
}

function getDefaultProjectForTeamSelection(
  scopedProjects: Project[],
  defaultProjectId: string | null | undefined
) {
  return defaultProjectId &&
    scopedProjects.some((project) => project.id === defaultProjectId)
    ? defaultProjectId
    : "none"
}

function getTeamSelectionDefaults({
  teamId,
  filteredTeams,
  projects,
  initialType,
  defaultProjectId,
  priority,
}: {
  teamId: string
  filteredTeams: Team[]
  projects: Project[]
  initialType: WorkItemType | null | undefined
  defaultProjectId: string | null | undefined
  priority: Priority
}) {
  const team = getTeamById(filteredTeams, teamId)
  const statuses = getStatusOrderForTeam(team)
  const scopedProjects = getProjectsForTeamCreateScope(projects, team)

  return {
    type: getDefaultTypeForTeamSelection(team, initialType),
    status: statuses.includes("todo") ? "todo" : (statuses[0] ?? "backlog"),
    priority,
    projectId: getDefaultProjectForTeamSelection(
      scopedProjects,
      defaultProjectId
    ),
  }
}

function toggleSelectionValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((currentId) => currentId !== value)
    : [...current, value]
}

function applyTeamSelection({
  nextTeamId,
  filteredTeams,
  projects,
  initialType,
  defaultProjectId,
  defaultPriority,
  setSelectedTeamId,
  setType,
  setStatus,
  setPriority,
  setAssigneeIds,
  setProjectId,
  setSelectedParentId,
  setSelectedLabelIds,
  setNewLabelName,
  setCreatingLabel,
}: {
  nextTeamId: string
  filteredTeams: Team[]
  projects: Project[]
  initialType: WorkItemType | null | undefined
  defaultProjectId: string | null | undefined
  defaultPriority: Priority
  setSelectedTeamId: Dispatch<SetStateAction<string>>
  setType: Dispatch<SetStateAction<WorkItemType>>
  setStatus: Dispatch<SetStateAction<WorkStatus>>
  setPriority: Dispatch<SetStateAction<Priority>>
  setAssigneeIds: Dispatch<SetStateAction<string[]>>
  setProjectId: Dispatch<SetStateAction<string>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setSelectedLabelIds: Dispatch<SetStateAction<string[]>>
  setNewLabelName: Dispatch<SetStateAction<string>>
  setCreatingLabel: Dispatch<SetStateAction<boolean>>
}) {
  const nextDefaults = getTeamSelectionDefaults({
    teamId: nextTeamId,
    filteredTeams,
    projects,
    initialType,
    defaultProjectId,
    priority: defaultPriority,
  })

  setSelectedTeamId(nextTeamId)
  setType(nextDefaults.type)
  setStatus(nextDefaults.status)
  setPriority(nextDefaults.priority)
  setAssigneeIds([])
  setProjectId(nextDefaults.projectId)
  setSelectedParentId("none")
  setSelectedLabelIds([])
  setNewLabelName("")
  setCreatingLabel(false)
}

function applyPrivateDestination({
  setDestination,
  setType,
  setAssigneeIds,
  setProjectId,
  setSelectedParentId,
  setSelectedLabelIds,
  setNewLabelName,
  setCreatingLabel,
}: {
  setDestination: Dispatch<SetStateAction<CreateWorkItemDestination>>
  setType: Dispatch<SetStateAction<WorkItemType>>
  setAssigneeIds: Dispatch<SetStateAction<string[]>>
  setProjectId: Dispatch<SetStateAction<string>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setSelectedLabelIds: Dispatch<SetStateAction<string[]>>
  setNewLabelName: Dispatch<SetStateAction<string>>
  setCreatingLabel: Dispatch<SetStateAction<boolean>>
}) {
  setDestination("private")
  setType("task")
  setAssigneeIds([])
  setProjectId("none")
  setSelectedParentId("none")
  setSelectedLabelIds([])
  setNewLabelName("")
  setCreatingLabel(false)
}

function applySelectedType({
  nextType,
  selectedParentItem,
  setType,
  setSelectedParentId,
  setTypePickerOpen,
}: {
  nextType: WorkItemType
  selectedParentItem: WorkItem | null
  setType: Dispatch<SetStateAction<WorkItemType>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setTypePickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  const nextParentStillValid =
    selectedParentItem &&
    canParentWorkItemTypeAcceptChild(selectedParentItem.type, nextType)

  setType(nextType)
  if (!nextParentStillValid) {
    setSelectedParentId("none")
  }
  setTypePickerOpen(false)
}

function applyProjectChange({
  nextProjectId,
  selectedParentItem,
  setProjectId,
  setSelectedParentId,
  setProjectPickerOpen,
}: {
  nextProjectId: string
  selectedParentItem: WorkItem | null
  setProjectId: Dispatch<SetStateAction<string>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setProjectPickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  setProjectId(nextProjectId)
  if (
    nextProjectId !== "none" &&
    selectedParentItem &&
    selectedParentItem.primaryProjectId !== nextProjectId
  ) {
    setSelectedParentId("none")
  }
  setProjectPickerOpen(false)
}

function applyParentChange({
  nextParentId,
  parentOptions,
  setSelectedParentId,
  setProjectId,
  setParentPickerOpen,
}: {
  nextParentId: string
  parentOptions: WorkItem[]
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setProjectId: Dispatch<SetStateAction<string>>
  setParentPickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  const parentOption =
    parentOptions.find((item) => item.id === nextParentId) ?? null

  setSelectedParentId(nextParentId)
  if (parentOption?.primaryProjectId) {
    setProjectId(parentOption.primaryProjectId)
  }
  setParentPickerOpen(false)
}

function createWorkItemFromDialogState({
  selectedType,
  selectedTeamId,
  selectedWorkspaceId,
  canCreate,
  normalizedTitle,
  selectedParentItem,
  priority,
  status,
  selectedLabelIds,
  effectiveAssigneeIds,
  effectiveProjectId,
  startDate,
  dueDate,
  targetDate,
  startTime,
  endTime,
  scheduleTimeZone,
  visibility,
  normalizedDescription,
  onOpenChange,
}: {
  selectedType: WorkItemType | null
  selectedTeamId: string
  selectedWorkspaceId: string | null
  canCreate: boolean
  normalizedTitle: string
  selectedParentItem: WorkItem | null
  priority: Priority
  status: WorkStatus
  selectedLabelIds: string[]
  effectiveAssigneeIds: string[]
  effectiveProjectId: string
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
  startTime: string | null
  endTime: string | null
  scheduleTimeZone: string | null
  visibility?: WorkItemVisibility
  normalizedDescription: string
  onOpenChange: (open: boolean) => void
}) {
  if (
    !selectedType ||
    !canCreate ||
    (visibility === "private" ? !selectedWorkspaceId : !selectedTeamId)
  ) {
    return
  }

  const createdItemId = useAppStore.getState().createWorkItem({
    teamId: visibility === "private" ? null : selectedTeamId,
    workspaceId: visibility === "private" ? selectedWorkspaceId : undefined,
    type: selectedType,
    title: normalizedTitle,
    parentId: selectedParentItem?.id ?? null,
    priority,
    status,
    labelIds: selectedLabelIds,
    visibility,
    assigneeId:
      visibility === "private" ? null : (effectiveAssigneeIds[0] ?? null),
    assigneeIds: visibility === "private" ? [] : effectiveAssigneeIds,
    primaryProjectId:
      visibility === "private" || effectiveProjectId === "none"
        ? null
        : effectiveProjectId,
    startDate,
    dueDate,
    targetDate,
    startTime,
    endTime,
    scheduleTimeZone,
    description: normalizedDescription || undefined,
  })

  if (!createdItemId) {
    return
  }

  onOpenChange(false)
}

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  defaultTeamId,
  defaultProjectId,
  initialType,
  defaultValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  initialType?: WorkItemType | null
  defaultValues?: CreateWorkItemDefaultValues
}) {
  const availableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "issues"))
  )
  const {
    allLabels,
    currentWorkspaceId,
    currentUserId,
    projects,
    teamMemberships,
    users,
    workItems,
  } = useAppStore(
    useShallow((state) => ({
      allLabels: state.labels,
      currentWorkspaceId: state.currentWorkspaceId,
      currentUserId: state.currentUserId,
      projects: state.projects,
      teamMemberships: state.teamMemberships,
      users: state.users,
      workItems: state.workItems,
    }))
  )
  const [destination, setDestination] = useState<CreateWorkItemDestination>(
    () => getInitialDestination(defaultValues)
  )
  const privateLaunchMode = defaultValues?.visibility === "private"
  const privateTaskMode = destination === "private"
  const visibility: WorkItemVisibility = privateTaskMode ? "private" : "team"
  const filteredTeams = useMemo(
    () =>
      privateTaskMode || privateLaunchMode
        ? availableTeams
        : getFilteredTeamsForInitialType(availableTeams, initialType),
    [availableTeams, initialType, privateLaunchMode, privateTaskMode]
  )
  const initialState = useMemo(
    () =>
      getInitialCreateWorkItemState({
        filteredTeams,
        defaultTeamId,
        initialType,
        projects,
        defaultProjectId,
        defaultValues,
        teamMemberships,
        privateTaskMode,
      }),
    [
      defaultProjectId,
      defaultTeamId,
      defaultValues,
      filteredTeams,
      initialType,
      privateTaskMode,
      projects,
      teamMemberships,
    ]
  )
  const hasExplicitProjectDefault = getHasExplicitProjectDefaultForDestination({
    defaultValues,
    defaultProjectId,
    privateLaunchMode,
    privateTaskMode,
  })
  const initialDates = getInitialDates(defaultValues)
  const defaultPriority = getDefaultPriority(defaultValues)
  const [selectedTeamId, setSelectedTeamId] = useState(initialState.teamId)
  const selectedDestinationId = privateTaskMode
    ? PRIVATE_TASK_DESTINATION_ID
    : selectedTeamId
  const destinationOptions = useMemo(
    () => getDestinationOptions(filteredTeams),
    [filteredTeams]
  )
  const {
    assigneePickerOpen,
    assigneeQuery,
    priorityPickerOpen,
    setAssigneePickerOpen,
    setAssigneeQuery,
    setPriorityPickerOpen,
    setStatusPickerOpen,
    setStatusQuery,
    setTypePickerOpen,
    statusPickerOpen,
    statusQuery,
    typePickerOpen,
  } = useWorkItemCorePickerState()
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const [parentQuery, setParentQuery] = useState("")
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false)
  const [labelQuery, setLabelQuery] = useState("")
  const shortcutModifierLabel = useShortcutModifierLabel()
  const team = useMemo(
    () => getTeamById(filteredTeams, selectedTeamId),
    [filteredTeams, selectedTeamId]
  )
  const selectedWorkspaceId = privateTaskMode
    ? (currentWorkspaceId ?? null)
    : getTeamWorkspaceId(team, currentWorkspaceId)
  const labels = useMemo(
    () =>
      getLabelsForTeam({
        currentUserId,
        labels: allLabels,
        team,
        visibility,
        workspaceId: selectedWorkspaceId,
      }),
    [allLabels, currentUserId, selectedWorkspaceId, team, visibility]
  )
  const teamMembers = useMemo(
    () => getTeamMembers(users, teamMemberships, selectedTeamId),
    [selectedTeamId, teamMemberships, users]
  )
  const teamProjects = useMemo(
    () => getProjectsForTeamCreateScope(projects, team),
    [projects, team]
  )
  const availableLabels = useMemo(() => sortLabelsByName(labels), [labels])
  const [type, setType] = useState<WorkItemType>(initialState.type)
  const draftTitleRef = useRef("")
  const draftDescriptionRef = useRef("")
  const [titleCanSubmit, setTitleCanSubmit] = useState(
    () => EMPTY_CREATE_TITLE_CAN_SUBMIT
  )
  const [status, setStatus] = useState<WorkStatus>(initialState.status)
  const [priority, setPriority] = useState<Priority>(initialState.priority)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialState.assigneeIds
  )
  const [startDate, setStartDate] = useState<string | null>(
    initialDates.startDate
  )
  const [dueDate] = useState<string | null>(initialDates.dueDate)
  const [targetDate, setTargetDate] = useState<string | null>(
    initialDates.targetDate
  )
  const currentUser = users.find((user) => user.id === currentUserId) ?? null
  const [startTime, setStartTime] = useState<string | null>(
    initialDates.startTime
  )
  const [endTime, setEndTime] = useState<string | null>(initialDates.endTime)
  const [scheduleTimeZone, setScheduleTimeZone] = useState<string | null>(
    initialDates.scheduleTimeZone ??
      normalizeTimeZone(currentUser?.preferences.timeZone, getBrowserTimeZone())
  )
  const [projectId, setProjectId] = useState<string>(initialState.projectId)
  const [selectedParentId, setSelectedParentId] = useState<string>(
    defaultValues?.parentId ?? "none"
  )
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    defaultValues?.labelIds ?? []
  )
  const [newLabelName, setNewLabelName] = useState("")
  const [creatingLabel, setCreatingLabel] = useState(false)
  const selectedProject = useMemo(
    () => getSelectedProject(projectId, teamProjects),
    [projectId, teamProjects]
  )
  const effectiveAssigneeIds = useMemo(
    () => getEffectiveAssigneeIds(assigneeIds, teamMembers),
    [assigneeIds, teamMembers]
  )
  const selectedAssignees = useMemo(
    () => getSelectedAssignees(effectiveAssigneeIds, teamMembers),
    [effectiveAssigneeIds, teamMembers]
  )
  const workCopy = useMemo(() => getWorkCopyForTeam(team), [team])
  const teamStatuses = useMemo(() => getStatusOrderForTeam(team), [team])
  const activeTemplateType = useMemo(
    () => getActiveTemplateType(selectedProject, team),
    [selectedProject, team]
  )
  const availableItemTypes = useMemo(
    () =>
      privateTaskMode
        ? PRIVATE_TASK_ITEM_TYPES
        : getAllowedWorkItemTypesForTemplate(activeTemplateType),
    [activeTemplateType, privateTaskMode]
  )
  const selectedType = useMemo(
    () => getSelectedWorkItemType(availableItemTypes, type),
    [availableItemTypes, type]
  )
  const scopedProjectId = projectId === "none" ? null : projectId
  const parentOptions = useMemo(
    () =>
      getParentOptionsForCreate({
        currentUserId,
        privateTaskMode,
        selectedWorkspaceId,
        workItems,
        selectedTeamId,
        selectedType,
        scopedProjectId,
        selectedParentId,
      }),
    [
      currentUserId,
      privateTaskMode,
      scopedProjectId,
      selectedParentId,
      selectedTeamId,
      selectedType,
      selectedWorkspaceId,
      workItems,
    ]
  )
  const selectedParentItem = useMemo(
    () => getSelectedParentItem(selectedParentId, parentOptions),
    [parentOptions, selectedParentId]
  )
  const effectiveProjectId = useMemo(
    () =>
      getEffectiveProjectId({
        hasExplicitProjectDefault,
        projectId,
        selectedParentItem,
      }),
    [hasExplicitProjectDefault, projectId, selectedParentItem]
  )
  const displayedProject = useMemo(
    () => getSelectedProject(effectiveProjectId, teamProjects),
    [effectiveProjectId, teamProjects]
  )
  const selectedLabels = useMemo(
    () => getSelectedLabels(availableLabels, selectedLabelIds),
    [availableLabels, selectedLabelIds]
  )
  const selectedTypeLabel = useMemo(
    () =>
      getSelectedTypeLabel({
        selectedType,
        team,
        workCopy,
      }),
    [selectedType, team, workCopy]
  )
  const secondaryContextLabel = useMemo(
    () =>
      privateTaskMode
        ? getSecondaryContextLabel(selectedParentItem, null)
        : getSecondaryContextLabel(selectedParentItem, displayedProject),
    [displayedProject, privateTaskMode, selectedParentItem]
  )
  const titlePlaceholder = useMemo(
    () =>
      getTitlePlaceholder({
        selectedType,
        selectedTypeLabel,
        workCopy,
      }),
    [selectedType, selectedTypeLabel, workCopy]
  )
  const labelNameLimitState = getTextInputLimitState(
    newLabelName,
    labelNameConstraints
  )
  const requiresParent = requiresParentType(selectedType)
  const showParentSelect = shouldShowParentSelect({
    selectedType,
    requiresParent,
    parentOptions,
    selectedParentItem,
  })
  const canCreate = canSubmitCreateWorkItem({
    hasCreateScope: privateTaskMode
      ? Boolean(selectedWorkspaceId)
      : filteredTeams.length > 0,
    titleCanSubmit,
    selectedType,
    requiresParent,
    selectedParentItem,
  })
  const hasEditableTeams = privateTaskMode
    ? Boolean(selectedWorkspaceId)
    : hasItems(filteredTeams)
  const hasAvailableItemTypes = hasItems(availableItemTypes)

  const resetDraftFields = useCallback(() => {
    draftTitleRef.current = ""
    draftDescriptionRef.current = ""
    setTitleCanSubmit(EMPTY_CREATE_TITLE_CAN_SUBMIT)
  }, [])

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetDraftFields()
      }

      onOpenChange(nextOpen)
    },
    [onOpenChange, resetDraftFields]
  )

  const handleTitleDraftChange = useCallback(
    (nextTitle: string, nextCanSubmit: boolean) => {
      draftTitleRef.current = nextTitle
      setTitleCanSubmit((currentCanSubmit) =>
        currentCanSubmit === nextCanSubmit ? currentCanSubmit : nextCanSubmit
      )
    },
    []
  )

  const handleDescriptionDraftChange = useCallback(
    (nextDescription: string) => {
      draftDescriptionRef.current = nextDescription
    },
    []
  )

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((current) => toggleSelectionValue(current, labelId))
  }

  async function handleCreateLabel() {
    await createLabelAndSelect({
      newLabelName,
      creatingLabel,
      canSubmit: labelNameLimitState.canSubmit,
      scopeType: privateTaskMode ? "private" : "workspace",
      workspaceId: selectedWorkspaceId,
      setCreatingLabel,
      setNewLabelName,
      setSelectedLabelIds,
    })
  }

  function handleCreate() {
    const normalizedTitle = draftTitleRef.current.trim()
    const preparedDescription = prepareRichTextForStorage(
      draftDescriptionRef.current,
      { minPlainTextCharacters: 1 }
    )
    const normalizedDescription = preparedDescription.isMeaningful
      ? preparedDescription.sanitized
      : ""

    createWorkItemFromDialogState({
      selectedType,
      selectedTeamId,
      selectedWorkspaceId,
      canCreate,
      normalizedTitle,
      selectedParentItem,
      priority,
      status,
      selectedLabelIds,
      effectiveAssigneeIds,
      effectiveProjectId,
      startDate,
      dueDate,
      targetDate,
      startTime,
      endTime,
      scheduleTimeZone,
      visibility,
      normalizedDescription,
      onOpenChange: handleDialogOpenChange,
    })
  }

  function handleSelectDestination(destinationId: string) {
    if (destinationId === PRIVATE_TASK_DESTINATION_ID) {
      applyPrivateDestination({
        setDestination,
        setType,
        setAssigneeIds,
        setProjectId,
        setSelectedParentId,
        setSelectedLabelIds,
        setNewLabelName,
        setCreatingLabel,
      })
      return
    }

    setDestination("team")
    applyTeamSelection({
      nextTeamId: destinationId,
      filteredTeams,
      projects,
      initialType,
      defaultProjectId,
      defaultPriority,
      setSelectedTeamId,
      setType,
      setStatus,
      setPriority,
      setAssigneeIds,
      setProjectId,
      setSelectedParentId,
      setSelectedLabelIds,
      setNewLabelName,
      setCreatingLabel,
    })
  }

  function handleSelectType(nextType: WorkItemType) {
    applySelectedType({
      nextType,
      selectedParentItem,
      setType,
      setSelectedParentId,
      setTypePickerOpen,
    })
  }

  function handleStatusChange(nextStatus: WorkStatus) {
    setStatus(nextStatus)
    setStatusPickerOpen(false)
  }

  function handlePriorityChange(nextPriority: Priority) {
    setPriority(nextPriority)
    setPriorityPickerOpen(false)
  }

  function handleAssigneeChange(nextAssigneeId: string) {
    setAssigneeIds((current) =>
      nextAssigneeId === "none"
        ? []
        : toggleSelectionValue(current, nextAssigneeId)
    )
  }

  function handleProjectChange(nextProjectId: string) {
    applyProjectChange({
      nextProjectId,
      selectedParentItem,
      setProjectId,
      setSelectedParentId,
      setProjectPickerOpen,
    })
  }

  function handleParentChange(nextParentId: string) {
    applyParentChange({
      nextParentId,
      parentOptions,
      setSelectedParentId,
      setProjectId,
      setParentPickerOpen,
    })
  }

  useCommandEnterSubmit(canUseCommandSubmit(open, canCreate), handleCreate)

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex max-h-[calc(100vh-3rem)] translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-[14vh] sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
          <DialogDescription>
            Create a new work item and seed its initial description.
          </DialogDescription>
        </DialogHeader>

        <CreateWorkItemCrumbRow
          destinationOptions={destinationOptions}
          selectedDestinationId={selectedDestinationId}
          team={team}
          onSelectDestination={handleSelectDestination}
          typePickerOpen={typePickerOpen}
          onTypePickerOpenChange={setTypePickerOpen}
          availableItemTypes={availableItemTypes}
          selectedType={selectedType}
          selectedTypeLabel={selectedTypeLabel}
          onSelectType={handleSelectType}
          secondaryContextLabel={secondaryContextLabel}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <CreateWorkItemTitleFields
            key={open ? "create-work-item-open" : "create-work-item-closed"}
            titlePlaceholder={titlePlaceholder}
            onTitleDraftChange={handleTitleDraftChange}
            onDescriptionDraftChange={handleDescriptionDraftChange}
          />

          <CreateWorkItemPropertiesRow
            showAssignee={!privateTaskMode}
            showLabels
            showProject={!privateTaskMode}
            team={team}
            status={status}
            teamStatuses={teamStatuses}
            statusPickerOpen={statusPickerOpen}
            setStatusPickerOpen={setStatusPickerOpen}
            statusQuery={statusQuery}
            setStatusQuery={setStatusQuery}
            onStatusChange={handleStatusChange}
            priority={priority}
            priorityPickerOpen={priorityPickerOpen}
            setPriorityPickerOpen={setPriorityPickerOpen}
            onPriorityChange={handlePriorityChange}
            assigneePickerOpen={assigneePickerOpen}
            setAssigneePickerOpen={setAssigneePickerOpen}
            assigneeQuery={assigneeQuery}
            setAssigneeQuery={setAssigneeQuery}
            teamMembers={teamMembers}
            selectedAssignees={selectedAssignees}
            effectiveAssigneeIds={effectiveAssigneeIds}
            onAssigneeChange={handleAssigneeChange}
            projectPickerOpen={projectPickerOpen}
            setProjectPickerOpen={setProjectPickerOpen}
            projectQuery={projectQuery}
            setProjectQuery={setProjectQuery}
            teamProjects={teamProjects}
            selectedProject={displayedProject}
            effectiveProjectId={effectiveProjectId}
            selectedParentItem={selectedParentItem}
            onProjectChange={handleProjectChange}
            startDate={startDate}
            setStartDate={setStartDate}
            startTime={startTime}
            setStartTime={setStartTime}
            targetDate={targetDate}
            setTargetDate={setTargetDate}
            endTime={endTime}
            setEndTime={setEndTime}
            scheduleTimeZone={scheduleTimeZone}
            setScheduleTimeZone={setScheduleTimeZone}
            showParentSelect={showParentSelect}
            parentPickerOpen={parentPickerOpen}
            setParentPickerOpen={setParentPickerOpen}
            parentQuery={parentQuery}
            setParentQuery={setParentQuery}
            parentOptions={parentOptions}
            selectedParentId={selectedParentId}
            onParentChange={handleParentChange}
            labelsPickerOpen={labelsPickerOpen}
            canCreateLabel={Boolean(selectedWorkspaceId)}
            setLabelsPickerOpen={setLabelsPickerOpen}
            labelQuery={labelQuery}
            setLabelQuery={setLabelQuery}
            availableLabels={availableLabels}
            selectedLabels={selectedLabels}
            selectedLabelIds={selectedLabelIds}
            newLabelName={newLabelName}
            setNewLabelName={setNewLabelName}
            labelNameLimitState={labelNameLimitState}
            creatingLabel={creatingLabel}
            onToggleLabel={toggleLabel}
            onClearLabels={() => setSelectedLabelIds([])}
            onCreateLabel={() => {
              void handleCreateLabel()
            }}
          />

          <CreateWorkItemWarnings
            hasEditableTeams={hasEditableTeams}
            hasAvailableItemTypes={hasAvailableItemTypes}
          />
        </div>

        <CreateWorkItemFooter
          destinationLabel={privateTaskMode ? "Private tasks" : null}
          selectedProject={displayedProject}
          team={team}
          canCreate={canCreate}
          selectedTypeLabel={selectedTypeLabel}
          shortcutModifierLabel={shortcutModifierLabel}
          onCancel={() => handleDialogOpenChange(false)}
          onCreate={handleCreate}
        />
      </DialogContent>
    </Dialog>
  )
}
