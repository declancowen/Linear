import {
  getTextInputLimitState,
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
import {
  getAllowedChildWorkItemTypesForItem,
  getAllowedWorkItemTypesForTemplate,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getPreferredWorkItemTypeForTeamExperience,
  type AppData,
  type Priority,
  type WorkItem,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { formatInlineDescriptionContent } from "@/components/app/screens/helpers"

export function getInlineChildTeamProjects({
  parentItem,
  projects,
  teamId,
}: {
  parentItem: WorkItem
  projects: AppData["projects"]
  teamId: string | null
}) {
  if (!teamId || (parentItem.visibility ?? "team") === "private") {
    return []
  }

  const scopedProjects = projects.filter(
    (project) => project.scopeType === "team" && project.scopeId === teamId
  )

  if (!parentItem.primaryProjectId) {
    return scopedProjects
  }

  const selectedProject =
    projects.find((project) => project.id === parentItem.primaryProjectId) ??
    null

  if (
    !selectedProject ||
    scopedProjects.some((project) => project.id === selectedProject.id)
  ) {
    return scopedProjects
  }

  return [selectedProject, ...scopedProjects]
}

function getInlineChildSelectedProject({
  projectId,
  teamProjects,
}: {
  projectId: string
  teamProjects: AppData["projects"]
}) {
  return projectId === "none"
    ? null
    : (teamProjects.find((project) => project.id === projectId) ?? null)
}

function getInlineChildAvailableItemTypes({
  parentItem,
  selectedProject,
  teamExperience,
}: {
  parentItem: WorkItem
  selectedProject: AppData["projects"][number] | null
  teamExperience: Parameters<typeof getDefaultWorkItemTypesForTeamExperience>[0]
}) {
  const baseItemTypes = selectedProject
    ? getAllowedWorkItemTypesForTemplate(selectedProject.templateType)
    : getDefaultWorkItemTypesForTeamExperience(teamExperience)
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(parentItem)

  return baseItemTypes.filter((value) => allowedChildTypes.includes(value))
}

function getInlineChildSelectedType({
  availableItemTypes,
  fallbackType,
  type,
}: {
  availableItemTypes: WorkItemType[]
  fallbackType: WorkItemType
  type: WorkItemType
}) {
  return availableItemTypes.includes(type)
    ? type
    : (availableItemTypes[0] ?? fallbackType)
}

export function createInlineChildWorkItem(input: {
  assigneeIds: string[]
  description: string
  normalizedTitle: string
  parentItem: WorkItem
  priority: Priority
  projectId: string
  selectedType: WorkItemType
  status: WorkStatus
  teamId: string | null
  workspaceId: string | null
}) {
  const isPrivate = (input.parentItem.visibility ?? "team") === "private"
  const createdItemId = useAppStore.getState().createWorkItem({
    teamId: isPrivate ? null : input.teamId,
    workspaceId: isPrivate ? input.workspaceId : undefined,
    type: input.selectedType,
    title: input.normalizedTitle,
    priority: input.priority,
    status: input.status,
    parentId: input.parentItem.id,
    assigneeId: isPrivate ? null : (input.assigneeIds[0] ?? null),
    assigneeIds: isPrivate ? [] : input.assigneeIds,
    primaryProjectId:
      isPrivate || input.projectId === "none" ? null : input.projectId,
    visibility: isPrivate ? "private" : "team",
  })

  if (!createdItemId || !input.description.trim()) {
    return createdItemId
  }

  useAppStore
    .getState()
    .updateItemDescription(
      createdItemId,
      formatInlineDescriptionContent(input.description)
    )

  return createdItemId
}

export function getInlineChildIssueComposerModel(input: {
  assigneeIds: string[]
  disabled: boolean
  parentItem: WorkItem
  projectId: string
  team: AppData["teams"][number] | null
  teamMembers: AppData["users"]
  teamProjects: AppData["projects"]
  title: string
  type: WorkItemType
}) {
  const isPrivate = (input.parentItem.visibility ?? "team") === "private"
  const teamExperience = isPrivate
    ? "project-management"
    : input.team?.settings.experience
  const fallbackType = getPreferredWorkItemTypeForTeamExperience(
    teamExperience,
    {
      parent: true,
    }
  )
  const selectedProject = getInlineChildSelectedProject({
    projectId: input.projectId,
    teamProjects: input.teamProjects,
  })
  const availableItemTypes = getInlineChildAvailableItemTypes({
    parentItem: input.parentItem,
    selectedProject,
    teamExperience,
  })
  const selectedType = getInlineChildSelectedType({
    availableItemTypes,
    fallbackType,
    type: input.type,
  })
  const titleLimitState = getTextInputLimitState(
    input.title,
    workItemTitleConstraints
  )

  return {
    availableItemTypes,
    canCreate:
      !input.disabled &&
      titleLimitState.canSubmit &&
      availableItemTypes.length > 0,
    normalizedTitle: input.title.trim(),
    selectedAssignees: input.teamMembers.filter((user) =>
      input.assigneeIds.includes(user.id)
    ),
    selectedProject,
    selectedType,
    selectedTypeLabel: getDisplayLabelForWorkItemType(
      selectedType,
      teamExperience
    ),
    titleLimitState,
  }
}
