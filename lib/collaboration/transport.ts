import {
  createChatCollaborationRoomId,
  createDocumentCollaborationRoomId,
  isChatCollaborationRoomId,
  isDocumentCollaborationRoomId,
} from "./rooms"

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
  | ChatCollaborationSessionTokenClaims

export type CollaborationSessionBootstrap = {
  roomId: string
  documentId: string
  token: string
  serviceUrl: string
  role: CollaborationSessionRole
  contentHtml?: string
  expiresAt?: number
  getFreshBootstrap?: () => Promise<CollaborationSessionBootstrap>
}

export type CollaborationStatusChange = {
  state: CollaborationConnectionState
  reason?: string
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

export type CollaborationFlushInput =
  | CollaborationContentFlushInput
  | CollaborationDocumentTitleFlushInput
  | CollaborationWorkItemMainFlushInput

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

  if (kind !== "doc" && kind !== "chat") {
    return {
      success: false,
      error: "kind must be doc or chat",
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
  const normalizedSessionId = parsedStrings.get("sessionId")!

  if (kind === "doc") {
    if (!isCollaborationSessionRole(role)) {
      return {
        success: false,
        error: "role must be viewer or editor",
      }
    }

    const normalizedRole: CollaborationSessionRole = role

    const normalizedDocumentId = parsedStrings.get("documentId")!

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
        iat: typeof iat === "number" ? iat : undefined,
        exp: normalizedExp,
      },
    }
  }

  const normalizedConversationId = parsedStrings.get("conversationId")!

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
  contentHtml?: string
}) {
  return {
    roomId: createDocumentCollaborationRoomId(input.documentId),
    documentId: input.documentId,
    token: input.token,
    serviceUrl: input.serviceUrl,
    role: input.role,
    contentHtml: input.contentHtml,
  } satisfies CollaborationSessionBootstrap
}

export function createChatSessionRoomId(conversationId: string) {
  return createChatCollaborationRoomId(conversationId)
}
