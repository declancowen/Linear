"use client"

import {
  canEditWorkspace,
  getLabelsForTeamScope,
  getTeamFeatureSettings,
  getTeamSurfaceDisableReason,
  getWorkItemDescendantIds,
} from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  createDefaultTeamWorkflowSettings,
  getAllowedTemplateTypesForTeamExperience,
  getAllowedWorkItemTypesForTemplate,
  getWorkSurfaceCopy,
  type AppData,
  type Conversation,
  type TeamWorkflowSettings,
  type WorkItem,
} from "@/lib/domain/types"

import { getNow } from "./helpers"
import type {
  ConversationAudienceState,
  CreateDocumentInput,
  CreateProjectInput,
  WorkItemCascadeDeletePlan,
  WorkItemProjectLinkResolution,
  WorkItemValidationInput,
} from "./types"

export function getTeamMemberIds(state: AppData, teamId: string) {
  return state.teamMemberships
    .filter((membership) => membership.teamId === teamId)
    .map((membership) => membership.userId)
}

export function getProjectsForTeamScope(state: AppData, teamId: string) {
  const team = state.teams.find((entry) => entry.id === teamId)

  if (!team) {
    return []
  }

  return state.projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === teamId) ||
      (project.scopeType === "workspace" &&
        project.scopeId === team.workspaceId)
  )
}

export function getProjectCreationValidationMessage(
  state: AppData,
  input: CreateProjectInput
) {
  if (input.scopeType !== "team") {
    return "Projects must belong to a team space"
  }

  const team = state.teams.find((entry) => entry.id === input.scopeId)

  if (!team) {
    return "Team not found"
  }

  if (!getTeamFeatureSettings(team).projects) {
    return "Projects are disabled for this team"
  }

  return getAllowedTemplateTypesForTeamExperience(
    team.settings.experience
  ).includes(input.templateType)
    ? null
    : "Project template is not allowed for this team"
}

export function getDocumentCreationValidationMessage(
  state: AppData,
  input: CreateDocumentInput
) {
  if (input.kind !== "team-document") {
    return null
  }

  const team = state.teams.find((entry) => entry.id === input.teamId)

  if (!team) {
    return "Team not found"
  }

  return getTeamFeatureSettings(team).docs
    ? null
    : "Docs are disabled for this team"
}

export function getWorkItemValidationMessage(
  state: AppData,
  input: WorkItemValidationInput
) {
  const normalizedTitle = input.title.trim()

  if (normalizedTitle.length < 2 || normalizedTitle.length > 96) {
    return "Work item title must be between 2 and 96 characters"
  }

  const team = state.teams.find((entry) => entry.id === input.teamId)

  if (!team) {
    return "Team not found"
  }

  if (!getTeamFeatureSettings(team).issues) {
    return getWorkSurfaceCopy(team.settings.experience).disabledLabel
  }

  if (
    input.assigneeId &&
    !getTeamMemberIds(state, input.teamId).includes(input.assigneeId)
  ) {
    return "Assignee must belong to the selected team"
  }

  if (
    "labelIds" in input &&
    input.labelIds &&
    input.labelIds.some(
      (labelId) =>
        !getLabelsForTeamScope(state, input.teamId).some(
          (label) => label.id === labelId
        )
    )
  ) {
    return "One or more labels are invalid"
  }

  const parent = input.parentId
    ? (state.workItems.find((entry) => entry.id === input.parentId) ?? null)
    : null

  if (input.parentId) {
    if (!parent) {
      return "Parent item not found"
    }

    if (parent.teamId !== input.teamId) {
      return "Parent item must belong to the same team"
    }

    if (input.currentItemId && parent.id === input.currentItemId) {
      return "Item cannot be its own parent"
    }

    if (!canParentWorkItemTypeAcceptChild(parent.type, input.type)) {
      return "Selected parent cannot contain this work item type"
    }

    if (
      input.currentItemId &&
      getWorkItemDescendantIds(state, input.currentItemId).has(parent.id)
    ) {
      return "Work item hierarchy cannot contain cycles"
    }
  }

  const resolvedPrimaryProjectId = parent
    ? (parent.primaryProjectId ?? null)
    : (input.primaryProjectId ?? null)

  if (resolvedPrimaryProjectId) {
    const project = getProjectsForTeamScope(state, input.teamId).find(
      (entry) => entry.id === resolvedPrimaryProjectId
    )

    if (!project) {
      return "Project must belong to the same team or workspace"
    }

    return getAllowedWorkItemTypesForTemplate(project.templateType).includes(
      input.type
    )
      ? null
      : "Work item type is not allowed for the selected project template"
  }

  return null
}

