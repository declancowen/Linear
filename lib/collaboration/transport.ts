import {
  createDocumentCollaborationRoomId,
  isDocumentCollaborationRoomId,
} from "./rooms"

export type CollaborationSessionRole = "viewer" | "editor"
export type CollaborationConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "errored"

export type CollaborationSessionTokenClaims = {
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

export type CollaborationFlushInput = {
  workItemExpectedUpdatedAt?: string
  workItemTitle?: string
}

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
  const role = input.role
  const sessionId = input.sessionId
  const workspaceId = input.workspaceId
  const iat = input.iat
  const exp = input.exp

  if (kind !== "doc") {
    return {
      success: false,
      error: "kind must be doc",
    }
  }

  const parsedStrings = new Map<string, string>()

  for (const [value, label] of [
    [sub, "sub"],
    [roomId, "roomId"],
    [documentId, "documentId"],
    [sessionId, "sessionId"],
  ] as const) {
    const parsed = parseRequiredString(value, label)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error,
      }
    }

    parsedStrings.set(label, parsed.value)
  }

  if (!isCollaborationSessionRole(role)) {
    return {
      success: false,
      error: "role must be viewer or editor",
    }
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
  const normalizedDocumentId = parsedStrings.get("documentId")!
  const normalizedSessionId = parsedStrings.get("sessionId")!

  if (!isDocumentCollaborationRoomId(normalizedRoomId, normalizedDocumentId)) {
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
      role,
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
