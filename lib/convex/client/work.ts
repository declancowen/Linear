"use client"

import type {
  AttachmentTargetType,
  DisplayProperty,
  GroupField,
  Label,
  OrderingField,
  Priority,
  ProjectPresentationConfig,
  Role,
  ScopeType,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  TemplateType,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"

import { runRouteMutation } from "./shared"

type WorkItemPatch = {
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
  showCompleted: boolean
}>

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
    | "projectIds"
    | "itemTypes"
    | "labelIds",
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

export function syncCreateLabel(input: { name: string; color?: string }) {
  return runRouteMutation<{ label: Label }>("/api/labels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
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
  return runRouteMutation<{ uploadUrl: string }>(
    "/api/attachments/upload-url",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetType,
        targetId,
      }),
    }
  )
}

export function syncCreateAttachment(input: {
  targetType: AttachmentTargetType
  targetId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
}) {
  return runRouteMutation<{ attachmentId: string; fileUrl: string | null }>(
    "/api/attachments",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  )
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
  return runRouteMutation<{
    role?: string
    teamSlug?: string | null
    workspaceId?: string
  }>("/api/teams/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  })
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
  return runRouteMutation<{
    teamId: string
    teamSlug: string
    features: TeamFeatureSettings
  }>("/api/teams", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncCreateProject(
  _currentUserId: string,
  input: {
    scopeType: ScopeType
    scopeId: string
    templateType: TemplateType
    name: string
    summary: string
    priority: Priority
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
    status?: "planning" | "active" | "paused" | "completed"
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
  return runRouteMutation<{
    teamId: string
    workspaceId: string | null
    deletedUserIds: string[]
  }>(`/api/teams/${teamId}/details`, {
    method: "DELETE",
  })
}

export function syncRegenerateTeamJoinCode(teamId: string) {
  return runRouteMutation<{ joinCode: string }>(
    `/api/teams/${teamId}/join-code`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
}

export function syncCreateDocument(
  _currentUserId: string,
  input:
    | {
        kind: "team-document"
        teamId: string
        title: string
      }
    | {
        kind: "workspace-document" | "private-document"
        workspaceId: string
        title: string
      }
) {
  return runRouteMutation("/api/documents", {
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
