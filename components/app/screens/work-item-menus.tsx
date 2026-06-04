"use client"

import {
  useState,
  type ElementType,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import {
  ArrowSquareOut,
  CircleDashed,
  DotsThree,
  Flag,
  FolderSimple,
  PencilSimple,
  Plus,
  Tag,
  Trash,
  Check,
} from "@phosphor-icons/react"

import { PhosphorIconGlyph } from "@/components/app/phosphor-icon-picker"
import { useAppRouter } from "@/lib/browser/app-navigation"
import {
  canEditTeam,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  getWorkItem,
  hasWorkspaceAccess,
} from "@/lib/domain/selectors"
import {
  getDisplayLabelForWorkItemType,
  priorityMeta,
  statusMeta,
  type AppData,
  type CustomPropertyDefinition,
  type CustomPropertyValue,
  type DisplayProperty,
  type Priority,
  type WorkItem,
  type WorkStatus,
  getCustomPropertyIdFromDisplayReference,
} from "@/lib/domain/types"
import {
  getWorkItemAssigneeIds,
  toggleWorkItemAssigneeId,
} from "@/lib/domain/work-item-assignees"
import {
  isCustomPropertyDefinitionForWorkItem,
  isLabelAssignableToWorkItem,
  sortLabelsByName,
} from "@/lib/domain/labels"
import { useAppStore, type AppStore } from "@/lib/store/app-store"
import { ProjectIconGlyph } from "@/components/app/entity-icons"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getTeamProjectOptions } from "./helpers"
import { LabelColorDot, PriorityIcon, StatusIcon } from "./shared"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import { WorkItemAssigneeAvatar } from "./work-item-ui"

export function stopMenuEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function stopDragPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

type WorkItemMenuComponents = {
  MenuItem: ElementType
  MenuLabel: ElementType
  MenuSeparator: ElementType
  MenuSub: ElementType
  MenuSubContent: ElementType
  MenuSubTrigger: ElementType
}

function getWorkItemMenuComponents(
  kind: "dropdown" | "context"
): WorkItemMenuComponents {
  return {
    MenuItem: kind === "dropdown" ? DropdownMenuItem : ContextMenuItem,
    MenuLabel: kind === "dropdown" ? DropdownMenuLabel : ContextMenuLabel,
    MenuSeparator:
      kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator,
    MenuSub: kind === "dropdown" ? DropdownMenuSub : ContextMenuSub,
    MenuSubContent:
      kind === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent,
    MenuSubTrigger:
      kind === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger,
  }
}

function WorkItemContextActions({
  itemId,
  menu,
  onEditItem,
  onOpenItem,
}: {
  itemId: string
  menu: WorkItemMenuComponents
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
}) {
  const { MenuItem, MenuSeparator } = menu

  return (
    <>
      <MenuItem onSelect={() => onOpenItem?.(itemId)}>
        <ArrowSquareOut className="size-4" />
        Open item
      </MenuItem>
      {onEditItem ? (
        <MenuItem onSelect={() => onEditItem(itemId)}>
          <PencilSimple className="size-4" />
          Edit item
        </MenuItem>
      ) : null}
      <MenuSeparator />
    </>
  )
}

