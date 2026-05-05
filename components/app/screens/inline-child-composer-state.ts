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
  teamId: string
}) {
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
  assigneeId: string
  description: string
  normalizedTitle: string
  parentItem: WorkItem
  priority: Priority
  projectId: string
  selectedType: WorkItemType
  status: WorkStatus
  teamId: string
}) {
  const createdItemId = useAppStore.getState().createWorkItem({
    teamId: input.teamId,
    type: input.selectedType,
    title: input.normalizedTitle,
    priority: input.priority,
    status: input.status,
    parentId: input.parentItem.id,
    assigneeId: input.assigneeId === "none" ? null : input.assigneeId,
    primaryProjectId: input.projectId === "none" ? null : input.projectId,
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
  assigneeId: string
  disabled: boolean
  parentItem: WorkItem
  projectId: string
  team: AppData["teams"][number] | null
  teamMembers: AppData["users"]
  teamProjects: AppData["projects"]
  title: string
  type: WorkItemType
}) {
  const fallbackType = getPreferredWorkItemTypeForTeamExperience(
    input.team?.settings.experience,
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
    teamExperience: input.team?.settings.experience,
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
      !input.disabled && titleLimitState.canSubmit && availableItemTypes.length > 0,
    normalizedTitle: input.title.trim(),
    selectedAssignee:
      input.assigneeId === "none"
        ? null
        : (input.teamMembers.find((user) => user.id === input.assigneeId) ??
          null),
    selectedProject,
    selectedType,
    selectedTypeLabel: getDisplayLabelForWorkItemType(
      selectedType,
      input.team?.settings.experience
    ),
    titleLimitState,
  }
}
