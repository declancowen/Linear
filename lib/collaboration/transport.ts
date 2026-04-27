import {
  createChatCollaborationRoomId,
  createDocumentCollaborationRoomId,
  isChatCollaborationRoomId,
  isDocumentCollaborationRoomId,
} from "./rooms"
import type { CollaborationLimits } from "./limits"
import type { CollaborationErrorCode } from "./errors"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
  isSupportedCollaborationProtocolVersion,
  isSupportedRichTextCollaborationSchemaVersion,
} from "./protocol"
import type { JSONContent } from "@tiptap/core"

export type CollaborationSessionRole = "viewer" | "editor"
export type CollaborationConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "errored"

export type DocumentCollaborationSessionTokenClaims = {
  kind: "doc"
  sub: string
  roomId: string
  documentId: string
  role: CollaborationSessionRole
  sessionId: string
  workspaceId?: string | null
  protocolVersion: number
  schemaVersion: number
  iat?: number
  exp: number
}

export type InternalCollaborationRefreshTokenClaims = {
  kind: "internal-refresh"
  sub: "server"
  roomId: string
  documentId: string
  action: "refresh"
  protocolVersion: number
  iat?: number
  exp: number
}

export type ChatCollaborationSessionTokenClaims = {
  kind: "chat"
  sub: string
  roomId: string
  conversationId: string
  sessionId: string
  workspaceId?: string | null
  iat?: number
  exp: number
}

export type CollaborationSessionTokenClaims =
  | DocumentCollaborationSessionTokenClaims
  | InternalCollaborationRefreshTokenClaims
  | ChatCollaborationSessionTokenClaims

export type CollaborationSessionBootstrap = {
  roomId: string
  documentId: string
  token: string
  serviceUrl: string
  role: CollaborationSessionRole
  protocolVersion?: number
  schemaVersion?: number
  limits?: CollaborationLimits
  contentJson?: JSONContent
  contentHtml?: string
  expiresAt?: number
  getFreshBootstrap?: () => Promise<CollaborationSessionBootstrap>
}

export type CollaborationStatusChange = {
  state: CollaborationConnectionState
  reason?: string
  code?: CollaborationErrorCode
  reloadRequired?: boolean
}

export type CollaborationAwarenessChange<TAwarenessState> = {
  local: TAwarenessState | null
  remote: TAwarenessState[]
}

export type CollaborationContentFlushInput = {
  kind?: "content"
}

export type CollaborationDocumentTitleFlushInput = {
  kind: "document-title"
  documentTitle: string
}

export type CollaborationWorkItemMainFlushInput = {
  kind: "work-item-main"
  workItemExpectedUpdatedAt?: string
  workItemTitle?: string
}

export type CollaborationTeardownContentFlushInput = {
  kind: "teardown-content"
}

export type CollaborationFlushInput =
  | CollaborationContentFlushInput
  | CollaborationDocumentTitleFlushInput
  | CollaborationWorkItemMainFlushInput
  | CollaborationTeardownContentFlushInput

export interface CollaborationTransportSession<
  TAwarenessState,
  TBinding = unknown,
> {
  readonly binding: TBinding
  connect(): Promise<void>
  disconnect(reason?: string): void
  updateLocalAwareness(nextState: TAwarenessState | null): void
  flush(input?: CollaborationFlushInput): Promise<void>
  onStatusChange(
    listener: (change: CollaborationStatusChange) => void
  ): () => void
  onAwarenessChange(
    listener: (
      change: CollaborationAwarenessChange<TAwarenessState>
    ) => void
  ): () => void
}

export interface CollaborationTransportAdapter<
  TAwarenessState,
  TBinding = unknown,