function WorkItemStatusMenuSection({
  editable,
  item,
  menu,
  statusOptions,
  targetItems,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  statusOptions: WorkStatus[]
  targetItems: WorkItem[]
}) {
  const { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } = menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <CircleDashed className="size-4" />
        <span>Status</span>
      </MenuSubTrigger>
      <MenuSubContent>
        {statusOptions.map((status) => (
          <MenuItem
            key={`${item.id}-${status}`}
            onSelect={() => updateTargetWorkItems(targetItems, { status })}
          >
            <StatusIcon status={status} />
            <span>{statusMeta[status].label}</span>
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function WorkItemPriorityMenuSection({
  editable,
  item,
  menu,
  targetItems,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  targetItems: WorkItem[]
}) {
  const { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } = menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <Flag className="size-4" />
        <span>Priority</span>
      </MenuSubTrigger>
      <MenuSubContent>
        {Object.entries(priorityMeta).map(([priority, meta]) => (
          <MenuItem
            key={`${item.id}-${priority}`}
            onSelect={() =>
              updateTargetWorkItems(targetItems, {
                priority: priority as Priority,
              })
            }
          >
            <PriorityIcon priority={priority as Priority} />
            <span>{meta.label}</span>
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function WorkItemAssigneeMenuSection({
  assigneeMenuMembers,
  currentUser,
  currentUserId,
  editable,
  item,
  menu,
  targetItems,
}: {
  assigneeMenuMembers: AppData["users"]
  currentUser: AppData["users"][number] | null
  currentUserId: string
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  targetItems: WorkItem[]
}) {
  const { MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger } =
    menu
  const assigneeIds = getWorkItemAssigneeIds(item)
  const targetAssigneeIdSets = targetItems.map(
    (target) => new Set(getWorkItemAssigneeIds(target))
  )

  function updateAssigneeIds(target: WorkItem, nextAssigneeIds: string[]) {
    useAppStore.getState().updateWorkItem(target.id, {
      assigneeId: nextAssigneeIds[0] ?? null,
      assigneeIds: nextAssigneeIds,
    })
  }

  function setAllAssigneeIds(nextAssigneeIds: string[]) {
    for (const target of targetItems) {
      updateAssigneeIds(target, nextAssigneeIds)
    }
  }

  function toggleAssigneeForTargets(userId: string) {
    const everyTargetHasUser = targetAssigneeIdSets.every((set) =>
      set.has(userId)
    )

    for (const target of targetItems) {
      const nextAssigneeIds = everyTargetHasUser
        ? getWorkItemAssigneeIds(target).filter((id) => id !== userId)
        : toggleWorkItemAssigneeId(getWorkItemAssigneeIds(target), userId)

      updateAssigneeIds(target, nextAssigneeIds)
    }
  }

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <Plus className="size-4" />
        <span>Assignee</span>
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={() => setAllAssigneeIds([])}>
          <span className="text-fg-3">Unassigned</span>
          {assigneeIds.length === 0 ? <Check className="size-4" /> : null}
        </MenuItem>
        <MenuItem onSelect={() => toggleAssigneeForTargets(currentUserId)}>
          {currentUser ? (
            <WorkItemAssigneeAvatar
              user={currentUser}
              className="size-4 data-[size=sm]:size-4"
            />
          ) : null}
          <span>Assign to me</span>
          {targetAssigneeIdSets.every((set) => set.has(currentUserId)) ? (
            <Check className="size-4" />
          ) : null}
        </MenuItem>
        <MenuSeparator />
        {assigneeMenuMembers.map((member) => (
          <MenuItem
            key={`${item.id}-${member.id}`}
            onSelect={() => toggleAssigneeForTargets(member.id)}
          >
            <WorkItemAssigneeAvatar
              user={member}
              className="size-4 data-[size=sm]:size-4"
            />
            <span>{member.name}</span>
            {targetAssigneeIdSets.every((set) => set.has(member.id)) ? (
              <Check className="size-4" />
            ) : null}
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function WorkItemProjectMenuSection({
  editable,
  item,
  menu,
  requestConfirmedBulkWorkItemUpdate,
  requestConfirmedWorkItemUpdate,
  targetItems,
  teamProjects,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  requestConfirmedWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestUpdate"]
  requestConfirmedBulkWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestBulkUpdate"]
  targetItems: WorkItem[]
  teamProjects: AppData["projects"]
}) {
  const { MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger } =
    menu

  function requestProjectUpdate(primaryProjectId: string | null) {
    const patch = { primaryProjectId }

    if (targetItems.length <= 1) {
      requestConfirmedWorkItemUpdate(item.id, patch)
      return
    }

    requestConfirmedBulkWorkItemUpdate(
      targetItems.map((target) => target.id),
      patch
    )
  }

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <FolderSimple className="size-4" />
        <span>Project</span>
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={() => requestProjectUpdate(null)}>
          <FolderSimple className="size-4 text-fg-3" />
          <span className="text-fg-3">No project</span>
        </MenuItem>
        {teamProjects.length > 0 ? <MenuSeparator /> : null}
        {teamProjects.map((project) => (
          <MenuItem
            key={`${item.id}-${project.id}`}
            onSelect={() => requestProjectUpdate(project.id)}
          >
            <ProjectIconGlyph
              project={project}
              className="size-4 text-fg-3"
            />
            <span>{project.name}</span>
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function getWorkItemWorkspaceId(data: AppData, item: WorkItem) {
  if (item.visibility === "private") {
    return item.workspaceId ?? null
  }

  return item.workspaceId ?? getTeam(data, item.teamId)?.workspaceId ?? null
}

function canEditWorkItemFromMenu(data: AppData, item: WorkItem) {
  const team = getTeam(data, item.teamId)
  const workspaceId = getWorkItemWorkspaceId(data, item)

  if (item.visibility === "private") {
    return (
      item.creatorId === data.currentUserId &&
      Boolean(
        workspaceId && hasWorkspaceAccess(data, workspaceId, data.currentUserId)
      )
    )
  }

  return canEditTeam(data, team?.id)
}

function getUniqueTargetItems(item: WorkItem, targetItems?: WorkItem[]) {
  const entries = targetItems && targetItems.length > 0 ? targetItems : [item]
  const uniqueItems = new Map(entries.map((entry) => [entry.id, entry]))

  if (!uniqueItems.has(item.id)) {
    uniqueItems.set(item.id, item)
  }

  return [...uniqueItems.values()]
}

function updateTargetWorkItems(
  targetItems: WorkItem[],
  patch: Parameters<AppStore["updateWorkItem"]>[1]
) {
  for (const target of targetItems) {
    useAppStore.getState().updateWorkItem(target.id, patch)
  }
}

function getWorkItemDepth(data: AppData, item: WorkItem) {
  const visitedIds = new Set<string>()
  let depth = 0
  let parentId = item.parentId

  while (parentId) {
    if (visitedIds.has(parentId)) {
      break
    }

    visitedIds.add(parentId)
    const parent = getWorkItem(data, parentId)

    if (!parent) {
      break
    }

    depth += 1
    parentId = parent.parentId
  }

  return depth
}

function getDeleteTargetItems(data: AppData, targetItems: WorkItem[]) {
  return [...targetItems].sort(
    (left, right) => getWorkItemDepth(data, right) - getWorkItemDepth(data, left)
  )
}

function hasVisibleMenuProperty(
  displayProps: DisplayProperty[] | undefined,
  property: DisplayProperty
) {
  return !displayProps || displayProps.includes(property)
}

function getBulkAssignableLabels(data: AppData, targetItems: WorkItem[]) {
  return sortLabelsByName(
    data.labels.filter((label) =>
      targetItems.every((target) => {
        const workspaceId = getWorkItemWorkspaceId(data, target)

        return workspaceId
          ? isLabelAssignableToWorkItem(
              label,
              target,
              workspaceId,
              data.currentUserId
            )
          : false
      })
    )
  )
}

function WorkItemLabelsMenuSection({
  editable,
  labels,
  menu,
  targetItems,
}: {
  editable: boolean
  labels: AppData["labels"]
  menu: WorkItemMenuComponents
  targetItems: WorkItem[]
}) {
  const { MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger } =
    menu

  if (labels.length === 0) {
    return null
  }

  function clearLabels() {
    updateTargetWorkItems(targetItems, { labelIds: [] })
  }

  function toggleLabel(labelId: string) {
    const everyTargetHasLabel = targetItems.every((target) =>
      target.labelIds.includes(labelId)
    )

    for (const target of targetItems) {
      const nextLabelIds = everyTargetHasLabel
        ? target.labelIds.filter((id) => id !== labelId)
        : Array.from(new Set([...target.labelIds, labelId]))

      useAppStore.getState().updateWorkItem(target.id, {
        labelIds: nextLabelIds,
      })
    }
  }

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <Tag className="size-4" />
        <span>Labels</span>
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={clearLabels}>
          <span className="text-fg-3">Clear labels</span>
        </MenuItem>
        <MenuSeparator />
        {labels.map((label) => {
          const selected = targetItems.every((target) =>
            target.labelIds.includes(label.id)
          )

          return (
            <MenuItem key={label.id} onSelect={() => toggleLabel(label.id)}>
              <LabelColorDot color={label.color} />
              <span>{label.name}</span>
              {selected ? <Check className="size-4" /> : null}
            </MenuItem>
          )
        })}
      </MenuSubContent>
    </MenuSub>
  )
}

function getCustomPropertyDefinitionForMenu(
  data: AppData,
  property: DisplayProperty,
  targetItems: WorkItem[]
) {
  const propertyId = getCustomPropertyIdFromDisplayReference(property)

  if (!propertyId) {
    return null
  }

  const definition =
    data.customPropertyDefinitions.find((entry) => entry.id === propertyId) ??
    null

  if (
    !definition ||
    (definition.type !== "select" && definition.type !== "multiSelect")
  ) {
    return null
  }

  return targetItems.every((target) =>
    isCustomPropertyDefinitionForWorkItem(
      definition,
      target,
      data.currentUserId
    )
  )
    ? definition
    : null
}

function getCustomPropertyValue(
  data: AppData,
  item: WorkItem,
  definition: CustomPropertyDefinition
) {
  return data.customPropertyValues.find(
    (entry) =>
      entry.workItemId === item.id && entry.propertyId === definition.id
  )?.value
}

function getChoiceSelectedIds(
  definition: CustomPropertyDefinition,
  value: CustomPropertyValue | undefined
) {
  if (definition.type === "multiSelect") {
    return Array.isArray(value) ? value : []
  }

  return typeof value === "string" ? [value] : []
}

function getNextCustomChoiceValue({
  data,
  definition,
  item,
  optionId,
  removeFromAll,
}: {
  data: AppData
  definition: CustomPropertyDefinition
  item: WorkItem
  optionId: string
  removeFromAll: boolean
}): CustomPropertyValue {
  if (definition.type === "select") {
    return removeFromAll ? null : optionId
  }

  const selectedIds = getChoiceSelectedIds(
    definition,
    getCustomPropertyValue(data, item, definition)
  )

  if (removeFromAll) {
    const nextIds = selectedIds.filter((id) => id !== optionId)
    return nextIds.length > 0 ? nextIds : null
  }

  return selectedIds.includes(optionId)
    ? selectedIds
    : [...selectedIds, optionId]
}

function WorkItemCustomPropertyMenuSection({
  data,
  definition,
  editable,
  menu,
  targetItems,
}: {
  data: AppData
  definition: CustomPropertyDefinition
  editable: boolean
  menu: WorkItemMenuComponents
  targetItems: WorkItem[]
}) {
  const { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } = menu

  function clearValue() {
    for (const target of targetItems) {
      useAppStore
        .getState()
        .setCustomPropertyValue(target.id, definition.id, null)
    }
  }

  function setChoiceValue(optionId: string) {
    const everyTargetHasOption = targetItems.every((target) =>
      getChoiceSelectedIds(
        definition,
        getCustomPropertyValue(data, target, definition)
      ).includes(optionId)
    )

    for (const target of targetItems) {
      useAppStore.getState().setCustomPropertyValue(
        target.id,
        definition.id,
        getNextCustomChoiceValue({
          data,
          definition,
          item: target,
          optionId,
          removeFromAll: everyTargetHasOption,
        })
      )
    }
  }

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <PhosphorIconGlyph icon={definition.icon} className="size-4" />
        <span>{definition.name}</span>
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuItem onSelect={clearValue}>
          <span className="text-fg-3">
            {definition.type === "multiSelect" ? "Clear values" : "No selection"}
          </span>
        </MenuItem>
        {definition.options.map((option) => {
          const selected = targetItems.every((target) =>
            getChoiceSelectedIds(
              definition,
              getCustomPropertyValue(data, target, definition)
            ).includes(option.id)
          )

          return (
            <MenuItem key={option.id} onSelect={() => setChoiceValue(option.id)}>
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: option.color }}
              />
              <span>{option.label}</span>
              {selected ? <Check className="size-4" /> : null}
            </MenuItem>
          )
        })}
      </MenuSubContent>
    </MenuSub>
  )
}

function getVisibleCustomPropertyDefinitions({
  data,
  displayProps,
  targetItems,
}: {
  data: AppData
  displayProps: DisplayProperty[] | undefined
  targetItems: WorkItem[]
}) {
  return (displayProps ?? [])
    .map((property) =>
      getCustomPropertyDefinitionForMenu(data, property, targetItems)
    )
    .filter((definition): definition is CustomPropertyDefinition =>
      Boolean(definition)
    )
}

function allTargetsUseSameTeam(targetItems: WorkItem[]) {
  return new Set(targetItems.map((target) => target.teamId)).size === 1
}

function allTargetsAllowTeamProperties(targetItems: WorkItem[]) {
  return targetItems.every(
    (target) => (target.visibility ?? "team") !== "private"
  )
}

type IssueActionMenuContentProps = {
  data: AppData
  displayProps?: DisplayProperty[]
  item: WorkItem
  kind: "dropdown" | "context"
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
  requestConfirmedWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestUpdate"]
  requestConfirmedBulkWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestBulkUpdate"]
  targetItems?: WorkItem[]
}

function getIssueActionMenuModel({
  data,
  displayProps,
  item,
  kind,
  targetItems: targetItemsInput,
}: Pick<
  IssueActionMenuContentProps,
  "data" | "displayProps" | "item" | "kind" | "targetItems"
>) {
  const team = getTeam(data, item.teamId)
  const targetItems = getUniqueTargetItems(item, targetItemsInput)
  const isBulkMenu = targetItems.length > 1
  const isPrivateItem = item.visibility === "private"
  const editable = targetItems.every((target) =>
    canEditWorkItemFromMenu(data, target)
  )
  const targetItemsShareTeam = allTargetsUseSameTeam(targetItems)
  const targetItemsAllowTeamProperties =
    allTargetsAllowTeamProperties(targetItems)
  const teamMembers =
    !targetItemsShareTeam || !targetItemsAllowTeamProperties
      ? []
      : team
        ? getTeamMembers(data, team.id)
        : []
  const itemLabel = getDisplayLabelForWorkItemType(
    item.type,
    isPrivateItem ? "project-management" : team?.settings.experience
  ).toLowerCase()

  return {
    assigneeMenuMembers: teamMembers.filter(
      (member) => member.id !== data.currentUserId
    ),
    customPropertyDefinitions: getVisibleCustomPropertyDefinitions({
      data,
      displayProps,
      targetItems,
    }),
    currentUser: getUser(data, data.currentUserId) ?? null,
    deleteActionLabel: isBulkMenu ? "Delete selected items" : `Delete ${itemLabel}`,
    deleteDialogDescription: isBulkMenu
      ? "These work items will be permanently removed. This can't be undone."
      : "This work item will be permanently removed. This can't be undone.",
    deleteDialogTitle: isBulkMenu
      ? `Delete ${targetItems.length} selected items`
      : `Delete ${item.key}`,
    editable,
    isBulkMenu,
    labelOptions: displayProps?.includes("labels")
      ? getBulkAssignableLabels(data, targetItems)
      : [],
    menu: getWorkItemMenuComponents(kind),
    statusOptions: getStatusOrderForTeam(team),
    targetItems,
    targetItemsAllowTeamProperties,
    targetItemsShareTeam,
    teamProjects: getTeamProjectOptions(data, team?.id, item.primaryProjectId),
  }
}

function IssueActionMenuPropertySections({
  data,
  displayProps,
  item,
  model,
  requestConfirmedBulkWorkItemUpdate,
  requestConfirmedWorkItemUpdate,
}: Pick<
  IssueActionMenuContentProps,
  | "data"
  | "displayProps"
  | "item"
  | "requestConfirmedBulkWorkItemUpdate"
  | "requestConfirmedWorkItemUpdate"
> & {
  model: ReturnType<typeof getIssueActionMenuModel>
}) {
  return (
    <>
      {hasVisibleMenuProperty(displayProps, "status") ? (
        <WorkItemStatusMenuSection
          editable={model.editable}
          item={item}
          menu={model.menu}
          statusOptions={model.statusOptions}
          targetItems={model.targetItems}
        />
      ) : null}
      {hasVisibleMenuProperty(displayProps, "priority") ? (
        <WorkItemPriorityMenuSection
          editable={model.editable}
          item={item}
          menu={model.menu}
          targetItems={model.targetItems}
        />
      ) : null}
      {hasVisibleMenuProperty(displayProps, "assignee") &&
      model.targetItemsShareTeam &&
      model.targetItemsAllowTeamProperties ? (
        <WorkItemAssigneeMenuSection
          assigneeMenuMembers={model.assigneeMenuMembers}
          currentUser={model.currentUser}
          currentUserId={data.currentUserId}
          editable={model.editable}
          item={item}
          menu={model.menu}
          targetItems={model.targetItems}
        />
      ) : null}
      {hasVisibleMenuProperty(displayProps, "project") &&
      model.targetItemsShareTeam &&
      model.targetItemsAllowTeamProperties ? (
        <WorkItemProjectMenuSection
          editable={model.editable}
          item={item}
          menu={model.menu}
          requestConfirmedBulkWorkItemUpdate={
            requestConfirmedBulkWorkItemUpdate
          }
          requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
          targetItems={model.targetItems}
          teamProjects={model.teamProjects}
        />
      ) : null}
      <WorkItemLabelsMenuSection
        editable={model.editable}
        labels={model.labelOptions}
        menu={model.menu}
        targetItems={model.targetItems}
      />
      {model.customPropertyDefinitions.map((definition) => (
        <WorkItemCustomPropertyMenuSection
          key={definition.id}
          data={data}
          definition={definition}
          editable={model.editable}
          menu={model.menu}
          targetItems={model.targetItems}
        />
      ))}
    </>
  )
}

function IssueActionMenuDeleteAction({
  model,
  onOpenDeleteDialog,
}: {
  model: ReturnType<typeof getIssueActionMenuModel>
  onOpenDeleteDialog: () => void
}) {
  const { MenuItem, MenuSeparator } = model.menu

  if (!model.editable) {
    return null
  }

  return (
    <>
      <MenuSeparator />
      <MenuItem
        variant="destructive"
        onSelect={(event: Event) => {
          event.preventDefault()
          onOpenDeleteDialog()
        }}
      >
        <Trash className="size-4" />
        {model.deleteActionLabel}
      </MenuItem>
    </>
  )
}

function IssueActionMenuContent({
  data,
  displayProps,
  item,
  kind,
  onEditItem,
  onOpenItem,
  requestConfirmedBulkWorkItemUpdate,
  requestConfirmedWorkItemUpdate,
  targetItems: targetItemsInput,
}: IssueActionMenuContentProps) {
  const model = getIssueActionMenuModel({
    data,
    displayProps,
    item,
    kind,
    targetItems: targetItemsInput,
  })
  const { MenuLabel, MenuSeparator } = model.menu
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  async function handleDelete() {
    for (const target of getDeleteTargetItems(data, model.targetItems)) {
      await useAppStore.getState().deleteWorkItem(target.id)
    }

    setDeleteDialogOpen(false)
  }

  return (
    <>
      <MenuLabel>
        {model.isBulkMenu ? `${model.targetItems.length} selected` : item.key}
      </MenuLabel>
      <MenuSeparator />
      {kind === "context" && !model.isBulkMenu ? (
        <WorkItemContextActions
          itemId={item.id}
          menu={model.menu}
          onEditItem={onEditItem}
          onOpenItem={onOpenItem}
        />
      ) : null}
      <IssueActionMenuPropertySections
        data={data}
        displayProps={displayProps}
        item={item}
        model={model}
        requestConfirmedBulkWorkItemUpdate={requestConfirmedBulkWorkItemUpdate}
        requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
      />
      <IssueActionMenuDeleteAction
        model={model}
        onOpenDeleteDialog={() => setDeleteDialogOpen(true)}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={model.deleteDialogTitle}
        description={model.deleteDialogDescription}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

export function IssueActionMenu({
  data,
  displayProps,
  item,
  triggerClassName,
}: {
  data: AppData
  displayProps?: DisplayProperty[]
  item: WorkItem
  triggerClassName?: string
}) {
  const {
    requestBulkUpdate: requestConfirmedBulkWorkItemUpdate,
    requestUpdate: requestConfirmedWorkItemUpdate,
    confirmationDialog,
  } = useWorkItemProjectCascadeConfirmation()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={triggerClassName}
            onPointerDown={stopDragPropagation}
            onClick={stopMenuEvent}
          >
            <DotsThree className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <IssueActionMenuContent
            data={data}
            displayProps={displayProps}
            item={item}
            kind="dropdown"
            requestConfirmedBulkWorkItemUpdate={
              requestConfirmedBulkWorkItemUpdate
            }
            requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmationDialog}
    </>
  )
}

export function IssueContextMenu({
  data,
  displayProps,
  item,
  onEditItem,
  onOpenItem,
  targetItems,
  children,
}: {
  data: AppData
  displayProps?: DisplayProperty[]
  item: WorkItem
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
  targetItems?: WorkItem[]
  children: ReactNode
}) {
  const router = useAppRouter()
  const {
    requestBulkUpdate: requestConfirmedBulkWorkItemUpdate,
    requestUpdate: requestConfirmedWorkItemUpdate,
    confirmationDialog,
  } = useWorkItemProjectCascadeConfirmation()
  const handleOpenItem =
    onOpenItem ?? ((itemId: string) => router.push(`/items/${itemId}`))

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <IssueActionMenuContent
            data={data}
            displayProps={displayProps}
            item={item}
            kind="context"
            onEditItem={onEditItem}
            onOpenItem={handleOpenItem}
            requestConfirmedBulkWorkItemUpdate={
              requestConfirmedBulkWorkItemUpdate
            }
            requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
            targetItems={targetItems}
          />
        </ContextMenuContent>
      </ContextMenu>
      {confirmationDialog}
    </>
  )
}