export function getResolvedProjectLinkForWorkItemUpdate(
  state: AppData,
  existing: WorkItem,
  patch: {
    parentId?: string | null
    primaryProjectId?: string | null
  }
): WorkItemProjectLinkResolution {
  const itemsById = new Map(state.workItems.map((item) => [item.id, item]))
  const nextParentId =
    patch.parentId === undefined ? existing.parentId : patch.parentId
  const nextParent = nextParentId ? (itemsById.get(nextParentId) ?? null) : null
  const resolvedPrimaryProjectId =
    patch.primaryProjectId !== undefined
      ? patch.primaryProjectId
      : patch.parentId !== undefined
        ? (nextParent?.primaryProjectId ?? existing.primaryProjectId)
        : existing.primaryProjectId
  const parentIds = new Map<string, string | null>(
    state.workItems.map((item) => [
      item.id,
      item.id === existing.id ? (nextParentId ?? null) : item.parentId,
    ])
  )
  let rootItemId = existing.id
  const visited = new Set<string>([rootItemId])

  while (true) {
    const parentId = parentIds.get(rootItemId) ?? null

    if (!parentId || visited.has(parentId)) {
      break
    }

    visited.add(parentId)
    rootItemId = parentId
  }

  const cascadeItemIds = new Set<string>([rootItemId])
  const queue = [rootItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    for (const [itemId, parentId] of parentIds) {
      if (parentId !== currentId || cascadeItemIds.has(itemId)) {
        continue
      }

      cascadeItemIds.add(itemId)
      queue.push(itemId)
    }
  }

  const shouldCascadeProjectLink =
    (patch.primaryProjectId !== undefined || patch.parentId !== undefined) &&
    [...cascadeItemIds].some((itemId) => {
      const currentProjectId =
        itemId === existing.id
          ? existing.primaryProjectId
          : (itemsById.get(itemId)?.primaryProjectId ?? null)

      return currentProjectId !== resolvedPrimaryProjectId
    })

  return {
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  }
}

