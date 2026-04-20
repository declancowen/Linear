"use client"

import type {
  AttachmentTargetType,
  DocumentPresenceViewer,
  DisplayProperty,
  EntityKind,
  GroupField,
  HiddenState,
  OrderingField,
  Priority,
  ProjectPresentationConfig,
  ProjectStatus,
  Role,
  ScopeType,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  TemplateType,
  ViewContainerType,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"

import {
  normalizeCreateAttachmentResult,
  normalizeCreateLabelResult,
  normalizeCreateTeamResult,
  normalizeDeleteTeamResult,
  normalizeGenerateAttachmentUploadUrlResult,
  normalizeJoinTeamByCodeResult,
  normalizeLeaveTeamResult,
  normalizeRegenerateTeamJoinCodeResult,
} from "./contracts"
import { runRouteMutation } from "./shared"

type WorkItemPatch = {
  title?: string
  description?: string
  expectedUpdatedAt?: string
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

type UpdateViewConfigPatch = Partial<{
  layout: "list" | "board" | "timeline"
  grouping: GroupField
  subGrouping: GroupField | null
  ordering: OrderingField
  itemLevel: WorkItemType | null
  showChildItems: boolean
  showCompleted: boolean
}>

type CreateViewInput = {
  id?: string
  scopeType: "team" | "workspace"
  scopeId: string
  entityKind: EntityKind
  containerType?: ViewContainerType | null
  containerId?: string | null
  route: string
  name: string
  description: string
  layout?: "list" | "board" | "timeline"
  grouping?: GroupField
  subGrouping?: GroupField | null
  ordering?: OrderingField
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  filters?: {
    status: WorkStatus[]
    priority: Priority[]
    assigneeIds: string[]
    creatorIds: string[]
    leadIds: string[]
    health: ProjectPresentationConfig["filters"]["health"]
    milestoneIds: string[]
    relationTypes: string[]
    projectIds: string[]
    itemTypes: WorkItemType[]
    labelIds: string[]
    teamIds: string[]
    showCompleted: boolean
  }
  displayProps?: DisplayProperty[]
  hiddenState?: HiddenState
}

export function syncMarkNotificationRead(notificationId: string) {
  return runRouteMutation(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "markRead",
    }),
  })
}

export function syncToggleNotificationRead(notificationId: string) {
  return runRouteMutation(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "toggleRead",
    }),
  })
}

export function syncArchiveNotification(notificationId: string) {
  return runRouteMutation(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "archive",
    }),
  })
}

export function syncUnarchiveNotification(notificationId: string) {
  return runRouteMutation(`/api/notifications/${notificationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "unarchive",
    }),
  })
}

export function syncArchiveNotifications(notificationIds: string[]) {
  return runRouteMutation("/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "archive",
      notificationIds,
    }),
  })
}

export function syncUnarchiveNotifications(notificationIds: string[]) {
  return runRouteMutation("/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "unarchive",
      notificationIds,
    }),
  })
}

export function syncDeleteNotification(notificationId: string) {
  return runRouteMutation(`/api/notifications/${notificationId}`, {
    method: "DELETE",
  })
}

export function syncUpdateViewConfig(
  viewId: string,
  patch: UpdateViewConfigPatch
) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "updateConfig",
      patch,
    }),
  })
}

export function syncRenameView(viewId: string, name: string) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "rename",
      name,
    }),
  })
}

export function syncDeleteView(viewId: string) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "DELETE",
  })
}

export function syncCreateView(currentUserId: string, input: CreateViewInput) {
  return runRouteMutation<{
    ok: true
    viewId: string | null
  }>("/api/views", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentUserId,
      ...input,
    }),
  })
}

export function syncToggleViewDisplayProperty(
  viewId: string,
  property: DisplayProperty
) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "toggleDisplayProperty",
      property,
    }),
  })
}

export function syncReorderViewDisplayProperties(
  viewId: string,
  displayProps: DisplayProperty[]
) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "reorderDisplayProperties",
      displayProps,
    }),
  })
}

export function syncToggleViewHiddenValue(
  viewId: string,
  key: "groups" | "subgroups",
  value: string
) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "toggleHiddenValue",
      key,
      value,
    }),
  })
}

export function syncToggleViewFilterValue(
  viewId: string,
  key:
    | "status"
    | "priority"
    | "assigneeIds"
    | "creatorIds"
    | "leadIds"
    | "health"
    | "milestoneIds"
    | "relationTypes"
    | "projectIds"
    | "parentIds"
    | "itemTypes"
    | "labelIds"
    | "teamIds",
  value: string
) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "toggleFilterValue",
      key,
      value,
    }),
  })
}

export function syncClearViewFilters(viewId: string) {
  return runRouteMutation(`/api/views/${viewId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "clearFilters",
    }),
  })
}

