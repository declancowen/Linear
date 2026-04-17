"use client"

import type {
  AppSnapshot,
  Call,
  ChatMessage,
  Label,
  TeamFeatureSettings,
} from "@/lib/domain/types"

import { RouteMutationError } from "./shared"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isString(value)
}

function assertRouteContract(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new RouteMutationError(message, 500)
  }
}

function isSnapshotRecord(value: unknown): value is AppSnapshot {
  return (
    isRecord(value) &&
    isString(value.currentUserId) &&
    isString(value.currentWorkspaceId) &&
    Array.isArray(value.workspaces) &&
    Array.isArray(value.teams) &&
    Array.isArray(value.teamMemberships) &&
    Array.isArray(value.users) &&
    Array.isArray(value.labels) &&
    Array.isArray(value.projects) &&
    Array.isArray(value.milestones) &&
    Array.isArray(value.workItems) &&
    Array.isArray(value.documents) &&
    Array.isArray(value.views) &&
    Array.isArray(value.comments) &&
    Array.isArray(value.attachments) &&
    Array.isArray(value.notifications) &&
    Array.isArray(value.invites) &&
    Array.isArray(value.projectUpdates) &&
    Array.isArray(value.conversations) &&
    Array.isArray(value.calls) &&
    Array.isArray(value.chatMessages) &&
    Array.isArray(value.channelPosts) &&
    Array.isArray(value.channelPostComments)
  )
}

function isChatMessageRecord(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.conversationId) &&
    isString(value.kind) &&
    isString(value.content) &&
    isStringArray(value.mentionUserIds) &&
    isString(value.createdBy) &&
    isString(value.createdAt) &&
    (value.callId === undefined || value.callId === null || isString(value.callId))
  )
}

function isCallRecord(value: unknown): value is Call {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.conversationId) &&
    isString(value.scopeType) &&
    isString(value.scopeId) &&
    (value.roomId === null || isString(value.roomId)) &&
    (value.roomName === null || isString(value.roomName)) &&
    isString(value.roomKey) &&
    isString(value.roomDescription) &&
    isString(value.startedBy) &&
    isString(value.startedAt) &&
    isString(value.updatedAt) &&
    (value.endedAt === null || isString(value.endedAt)) &&
    isStringArray(value.participantUserIds) &&
    (value.lastJoinedAt === null || isString(value.lastJoinedAt)) &&
    (value.lastJoinedBy === null || isString(value.lastJoinedBy)) &&
    typeof value.joinCount === "number"
  )
}

function isLabelRecord(value: unknown): value is Label {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.workspaceId) &&
    isString(value.name) &&
    isString(value.color)
  )
}

function isTeamFeatureSettingsRecord(
  value: unknown
): value is TeamFeatureSettings {
  return (
    isRecord(value) &&
    typeof value.issues === "boolean" &&
    typeof value.projects === "boolean" &&
    typeof value.views === "boolean" &&
    typeof value.docs === "boolean" &&
    typeof value.chat === "boolean" &&
    typeof value.channels === "boolean"
  )
}

export function normalizeSnapshotRoutePayload(payload: unknown): {
  snapshot: AppSnapshot
  version: number
} {
  if (isRecord(payload) && "snapshot" in payload) {
    assertRouteContract(
      isSnapshotRecord(payload.snapshot),
      "Invalid snapshot payload"
    )
    assertRouteContract(
      typeof payload.version === "number",
      "Invalid snapshot payload"
    )

    return {
      snapshot: payload.snapshot,
      version: payload.version,
    }
  }

  assertRouteContract(isSnapshotRecord(payload), "Invalid snapshot payload")

  return {
    snapshot: payload,
    version: 0,
  }
}

export function normalizeDeleteCurrentAccountResult(payload: unknown): {
  ok: true
  logoutRequired: true
  notice: string
} {
  assertRouteContract(isRecord(payload), "Invalid delete-account payload")
  assertRouteContract(payload.ok === true, "Invalid delete-account payload")
  assertRouteContract(
    payload.logoutRequired === true,
    "Invalid delete-account payload"
  )
  assertRouteContract(isString(payload.notice), "Invalid delete-account payload")

  return {
    ok: true,
    logoutRequired: true,
    notice: payload.notice,
  }
}

export function normalizeLeaveWorkspaceResult(payload: unknown): {
  ok?: true
  workspaceId: string
  removedTeamIds: string[]
} {
  assertRouteContract(isRecord(payload), "Invalid leave-workspace payload")
  assertRouteContract(
    isString(payload.workspaceId),
    "Invalid leave-workspace payload"
  )
  assertRouteContract(
    isStringArray(payload.removedTeamIds),
    "Invalid leave-workspace payload"
  )

  return payload as {
    ok?: true
    workspaceId: string
    removedTeamIds: string[]
  }
}

