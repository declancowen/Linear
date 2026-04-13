"use client"

import { ConvexHttpClient } from "convex/browser"
import { ConvexReactClient } from "convex/react"

import { api } from "@/convex/_generated/api"
import type {
  AttachmentTargetType,
  DisplayProperty,
  GroupField,
  OrderingField,
  Priority,
  Role,
  ScopeType,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  TemplateType,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"

export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
export const hasConvex = convexUrl.length > 0

export const convexReactClient = hasConvex
  ? new ConvexReactClient(convexUrl)
  : null

const convexHttpClient = hasConvex ? new ConvexHttpClient(convexUrl) : null

async function runRouteMutation<T>(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<T | null> {
  if (typeof window === "undefined") {
    return null
  }

  const response = await fetch(input, init)
  const payload = (await response.json().catch(() => null)) as {
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed")
  }

  return payload as T
}

export async function fetchSnapshot(email?: string) {
  if (!convexHttpClient) {
    return null
  }

  return convexHttpClient.query(api.app.getSnapshot, {
    email,
  })
}

type WorkItemPatch = {
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
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

export function syncUpdateWorkspaceBranding(
  _workspaceId: string,
  name: string,
  logoUrl: string,
  accent: string,
  description: string
) {
  return runRouteMutation("/api/workspace/current", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      logoUrl,
      accent,
      description,
    }),
  })
}

export function syncUpdateCurrentUserProfile(
  _userId: string,
  name: string,
  title: string,
  avatarUrl: string,
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
  }
) {
  return runRouteMutation("/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      title,
      avatarUrl,
      preferences,
    }),
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
  return runRouteMutation<{ teamSlug?: string | null }>("/api/teams/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  })
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
  scopeType: ScopeType,
  scopeId: string,
  templateType: TemplateType,
  name: string,
  summary: string,
  priority: Priority,
  settingsTeamId?: string | null
) {
  return runRouteMutation("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scopeType,
      scopeId,
      templateType,
      name,
      summary,
      priority,
      settingsTeamId,
    }),
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

export function syncCreateWorkspaceChat(input: {
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/chats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncEnsureTeamChat(input: {
  teamId: string
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/chats/team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncSendChatMessage(conversationId: string, content: string) {
  return runRouteMutation<{ messageId: string }>(
    `/api/chats/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    }
  )
}

export function syncCreateChannel(input: {
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncCreateChannelPost(input: {
  conversationId: string
  title: string
  content: string
}) {
  return runRouteMutation<{ postId: string }>(
    `/api/channels/${input.conversationId}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
      }),
    }
  )
}

export function syncAddChannelPostComment(postId: string, content: string) {
  return runRouteMutation<{ commentId: string }>(
    `/api/channel-posts/${postId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    }
  )
}

export function syncDeleteChannelPost(postId: string) {
  return runRouteMutation<{ ok: true }>(`/api/channel-posts/${postId}`, {
    method: "DELETE",
  })
}

export function syncToggleChannelPostReaction(postId: string, emoji: string) {
  return runRouteMutation<{ ok: true }>(
    `/api/channel-posts/${postId}/reactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emoji,
      }),
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
  teamId: string,
  type: WorkItemType,
  title: string,
  parentId: string | null,
  primaryProjectId: string | null,
  assigneeId: string | null,
  priority: Priority
) {
  return runRouteMutation("/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId,
      type,
      title,
      parentId,
      primaryProjectId,
      assigneeId,
      priority,
    }),
  })
}

export function syncDeleteWorkItem(itemId: string) {
  return runRouteMutation(`/api/items/${itemId}`, {
    method: "DELETE",
  })
}