export function syncUpdateWorkItem(
  _currentUserId: string,
  itemId: string,
  patch: WorkItemPatch
) {
  return runRouteMutation(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  })
}

export async function syncHeartbeatWorkItemPresence(
  itemId: string,
  sessionId: string
) {
  const payload = await runRouteMutation<{
    viewers: DocumentPresenceViewer[]
  }>(`/api/items/${itemId}/presence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "heartbeat",
      sessionId,
    }),
  })

  return payload?.viewers ?? []
}

export function syncClearWorkItemPresence(
  itemId: string,
  sessionId: string,
  options?: {
    keepalive?: boolean
  }
) {
  return runRouteMutation<{ ok: true }>(`/api/items/${itemId}/presence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "leave",
      sessionId,
    }),
    keepalive: options?.keepalive,
  })
}

export function syncCreateLabel(input: {
  workspaceId?: string
  name: string
  color?: string
}) {
  return runRouteMutation<unknown>("/api/labels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }).then(normalizeCreateLabelResult)
}

export function syncShiftTimelineItem(itemId: string, nextStartDate: string) {
  return runRouteMutation(`/api/items/${itemId}/schedule`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nextStartDate,
    }),
  })
}

export function syncUpdateDocumentContent(
  _currentUserId: string,
  documentId: string,
  content: string
) {
  return syncUpdateDocument(documentId, {
    content,
  })
}

export function syncUpdateDocument(
  documentId: string,
  patch: {
    title?: string
    content?: string
  }
) {
  return runRouteMutation(`/api/documents/${documentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  })
}

export function syncSendDocumentMentionNotifications(
  documentId: string,
  mentions: Array<{
    userId: string
    count: number
  }>
): Promise<{
  ok: boolean
  recipientCount: number
  mentionCount: number
}> {
  return runRouteMutation(`/api/documents/${documentId}/mentions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mentions,
    }),
  })
}

export function syncSendItemDescriptionMentionNotifications(
  itemId: string,
  mentions: Array<{
    userId: string
    count: number
  }>
): Promise<{
  ok: boolean
  recipientCount: number
  mentionCount: number
}> {
  return runRouteMutation(`/api/items/${itemId}/description/mentions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mentions,
    }),
  })
}

export function syncDeleteDocument(documentId: string) {
  return runRouteMutation(`/api/documents/${documentId}`, {
    method: "DELETE",
  })
}

export function syncRenameDocument(
  _currentUserId: string,
  documentId: string,
  title: string
) {
  return syncUpdateDocument(documentId, {
    title,
  })
}

export function syncUpdateItemDescription(
  _currentUserId: string,
  itemId: string,
  content: string
) {
  return runRouteMutation(`/api/items/${itemId}/description`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
    }),
  })
}

export function syncAddComment(
  _currentUserId: string,
  targetType: "workItem" | "document",
  targetId: string,
  content: string,
  parentCommentId?: string | null
) {
  return runRouteMutation("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      targetType,
      targetId,
      parentCommentId,
      content,
    }),
  })
}

export function syncToggleCommentReaction(commentId: string, emoji: string) {
  return runRouteMutation(`/api/comments/${commentId}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emoji,
    }),
  })
}

export function syncGenerateAttachmentUploadUrl(
  targetType: AttachmentTargetType,
  targetId: string
) {
  return runRouteMutation<unknown>("/api/attachments/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      targetType,
      targetId,
    }),
  }).then(normalizeGenerateAttachmentUploadUrlResult)
}

export function syncCreateAttachment(input: {
  targetType: AttachmentTargetType
  targetId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
}) {
  return runRouteMutation<unknown>("/api/attachments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }).then(normalizeCreateAttachmentResult)
}

export function syncDeleteAttachment(attachmentId: string) {
  return runRouteMutation(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
  })
}

