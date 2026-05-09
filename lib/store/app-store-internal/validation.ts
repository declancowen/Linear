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
import {
  resolveWorkItemProjectLinkUpdate,
  type WorkItemProjectLinkResolution,
} from "@/lib/domain/work-item-project-links"
import type { CreateProjectInput } from "@/lib/domain/project-inputs"

import { getNow } from "./helpers"
import type {
  ConversationAudienceState,
  CreateDocumentInput,
  WorkItemCascadeDeletePlan,
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

  if (
    !getAllowedTemplateTypesForTeamExperience(
      team.settings.experience
    ).includes(input.templateType)
  ) {
    return "Project template is not allowed for this team"
  }

  const teamMemberIds = new Set(getTeamMemberIds(state, team.id))
  const resolvedLeadId = input.leadId ?? state.currentUserId

  if (!resolvedLeadId || !teamMemberIds.has(resolvedLeadId)) {
    return "Lead must belong to the selected team"
  }

  const resolvedMemberIds = [
    ...new Set([...(input.memberIds ?? []), resolvedLeadId]),
  ]

  if (!resolvedMemberIds.every((memberId) => teamMemberIds.has(memberId))) {
    return "All project members must belong to the selected team"
  }

  const availableLabelIds = new Set(
    getLabelsForTeamScope(state, team.id).map((label) => label.id)
  )

  if (
    input.labelIds &&
    !input.labelIds.every((labelId) => availableLabelIds.has(labelId))
  ) {
    return "Project labels must belong to the same workspace"
  }

  if (
    input.startDate &&
    input.targetDate &&
    input.targetDate < input.startDate
  ) {
    return "Target date must be on or after the start date"
  }

  return null
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

function getWorkItemTitleValidationMessage(title: string) {
  const normalizedTitle = title.trim()

  return normalizedTitle.length < 2 || normalizedTitle.length > 96
    ? "Work item title must be between 2 and 96 characters"
    : null
}

function getWorkItemAssigneeValidationMessage(
  state: AppData,
  input: WorkItemValidationInput
) {
  return input.assigneeId &&
    !getTeamMemberIds(state, input.teamId).includes(input.assigneeId)
    ? "Assignee must belong to the selected team"
    : null
}

function getWorkItemLabelValidationMessage(
  state: AppData,
  input: WorkItemValidationInput
) {
  if (!("labelIds" in input) || !input.labelIds) {
    return null
  }

  const availableLabelIds = new Set(
    getLabelsForTeamScope(state, input.teamId).map((label) => label.id)
  )

  return input.labelIds.some((labelId) => !availableLabelIds.has(labelId))
    ? "One or more labels are invalid"
    : null
}

function getWorkItemDateValidationMessage(input: WorkItemValidationInput) {
  return input.startDate &&
    input.targetDate &&
    new Date(input.targetDate).getTime() < new Date(input.startDate).getTime()
    ? "Target date must be on or after the start date"
    : null
}

function getInputParentWorkItem(
  state: AppData,
  input: WorkItemValidationInput
) {
  return input.parentId
    ? (state.workItems.find((entry) => entry.id === input.parentId) ?? null)
    : null
}

function getWorkItemParentValidationMessage(
  state: AppData,
  input: WorkItemValidationInput,
  parent: WorkItem | null
) {
  if (!input.parentId) {
    return null
  }

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

  return input.currentItemId &&
    getWorkItemDescendantIds(state, input.currentItemId).has(parent.id)
    ? "Work item hierarchy cannot contain cycles"
    : null
}

function getWorkItemProjectValidationMessage(
  state: AppData,
  input: WorkItemValidationInput,
  primaryProjectId: string | null
) {
  if (!primaryProjectId) {
    return null
  }

  const project = getProjectsForTeamScope(state, input.teamId).find(
    (entry) => entry.id === primaryProjectId
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

export function getWorkItemValidationMessage(
  state: AppData,
  input: WorkItemValidationInput
) {
  const titleValidationMessage = getWorkItemTitleValidationMessage(input.title)

  if (titleValidationMessage) {
    return titleValidationMessage
  }

  const team = state.teams.find((entry) => entry.id === input.teamId)

  if (!team) {
    return "Team not found"
  }

  if (!getTeamFeatureSettings(team).issues) {
    return getWorkSurfaceCopy(team.settings.experience).disabledLabel
  }

  const preProjectValidationMessage =
    getWorkItemAssigneeValidationMessage(state, input) ??
    getWorkItemLabelValidationMessage(state, input) ??
    getWorkItemDateValidationMessage(input)

  if (preProjectValidationMessage) {
    return preProjectValidationMessage
  }

  const parent = getInputParentWorkItem(state, input)
  const parentValidationMessage = getWorkItemParentValidationMessage(
    state,
    input,
    parent
  )

  if (parentValidationMessage) {
    return parentValidationMessage
  }

  const resolvedPrimaryProjectId = parent
    ? (parent.primaryProjectId ?? null)
    : (input.primaryProjectId ?? null)

  return getWorkItemProjectValidationMessage(
    state,
    input,
    resolvedPrimaryProjectId
  )
}

export function getResolvedProjectLinkForWorkItemUpdate(
  state: AppData,
  existing: WorkItem,
  patch: {
    parentId?: string | null
    primaryProjectId?: string | null
  }
): WorkItemProjectLinkResolution {
  return resolveWorkItemProjectLinkUpdate({
    items: state.workItems,
    itemId: existing.id,
    existingPrimaryProjectId: existing.primaryProjectId,
    patch,
  })
}

export function getProjectCascadeConfirmationForWorkItemUpdate(
  state: AppData,
  existing: WorkItem,
  patch: {
    parentId?: string | null
    primaryProjectId?: string | null
  }
) {
  const { cascadeItemIds, resolvedPrimaryProjectId, shouldCascadeProjectLink } =
    getResolvedProjectLinkForWorkItemUpdate(state, existing, patch)
  const requiresConfirmation =
    resolvedPrimaryProjectId !== existing.primaryProjectId &&
    shouldCascadeProjectLink &&
    cascadeItemIds.size > 1

  return {
    cascadeItemIds,
    cascadeItemCount: cascadeItemIds.size,
    resolvedPrimaryProjectId,
    requiresConfirmation,
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

  const userIds = new Set([
    ...state.workspaceMemberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => membership.userId),
    ...state.teamMemberships
      .filter((membership) => workspaceTeamIds.includes(membership.teamId))
      .map((membership) => membership.userId),
  ])

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