export function normalizeCreateLabelResult(payload: unknown): {
  ok?: true
  label: Label
} {
  assertRouteContract(isRecord(payload), "Invalid create-label payload")
  assertRouteContract(isLabelRecord(payload.label), "Invalid create-label payload")

  return payload as {
    ok?: true
    label: Label
  }
}

export function normalizeGenerateAttachmentUploadUrlResult(payload: unknown): {
  uploadUrl: string
} {
  assertRouteContract(
    isRecord(payload),
    "Invalid attachment-upload-url payload"
  )
  assertRouteContract(
    isString(payload.uploadUrl),
    "Invalid attachment-upload-url payload"
  )

  return payload as {
    uploadUrl: string
  }
}

export function normalizeCreateAttachmentResult(payload: unknown): {
  attachmentId: string
  fileUrl: string | null
} {
  assertRouteContract(isRecord(payload), "Invalid create-attachment payload")
  assertRouteContract(
    isString(payload.attachmentId),
    "Invalid create-attachment payload"
  )
  assertRouteContract(
    isStringOrNull(payload.fileUrl),
    "Invalid create-attachment payload"
  )

  return payload as {
    attachmentId: string
    fileUrl: string | null
  }
}

export function normalizeJoinTeamByCodeResult(payload: unknown): {
  ok?: true
  role?: string
  teamSlug?: string | null
  workspaceId?: string
} {
  assertRouteContract(isRecord(payload), "Invalid join-team payload")
  assertRouteContract(
    payload.role === undefined || isString(payload.role),
    "Invalid join-team payload"
  )
  assertRouteContract(
    payload.teamSlug === undefined || isStringOrNull(payload.teamSlug),
    "Invalid join-team payload"
  )
  assertRouteContract(
    payload.workspaceId === undefined || isString(payload.workspaceId),
    "Invalid join-team payload"
  )

  return payload as {
    ok?: true
    role?: string
    teamSlug?: string | null
    workspaceId?: string
  }
}

export function normalizeCreateTeamResult(payload: unknown): {
  ok?: true
  teamId: string
  teamSlug: string
  joinCode: string
  features: TeamFeatureSettings
} {
  assertRouteContract(isRecord(payload), "Invalid create-team payload")
  assertRouteContract(isString(payload.teamId), "Invalid create-team payload")
  assertRouteContract(isString(payload.teamSlug), "Invalid create-team payload")
  assertRouteContract(isString(payload.joinCode), "Invalid create-team payload")
  assertRouteContract(
    isTeamFeatureSettingsRecord(payload.features),
    "Invalid create-team payload"
  )

  return payload as {
    ok?: true
    teamId: string
    teamSlug: string
    joinCode: string
    features: TeamFeatureSettings
  }
}

export function normalizeDeleteTeamResult(payload: unknown): {
  ok?: true
  teamId: string
  workspaceId: string | null
  deletedUserIds: string[]
} {
  assertRouteContract(isRecord(payload), "Invalid delete-team payload")
  assertRouteContract(isString(payload.teamId), "Invalid delete-team payload")
  assertRouteContract(
    isStringOrNull(payload.workspaceId),
    "Invalid delete-team payload"
  )
  assertRouteContract(
    isStringArray(payload.deletedUserIds),
    "Invalid delete-team payload"
  )

  return payload as {
    ok?: true
    teamId: string
    workspaceId: string | null
    deletedUserIds: string[]
  }
}

export function normalizeLeaveTeamResult(payload: unknown): {
  ok?: true
  teamId: string
  workspaceId: string | null
} {
  assertRouteContract(isRecord(payload), "Invalid leave-team payload")
  assertRouteContract(isString(payload.teamId), "Invalid leave-team payload")
  assertRouteContract(
    isStringOrNull(payload.workspaceId),
    "Invalid leave-team payload"
  )

  return payload as {
    ok?: true
    teamId: string
    workspaceId: string | null
  }
}

export function normalizeRegenerateTeamJoinCodeResult(payload: unknown): {
  ok?: true
  joinCode: string
} {
  assertRouteContract(
    isRecord(payload),
    "Invalid regenerate-team-join-code payload"
  )
  assertRouteContract(
    isString(payload.joinCode),
    "Invalid regenerate-team-join-code payload"
  )

  return payload as {
    ok?: true
    joinCode: string
  }
}

export function normalizeStartConversationCallResult(payload: unknown): {
  ok?: true
  call: Call | null
  message: ChatMessage
  joinHref: string
} {
  assertRouteContract(
    isRecord(payload),
    "Invalid start-conversation-call payload"
  )
  assertRouteContract(
    isString(payload.joinHref),
    "Invalid start-conversation-call payload"
  )
  assertRouteContract(
    payload.call === null || isCallRecord(payload.call),
    "Invalid start-conversation-call payload"
  )
  assertRouteContract(
    isChatMessageRecord(payload.message),
    "Invalid start-conversation-call payload"
  )

  return payload as {
    ok?: true
    call: Call | null
    message: ChatMessage
    joinHref: string
  }
}