export function syncCreateInvite(
  _currentUserId: string,
  teamIds: string[],
  email: string,
  role: Role
) {
  return runRouteMutation("/api/invites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamIds,
      email,
      role,
    }),
  })
}

export function syncJoinTeamByCode(_currentUserId: string, code: string) {
  return runRouteMutation<unknown>("/api/teams/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  }).then(normalizeJoinTeamByCodeResult)
}

export function syncSendInvite(teamIds: string[], email: string, role: Role) {
  return syncCreateInvite("", teamIds, email, role)
}

export function syncJoinTeam(code: string) {
  return syncJoinTeamByCode("", code)
}

export function syncCreateTeam(input: {
  name: string
  icon: string
  summary: string
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
  features: TeamFeatureSettings
}) {
  return runRouteMutation<unknown>("/api/teams", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }).then(normalizeCreateTeamResult)
}

export function syncCreateProject(
  _currentUserId: string,
  input: {
    scopeType: ScopeType
    scopeId: string
    templateType: TemplateType
    name: string
    summary: string
    status?: ProjectStatus
    priority: Priority
    leadId?: string | null
    memberIds?: string[]
    startDate?: string | null
    targetDate?: string | null
    labelIds?: string[]
    settingsTeamId?: string | null
    presentation?: ProjectPresentationConfig
  }
) {
  return runRouteMutation("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncUpdateProject(
  _currentUserId: string,
  projectId: string,
  patch: {
    name?: string
    status?: ProjectStatus
    priority?: Priority
  }
) {
  return runRouteMutation(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  })
}

export function syncRenameProject(
  _currentUserId: string,
  projectId: string,
  name: string
) {
  return runRouteMutation(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
    }),
  })
}

export function syncDeleteProject(_currentUserId: string, projectId: string) {
  return runRouteMutation(`/api/projects/${projectId}`, {
    method: "DELETE",
  })
}

export function syncUpdateTeamWorkflowSettings(
  teamId: string,
  workflow: TeamWorkflowSettings
) {
  return runRouteMutation(`/api/teams/${teamId}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(workflow),
  })
}

export function syncUpdateTeamDetails(
  teamId: string,
  input: {
    name: string
    icon: string
    summary: string
    experience:
      | "software-development"
      | "issue-analysis"
      | "project-management"
      | "community"
    features: TeamFeatureSettings
  }
) {
  return runRouteMutation(`/api/teams/${teamId}/details`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncDeleteTeam(teamId: string) {
  return runRouteMutation<unknown>(`/api/teams/${teamId}/details`, {
    method: "DELETE",
  }).then(normalizeDeleteTeamResult)
}

export function syncLeaveTeam(teamId: string) {
  return runRouteMutation<unknown>(`/api/teams/${teamId}/leave`, {
    method: "DELETE",
  }).then(normalizeLeaveTeamResult)
}

export function syncUpdateTeamMemberRole(
  teamId: string,
  userId: string,
  role: Role
) {
  return runRouteMutation(`/api/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
    }),
  })
}

export function syncRemoveTeamMember(teamId: string, userId: string) {
  return runRouteMutation(`/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  })
}

export function syncRegenerateTeamJoinCode(teamId: string) {
  return runRouteMutation<unknown>(`/api/teams/${teamId}/join-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(normalizeRegenerateTeamJoinCodeResult)
}

export function syncCreateDocument(
  _currentUserId: string,
  input:
    | {
        id?: string
        kind: "team-document"
        teamId: string
        title: string
      }
    | {
        id?: string
        kind: "workspace-document" | "private-document"
        workspaceId: string
        title: string
      }
) {
  return runRouteMutation<{
    ok: true
    documentId: string | null
  }>("/api/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncCreateWorkItem(
  _currentUserId: string,
  input: {
    teamId: string
    type: WorkItemType
    title: string
    parentId?: string | null
    primaryProjectId: string | null
    assigneeId: string | null
    status?: WorkStatus
    priority: Priority
    labelIds?: string[]
    startDate?: string | null
    targetDate?: string | null
  }
) {
  return runRouteMutation("/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncDeleteWorkItem(itemId: string) {
  return runRouteMutation(`/api/items/${itemId}`, {
    method: "DELETE",
  })
}