export function getWorkItemCascadeDeletePlan(
  state: AppData,
  itemId: string
): WorkItemCascadeDeletePlan | null {
  const item = state.workItems.find((entry) => entry.id === itemId) ?? null

  if (!item) {
    return null
  }

  const deletedItemIds = new Set<string>([
    itemId,
    ...getWorkItemDescendantIds(state, itemId),
  ])
  const deletedDescriptionDocIds = new Set(
    state.workItems
      .filter((entry) => deletedItemIds.has(entry.id))
      .map((entry) => entry.descriptionDocId)
  )
  const deletedCommentIds = new Set(
    state.comments
      .filter((comment) => {
        const targetsDeletedItem =
          comment.targetType === "workItem" &&
          deletedItemIds.has(comment.targetId)
        const targetsDeletedDescription =
          comment.targetType === "document" &&
          deletedDescriptionDocIds.has(comment.targetId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((comment) => comment.id)
  )
  const deletedAttachmentIds = new Set(
    state.attachments
      .filter((attachment) => {
        const targetsDeletedItem =
          attachment.targetType === "workItem" &&
          deletedItemIds.has(attachment.targetId)
        const targetsDeletedDescription =
          attachment.targetType === "document" &&
          deletedDescriptionDocIds.has(attachment.targetId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((attachment) => attachment.id)
  )
  const deletedNotificationIds = new Set(
    state.notifications
      .filter((notification) => {
        const targetsDeletedItem =
          notification.entityType === "workItem" &&
          deletedItemIds.has(notification.entityId)
        const targetsDeletedDescription =
          notification.entityType === "document" &&
          deletedDescriptionDocIds.has(notification.entityId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((notification) => notification.id)
  )
  const nextWorkItems = state.workItems
    .filter((entry) => !deletedItemIds.has(entry.id))
    .map((entry) => {
      const nextLinkedDocumentIds = entry.linkedDocumentIds.filter(
        (documentId) => !deletedDescriptionDocIds.has(documentId)
      )

      if (nextLinkedDocumentIds.length === entry.linkedDocumentIds.length) {
        return entry
      }

      return {
        ...entry,
        linkedDocumentIds: nextLinkedDocumentIds,
        updatedAt: getNow(),
      }
    })
  const nextDocuments = state.documents
    .filter((document) => !deletedDescriptionDocIds.has(document.id))
    .map((document) => {
      const nextLinkedWorkItemIds = document.linkedWorkItemIds.filter(
        (linkedItemId) => !deletedItemIds.has(linkedItemId)
      )

      if (nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length) {
        return document
      }

      return {
        ...document,
        linkedWorkItemIds: nextLinkedWorkItemIds,
        updatedAt: getNow(),
        updatedBy: state.currentUserId,
      }
    })

  return {
    item,
    deletedItemIds,
    deletedCommentIds,
    deletedAttachmentIds,
    deletedNotificationIds,
    nextWorkItems,
    nextDocuments,
  }
}

export function getWorkspaceMemberIds(state: AppData, workspaceId: string) {
  const workspaceOwnerId =
    state.workspaces.find((workspace) => workspace.id === workspaceId)
      ?.createdBy ?? null
  const workspaceTeamIds = state.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)

  const userIds = new Set(
    [
      ...state.workspaceMemberships
        .filter((membership) => membership.workspaceId === workspaceId)
        .map((membership) => membership.userId),
      ...state.teamMemberships
        .filter((membership) => workspaceTeamIds.includes(membership.teamId))
        .map((membership) => membership.userId),
    ]
  )

  if (workspaceOwnerId) {
    userIds.add(workspaceOwnerId)
  }

  return [...userIds]
}

export function getConversationAudienceUserIds(
  state: ConversationAudienceState,
  conversation: Conversation
) {
  if (conversation.scopeType === "team") {
    return getTeamMemberIds(state as AppData, conversation.scopeId)
  }

  const workspaceUserIds = new Set(
    getWorkspaceMemberIds(state as AppData, conversation.scopeId)
  )

  if (conversation.kind === "channel") {
    return [...workspaceUserIds]
  }

  return conversation.participantIds.filter((userId) =>
    workspaceUserIds.has(userId)
  )
}

export function effectiveRole(data: AppData, teamId: string) {
  return (
    data.teamMemberships.find(
      (membership) =>
        membership.teamId === teamId && membership.userId === data.currentUserId
    )?.role ?? null
  )
}

export function canEditWorkspaceDocuments(data: AppData, workspaceId: string) {
  return canEditWorkspace(data, workspaceId)
}

export function getTeamWorkflowSettings(
  state: AppData,
  teamId: string | null | undefined
): TeamWorkflowSettings {
  const team = teamId
    ? (state.teams.find((entry) => entry.id === teamId) ?? null)
    : null

  return (
    team?.settings.workflow ??
    createDefaultTeamWorkflowSettings(
      team?.settings.experience ?? "software-development"
    )
  )
}

export function getTeamDetailsDisableMessage(
  state: AppData,
  teamId: string,
  nextFeatures: AppData["teams"][number]["settings"]["features"]
) {
  const team = state.teams.find((entry) => entry.id === teamId)

  if (!team) {
    return "Team not found"
  }

  const currentFeatures = getTeamFeatureSettings(team)

  for (const feature of ["docs", "chat", "channels"] as const) {
    if (!currentFeatures[feature] || nextFeatures[feature]) {
      continue
    }

    const disableReason = getTeamSurfaceDisableReason(state, teamId, feature)

    if (disableReason) {
      return disableReason
    }
  }

  return null
}
