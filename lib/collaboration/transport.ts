import {
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

function isCollaborationSessionRole(
  value: unknown
): value is CollaborationSessionRole {
  return value === "viewer" || value === "editor"
}

type CollaborationClaimKind = CollaborationSessionTokenClaims["kind"]
type ClaimParseFailure = { success: false; error: string }
type ClaimParseSuccess<T extends CollaborationSessionTokenClaims> = {
  success: true
  data: T
}
type ClaimParseResult<T extends CollaborationSessionTokenClaims> =
  | ClaimParseSuccess<T>
  | ClaimParseFailure

type NormalizedClaimFields = {
  kind: CollaborationClaimKind
  strings: Map<string, string>
  sub: string
  roomId: string
  workspaceId: string | null | undefined
  iat: number | undefined
  exp: number
}

function claimFailure(error: string): ClaimParseFailure {
  return {
    success: false,
    error,
  }
}

function claimSuccess<T extends CollaborationSessionTokenClaims>(
  data: T
): ClaimParseSuccess<T> {
  return {
    success: true,
    data,
  }
}

function parseClaimKind(
  value: unknown
): { success: true; kind: CollaborationClaimKind } | ClaimParseFailure {
  if (value === "doc" || value === "chat" || value === "internal-refresh") {
    return {
      success: true,
      kind: value,
    }
  }

  return claimFailure("kind must be doc, chat, or internal-refresh")
}

function getRequiredClaimStringFields(
  input: Record<string, unknown>,
  kind: CollaborationClaimKind
) {
  switch (kind) {
    case "doc":
      return [
        [input.sub, "sub"],
        [input.roomId, "roomId"],
        [input.documentId, "documentId"],
        [input.sessionId, "sessionId"],
      ] as const
    case "internal-refresh":
      return [
        [input.sub, "sub"],
        [input.roomId, "roomId"],
        [input.documentId, "documentId"],
      ] as const
    case "chat":
      return [
        [input.sub, "sub"],
        [input.roomId, "roomId"],
        [input.conversationId, "conversationId"],
        [input.sessionId, "sessionId"],
      ] as const
  }
}

function parseRequiredClaimStrings(
  input: Record<string, unknown>,
  kind: CollaborationClaimKind
): { success: true; strings: Map<string, string> } | ClaimParseFailure {
  const strings = new Map<string, string>()

  for (const [value, label] of getRequiredClaimStringFields(input, kind)) {
    const parsed = parseRequiredString(value, label)

    if (!parsed.success) {
      return claimFailure(parsed.error)
    }

    strings.set(label, parsed.value)
  }

  return {
    success: true,
    strings,
  }
}

function parseOptionalWorkspaceId(
  value: unknown
): { success: true; workspaceId: string | null | undefined } | ClaimParseFailure {
  if (
    typeof value !== "undefined" &&
    value !== null &&
    typeof value !== "string"
  ) {
    return claimFailure("workspaceId must be a string or null")
  }

  return {
    success: true,
    workspaceId: value,
  }
}

function parseExpiration(
  value: unknown
): { success: true; exp: number } | ClaimParseFailure {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return claimFailure("exp must be a positive integer")
  }

  return {
    success: true,
    exp: value,
  }
}

function parseCommonClaimFields(
  input: Record<string, unknown>,
  kind: CollaborationClaimKind
): { success: true; fields: NormalizedClaimFields } | ClaimParseFailure {
  const parsedStrings = parseRequiredClaimStrings(input, kind)

  if (!parsedStrings.success) {
    return parsedStrings
  }

  const workspace = parseOptionalWorkspaceId(input.workspaceId)

  if (!workspace.success) {
    return workspace
  }

  const iatError = parseOptionalNumber(input.iat, "iat")

  if (iatError) {
    return claimFailure(iatError)
  }

  const parsedExp = parseExpiration(input.exp)

  if (!parsedExp.success) {
    return parsedExp
  }

  return {
    success: true,
    fields: {
      kind,
      strings: parsedStrings.strings,
      sub: parsedStrings.strings.get("sub")!,
      roomId: parsedStrings.strings.get("roomId")!,
      workspaceId: workspace.workspaceId,
      iat: typeof input.iat === "number" ? input.iat : undefined,
      exp: parsedExp.exp,
    },
  }
}