> {
  openDocumentSession(
    bootstrap: CollaborationSessionBootstrap
  ): CollaborationTransportSession<TAwarenessState, TBinding>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseRequiredString(
  value: unknown,
  label: string
):
  | { success: true; value: string }
  | { success: false; error: string } {
  if (typeof value !== "string") {
    return {
      success: false,
      error: `${label} must be a string`,
    }
  }

  const normalized = value.trim()

  if (!normalized) {
    return {
      success: false,
      error: `${label} is required`,
    }
  }

  return {
    success: true,
    value: normalized,
  }
}

function parseOptionalNumber(
  value: unknown,
  label: string
): string | null {
  if (typeof value === "undefined") {
    return null
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    return `${label} must be a non-negative integer`
  }

  return null
}

export function isCollaborationSessionRole(
  value: unknown
): value is CollaborationSessionRole {
  return value === "viewer" || value === "editor"
}

export function safeParseCollaborationSessionTokenClaims(input: unknown):
  | { success: true; data: CollaborationSessionTokenClaims }
  | { success: false; error: string } {
  if (!isRecord(input)) {
    return {
      success: false,
      error: "collaboration token claims must be an object",
    }
  }

  const kind = input.kind
  const sub = input.sub
  const roomId = input.roomId
  const documentId = input.documentId
  const conversationId = input.conversationId
  const role = input.role
  const sessionId = input.sessionId
  const workspaceId = input.workspaceId
  const iat = input.iat
  const exp = input.exp

  if (kind !== "doc" && kind !== "chat" && kind !== "internal-refresh") {
    return {
      success: false,
      error: "kind must be doc, chat, or internal-refresh",
    }
  }

  const parsedStrings = new Map<string, string>()

  const requiredStringFields =
    kind === "doc"
      ? ([
          [sub, "sub"],
          [roomId, "roomId"],
          [documentId, "documentId"],
          [sessionId, "sessionId"],
        ] as const)
      : kind === "internal-refresh"
        ? ([
            [sub, "sub"],
            [roomId, "roomId"],
            [documentId, "documentId"],
          ] as const)
      : ([
          [sub, "sub"],
          [roomId, "roomId"],
          [conversationId, "conversationId"],
          [sessionId, "sessionId"],
        ] as const)

  for (const [value, label] of requiredStringFields) {
    const parsed = parseRequiredString(value, label)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error,
      }
    }

    parsedStrings.set(label, parsed.value)
  }

  if (
    typeof workspaceId !== "undefined" &&
    workspaceId !== null &&
    typeof workspaceId !== "string"
  ) {
    return {
      success: false,
      error: "workspaceId must be a string or null",
    }
  }

  const iatError = parseOptionalNumber(iat, "iat")

  if (iatError) {
    return {
      success: false,
      error: iatError,
    }
  }

  if (typeof exp !== "number" || !Number.isInteger(exp) || exp <= 0) {
    return {
      success: false,
      error: "exp must be a positive integer",
    }
  }

  const normalizedExp = exp

  const normalizedSub = parsedStrings.get("sub")!
  const normalizedRoomId = parsedStrings.get("roomId")!

  if (kind === "doc") {
    const normalizedSessionId = parsedStrings.get("sessionId")!

    if (!isCollaborationSessionRole(role)) {
      return {
        success: false,
        error: "role must be viewer or editor",
      }
    }

    const normalizedRole: CollaborationSessionRole = role

    const normalizedDocumentId = parsedStrings.get("documentId")!
    const protocolVersion = input.protocolVersion
    const schemaVersion = input.schemaVersion

    if (typeof protocolVersion !== "number") {
      return {
        success: false,
        error: "protocolVersion is required",
      }
    }

    if (typeof schemaVersion !== "number") {
      return {
        success: false,
        error: "schemaVersion is required",
      }
    }

    if (!isSupportedCollaborationProtocolVersion(protocolVersion)) {
      return {
        success: false,
        error: "protocolVersion is unsupported",
      }
    }

    if (!isSupportedRichTextCollaborationSchemaVersion(schemaVersion)) {
      return {
        success: false,
        error: "schemaVersion is unsupported",
      }
    }

    if (
      !isDocumentCollaborationRoomId(normalizedRoomId, normalizedDocumentId)
    ) {
      return {
        success: false,
        error: "roomId must match the document collaboration room",
      }
    }

    return {
      success: true,
      data: {
        kind,
        sub: normalizedSub,
        roomId: normalizedRoomId,
        documentId: normalizedDocumentId,
        role: normalizedRole,
        sessionId: normalizedSessionId,
        workspaceId,
        protocolVersion,
        schemaVersion,
        iat: typeof iat === "number" ? iat : undefined,
        exp: normalizedExp,
      },
    }
  }

  if (kind === "internal-refresh") {
    const normalizedDocumentId = parsedStrings.get("documentId")!
    const action = input.action
    const protocolVersion = input.protocolVersion

    if (normalizedSub !== "server") {
      return {
        success: false,
        error: "sub must be server for internal refresh",
      }
    }

    if (action !== "refresh") {
      return {
        success: false,
        error: "action must be refresh",
      }
    }

    if (typeof protocolVersion !== "number") {
      return {
        success: false,
        error: "protocolVersion is required",
      }
    }

    if (!isSupportedCollaborationProtocolVersion(protocolVersion)) {
      return {
        success: false,
        error: "protocolVersion is unsupported",
      }
    }

    if (
      !isDocumentCollaborationRoomId(normalizedRoomId, normalizedDocumentId)
    ) {
      return {
        success: false,
        error: "roomId must match the document collaboration room",
      }
    }

    return {
      success: true,
      data: {
        kind,
        sub: "server",
        roomId: normalizedRoomId,
        documentId: normalizedDocumentId,
        action,
        protocolVersion,
        iat: typeof iat === "number" ? iat : undefined,
        exp: normalizedExp,
      },
    }
  }

  const normalizedConversationId = parsedStrings.get("conversationId")!
  const normalizedSessionId = parsedStrings.get("sessionId")!

  if (!isChatCollaborationRoomId(normalizedRoomId, normalizedConversationId)) {
    return {
      success: false,
      error: "roomId must match the chat collaboration room",
    }
  }

  return {
    success: true,
    data: {
      kind,
      sub: normalizedSub,
      roomId: normalizedRoomId,
      conversationId: normalizedConversationId,
      sessionId: normalizedSessionId,
      workspaceId,
      iat: typeof iat === "number" ? iat : undefined,
      exp: normalizedExp,
    },
  }
}

export function parseCollaborationSessionTokenClaims(input: unknown) {
  const parsed = safeParseCollaborationSessionTokenClaims(input)

  if (!parsed.success) {
    throw new Error(parsed.error)
  }

  return parsed.data
}

export function createDocumentSessionBootstrap(input: {
  documentId: string
  token: string
  serviceUrl: string
  role: CollaborationSessionRole
  limits: CollaborationLimits
  contentJson?: JSONContent
  contentHtml?: string
}) {
  return {
    roomId: createDocumentCollaborationRoomId(input.documentId),
    documentId: input.documentId,
    token: input.token,
    serviceUrl: input.serviceUrl,
    role: input.role,
    protocolVersion: COLLABORATION_PROTOCOL_VERSION,
    schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
    limits: input.limits,
    contentJson: input.contentJson,
    contentHtml: input.contentHtml,
  } satisfies CollaborationSessionBootstrap
}

export function createChatSessionRoomId(conversationId: string) {
  return createChatCollaborationRoomId(conversationId)
}