function parseProtocolVersion(
  value: unknown
): { success: true; protocolVersion: number } | ClaimParseFailure {
  if (typeof value !== "number") {
    return claimFailure("protocolVersion is required")
  }

  if (!isSupportedCollaborationProtocolVersion(value)) {
    return claimFailure("protocolVersion is unsupported")
  }

  return {
    success: true,
    protocolVersion: value,
  }
}

function parseRichTextSchemaVersion(
  value: unknown
): { success: true; schemaVersion: number } | ClaimParseFailure {
  if (typeof value !== "number") {
    return claimFailure("schemaVersion is required")
  }

  if (!isSupportedRichTextCollaborationSchemaVersion(value)) {
    return claimFailure("schemaVersion is unsupported")
  }

  return {
    success: true,
    schemaVersion: value,
  }
}

function parseDocumentClaim(
  input: Record<string, unknown>,
  fields: NormalizedClaimFields
): ClaimParseResult<DocumentCollaborationSessionTokenClaims> {
  const documentId = fields.strings.get("documentId")!

  if (!isCollaborationSessionRole(input.role)) {
    return claimFailure("role must be viewer or editor")
  }

  const protocol = parseProtocolVersion(input.protocolVersion)

  if (!protocol.success) {
    return protocol
  }

  const schema = parseRichTextSchemaVersion(input.schemaVersion)

  if (!schema.success) {
    return schema
  }

  if (!isDocumentCollaborationRoomId(fields.roomId, documentId)) {
    return claimFailure("roomId must match the document collaboration room")
  }

  return claimSuccess({
    kind: "doc",
    sub: fields.sub,
    roomId: fields.roomId,
    documentId,
    role: input.role,
    sessionId: fields.strings.get("sessionId")!,
    workspaceId: fields.workspaceId,
    protocolVersion: protocol.protocolVersion,
    schemaVersion: schema.schemaVersion,
    iat: fields.iat,
    exp: fields.exp,
  })
}

function parseInternalRefreshClaim(
  input: Record<string, unknown>,
  fields: NormalizedClaimFields
): ClaimParseResult<InternalCollaborationRefreshTokenClaims> {
  const documentId = fields.strings.get("documentId")!

  if (fields.sub !== "server") {
    return claimFailure("sub must be server for internal refresh")
  }

  if (input.action !== "refresh") {
    return claimFailure("action must be refresh")
  }

  const protocol = parseProtocolVersion(input.protocolVersion)

  if (!protocol.success) {
    return protocol
  }

  if (!isDocumentCollaborationRoomId(fields.roomId, documentId)) {
    return claimFailure("roomId must match the document collaboration room")
  }

  return claimSuccess({
    kind: "internal-refresh",
    sub: "server",
    roomId: fields.roomId,
    documentId,
    action: "refresh",
    protocolVersion: protocol.protocolVersion,
    iat: fields.iat,
    exp: fields.exp,
  })
}

function parseChatClaim(
  fields: NormalizedClaimFields
): ClaimParseResult<ChatCollaborationSessionTokenClaims> {
  const conversationId = fields.strings.get("conversationId")!

  if (!isChatCollaborationRoomId(fields.roomId, conversationId)) {
    return claimFailure("roomId must match the chat collaboration room")
  }

  return claimSuccess({
    kind: "chat",
    sub: fields.sub,
    roomId: fields.roomId,
    conversationId,
    sessionId: fields.strings.get("sessionId")!,
    workspaceId: fields.workspaceId,
    iat: fields.iat,
    exp: fields.exp,
  })
}

function parseTypedClaim(
  input: Record<string, unknown>,
  fields: NormalizedClaimFields
): ClaimParseResult<CollaborationSessionTokenClaims> {
  switch (fields.kind) {
    case "doc":
      return parseDocumentClaim(input, fields)
    case "internal-refresh":
      return parseInternalRefreshClaim(input, fields)
    case "chat":
      return parseChatClaim(fields)
  }
}

export function safeParseCollaborationSessionTokenClaims(
  input: unknown
): ClaimParseResult<CollaborationSessionTokenClaims> {
  if (!isRecord(input)) {
    return claimFailure("collaboration token claims must be an object")
  }

  const kind = parseClaimKind(input.kind)

  if (!kind.success) {
    return kind
  }

  const common = parseCommonClaimFields(input, kind.kind)

  if (!common.success) {
    return common
  }

  return parseTypedClaim(input, common.fields)
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
