import type {
  Connection,
  Lobby,
  PartyKitServer,
  Request as PartyRequest,
  Room,
} from "partykit/server"
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from "y-partykit"
import { getSchema, type JSONContent } from "@tiptap/core"
import {
  prosemirrorJSONToYXmlFragment,
  prosemirrorJSONToYDoc,
  yDocToProsemirrorJSON,
} from "@tiptap/y-tiptap"
import type { Doc } from "yjs"

import {
  COLLABORATION_PERSIST_DEBOUNCE_MAX_WAIT_MS,
  COLLABORATION_PERSIST_DEBOUNCE_WAIT_MS,
  COLLABORATION_XML_FRAGMENT,
} from "../../lib/collaboration/constants"
import { resolveCollaborationTokenSecret } from "../../lib/collaboration/config"
import {
  createCollaborationErrorResponse,
  type CollaborationErrorCode,
} from "../../lib/collaboration/errors"
import {
  getUtf8ByteLength,
  resolveCollaborationLimits,
} from "../../lib/collaboration/limits"
import {
  createCanonicalContentJson,
  normalizeCollaborationDocumentJson,
  prepareCanonicalCollaborationContent,
} from "../../lib/collaboration/canonical-content"
import {
  bumpScopedReadModelsFromConvex,
  getCollaborationDocumentFromConvex,
  persistCollaborationDocumentToConvex,
  persistCollaborationItemDescriptionToConvex,
  persistCollaborationWorkItemToConvex,
  type CollaborationDocumentFromConvex,
} from "../../lib/collaboration/partykit-convex"
import { parseCollaborationRoomId } from "../../lib/collaboration/rooms"
import {
  type ChatCollaborationSessionTokenClaims,
  type CollaborationSessionTokenClaims,
  type DocumentCollaborationSessionTokenClaims,
  type InternalCollaborationRefreshTokenClaims,
} from "../../lib/collaboration/transport"
import { createRichTextBaseExtensions } from "../../lib/rich-text/extensions"
import { buildCollaborationDocumentScopeKeys } from "../../lib/scoped-sync/document-scope-keys"
import { assertDocumentRoomAdmission } from "./collaboration/admission"
import { verifyCollaborationRequestClaims } from "./collaboration/auth"
import {
  PartyKitCollaborationError,
  toCollaborationError,
} from "./collaboration/errors"
import { recordCollaborationEvent } from "./collaboration/observability"
import {
  createCollaborationRequestCorsHeaders,
  isCollaborationFlushRequestUrl,
  isCollaborationRefreshRequestUrl,
  parseFlushRequest,
  parseRefreshRequest,
  type CollaborationRoomRefreshRequest,
} from "./collaboration/request"

type CollaborationBootstrapPayload = CollaborationDocumentFromConvex & {
  contentJson: JSONContent
}

type CollaborationRoomStateMeta = {
  dirty: boolean
  lastCanonicalHash: string | null
  lastPersistError: string | null
}

type CollaborationRoomSessionState = {
  latestClaims: DocumentCollaborationSessionTokenClaims | null
  latestEditorClaims: DocumentCollaborationSessionTokenClaims | null
}

type ChatPresenceConnectionState = {
  kind: "chat"
  claims: ChatCollaborationSessionTokenClaims
  typing: boolean
}

type DocumentConnectionState = {
  kind: "doc"
  claims: DocumentCollaborationSessionTokenClaims
}

type ChatPresenceSnapshotParticipant = {
  userId: string
  sessionId: string
  typing: boolean
}

const richTextExtensions = createRichTextBaseExtensions({
  includeCharacterCount: false,
})
const richTextSchema = getSchema(richTextExtensions)
const roomBootstrapCache = new Map<string, CollaborationBootstrapPayload>()
const roomSessionState = new Map<string, CollaborationRoomSessionState>()
const roomStateMeta = new WeakMap<Doc, CollaborationRoomStateMeta>()
const observedRoomDocs = new WeakSet<Doc>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeRuntimeRoomId(roomId: string) {
  const trimmedRoomId = roomId.trim()

  if (!trimmedRoomId) {
    return ""
  }

  try {
    return decodeURIComponent(trimmedRoomId)
  } catch {
    return trimmedRoomId
  }
}

function getCanonicalRoomKey(room: Pick<Room, "id"> | string) {
  return normalizeRuntimeRoomId(typeof room === "string" ? room : room.id)
}

function parseRuntimeCollaborationRoomId(room: Pick<Room, "id"> | string) {
  return parseCollaborationRoomId(getCanonicalRoomKey(room))
}

function isMessageEventLike(value: unknown): value is { data: unknown } {
  return isRecord(value) && "data" in value
}

function normalizeConnectionMessageEvents(connection: Connection) {
  const patchedConnection = connection as Connection & {
    __linearMessageEventShimApplied?: boolean
  }

  if (patchedConnection.__linearMessageEventShimApplied) {
    return
  }

  const originalAddEventListener =
    typeof connection.addEventListener === "function"
      ? (connection.addEventListener.bind(connection) as (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: AddEventListenerOptions | boolean
        ) => void)
      : null

  if (!originalAddEventListener) {
    return
  }

  connection.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
    if (type !== "message") {
      return originalAddEventListener(type, listener, options)
    }

    const dispatch = (normalizedPayload: { data: unknown }) => {
      if (typeof listener === "function") {
        return listener(normalizedPayload as never)
      }

      return listener.handleEvent(normalizedPayload as never)
    }

    const wrappedListener: EventListenerOrEventListenerObject = (
      payload: unknown
    ) => {
      const data = isMessageEventLike(payload) ? payload.data : payload

      if (data instanceof Blob) {
        void data
          .arrayBuffer()
          .then((buffer) => {
            dispatch({ data: buffer })
          })
          .catch((error) => {
            console.error(
              "[collaboration] failed to normalize websocket blob payload",
              {
                error,
              }
            )
          })
        return
      }

      return dispatch(
        isMessageEventLike(payload) ? { data: payload.data } : { data }
      )
    }

    return originalAddEventListener(type, wrappedListener, options)
  }) as typeof connection.addEventListener

  patchedConnection.__linearMessageEventShimApplied = true
}

function isEmptyDocumentJson(value: JSONContent) {
  const normalized = normalizeCollaborationDocumentJson(value)

  if (normalized.type !== "doc") {
    return false
  }

  const content = Array.isArray(normalized.content) ? normalized.content : []

  if (content.length === 0) {
    return true
  }

  if (content.length !== 1) {
    return false
  }

  const onlyNode = content[0]

  if (!isRecord(onlyNode) || onlyNode.type !== "paragraph") {
    return false
  }

  const paragraphContent = Array.isArray(onlyNode.content)
    ? onlyNode.content
    : []

  return paragraphContent.length === 0
}

function isCollaborationDocEmpty(doc: Doc) {
  return isEmptyDocumentJson(
    normalizeCollaborationDocumentJson(
      yDocToProsemirrorJSON(doc, COLLABORATION_XML_FRAGMENT)
    )
  )
}

function getCollaborationFragment(doc: Doc) {
  return doc.getXmlFragment(COLLABORATION_XML_FRAGMENT)
}

function writeCollaborationDocFromJson(doc: Doc, contentJson: JSONContent) {
  prosemirrorJSONToYXmlFragment(
    richTextSchema,
    normalizeCollaborationDocumentJson(contentJson),
    getCollaborationFragment(doc)
  )
}

function replaceCollaborationDocFromJson(doc: Doc, contentJson: JSONContent) {
  const fragment = getCollaborationFragment(doc)

  if (fragment.length > 0) {
    fragment.delete(0, fragment.length)
  }

  writeCollaborationDocFromJson(doc, contentJson)
}

function getCollaborationConnectionCount(doc: Doc) {
  const conns = (doc as Doc & { conns?: Map<unknown, unknown> }).conns

  return conns instanceof Map ? conns.size : 0
}

function getDocumentJsonHash(value: JSONContent) {
  return JSON.stringify(normalizeCollaborationDocumentJson(value))
}

function areDocumentJsonEqual(left: JSONContent, right: JSONContent) {
  return getDocumentJsonHash(left) === getDocumentJsonHash(right)
}

function getRoomStateMeta(doc: Doc) {
  const existingMeta = roomStateMeta.get(doc)

  if (existingMeta) {
    return existingMeta
  }

  const nextMeta: CollaborationRoomStateMeta = {
    dirty: false,
    lastCanonicalHash: null,
    lastPersistError: null,
  }

  roomStateMeta.set(doc, nextMeta)

  return nextMeta
}

function getRoomSessionState(roomId: string) {
  const canonicalRoomId = getCanonicalRoomKey(roomId)
  const existingState = roomSessionState.get(canonicalRoomId)

  if (existingState) {
    return existingState
  }

  const nextState: CollaborationRoomSessionState = {
    latestClaims: null,
    latestEditorClaims: null,
  }

  roomSessionState.set(canonicalRoomId, nextState)

  return nextState
}

function setRoomSessionClaims(
  roomId: string,
  claims: DocumentCollaborationSessionTokenClaims
) {
  const state = getRoomSessionState(roomId)

  state.latestClaims = claims

  if (claims.role === "editor") {
    state.latestEditorClaims = claims
  }

  return state
}

function requireRoomDocumentClaims(room: Room) {
  const claims = getRoomSessionState(room.id).latestClaims

  if (!claims) {
    throw new Error("Missing room collaboration claims")
  }

  return claims
}

function isChatPresenceConnectionState(
  value: unknown
): value is ChatPresenceConnectionState {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.kind === "chat" &&
    isRecord(value.claims) &&
    value.claims.kind === "chat" &&
    typeof value.claims.sub === "string" &&
    typeof value.claims.sessionId === "string" &&
    typeof value.typing === "boolean"
  )
}

function isDocumentConnectionState(
  value: unknown
): value is DocumentConnectionState {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.kind === "doc" &&
    isRecord(value.claims) &&
    value.claims.kind === "doc" &&
    typeof value.claims.sub === "string" &&
    typeof value.claims.sessionId === "string" &&
    typeof value.claims.documentId === "string"
  )
}

function getChatPresenceSnapshot(
  room: Room
): ChatPresenceSnapshotParticipant[] {
  const participants: ChatPresenceSnapshotParticipant[] = []

  for (const connection of room.getConnections<ChatPresenceConnectionState>()) {
    const state = connection.state

    if (!isChatPresenceConnectionState(state)) {
      continue
    }

    participants.push({
      userId: state.claims.sub,
      sessionId: state.claims.sessionId,
      typing: state.typing,
    })
  }

  participants.sort((left, right) => {
    const byUserId = left.userId.localeCompare(right.userId)

    if (byUserId !== 0) {
      return byUserId
    }

    return left.sessionId.localeCompare(right.sessionId)
  })

  return participants
}

function broadcastChatPresenceSnapshot(room: Room) {
  room.broadcast(
    JSON.stringify({
      type: "presence_snapshot",
      participants: getChatPresenceSnapshot(room),
    })
  )
}

function handleChatPresenceMessage(
  message: string,
  sender: Connection,
  room: Room
) {
  const state = sender.state

  if (!isChatPresenceConnectionState(state)) {
    return
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(message)
  } catch {
    return
  }

  if (
    !isRecord(parsed) ||
    parsed.type !== "typing" ||
    typeof parsed.typing !== "boolean"
  ) {
    return
  }

  if (state.typing === parsed.typing) {
    return
  }

  sender.setState({
    ...state,
    typing: parsed.typing,
  } satisfies ChatPresenceConnectionState)
  broadcastChatPresenceSnapshot(room)
}

function requireRoomEditorClaims(room: Room) {
  const claims = getRoomSessionState(room.id).latestEditorClaims

  if (!claims) {
    throw new Error("Missing room editor collaboration claims")
  }

  return claims
}

function countOtherActiveDocumentConnections(
  room: Room,
  excludedSessionId: string
) {
  if (typeof room.getConnections !== "function") {
    return 0
  }

  let count = 0

  for (const connection of room.getConnections<DocumentConnectionState>()) {
    if (!isDocumentConnectionState(connection.state)) {
      continue
    }

    if (connection.state.claims.sessionId === excludedSessionId) {
      continue
    }

    count += 1
  }

  return count
}

function observeRoomDocument(doc: Doc) {
  if (observedRoomDocs.has(doc)) {
    return
  }

  observedRoomDocs.add(doc)
  doc.on("update", () => {
    getRoomStateMeta(doc).dirty = true
  })
  ;(
    doc as Doc & {
      on(event: "error", callback: (error: unknown) => void): void
    }
  ).on("error", (error: unknown) => {
    const meta = getRoomStateMeta(doc)
    console.error("[collaboration] yjs document error", {
      roomId: doc.guid,
      connectionCount: getCollaborationConnectionCount(doc),
      dirty: meta.dirty,
      lastCanonicalHash: meta.lastCanonicalHash,
      lastPersistError: meta.lastPersistError,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    })
  })
}

function markRoomCanonical(doc: Doc, contentJson: JSONContent) {
  const meta = getRoomStateMeta(doc)

  meta.dirty = false
  meta.lastCanonicalHash = getDocumentJsonHash(contentJson)
  meta.lastPersistError = null
}

function closeActiveRoomConnections(
  doc: Doc,
  options?: {
    code?: number
    reason?: string
  }
) {
  const conns = (doc as Doc & { conns?: Map<Connection, unknown> }).conns

  if (!(conns instanceof Map)) {
    return
  }

  for (const connection of conns.keys()) {
    try {
      connection.close(options?.code, options?.reason)
    } catch (error) {
      console.warn("[collaboration] failed to close room connection after persist error", {
        roomId: doc.guid,
        error,
      })
    }
  }
}

function getTokenSecret(room: Room) {
  const secret = resolveCollaborationTokenSecret(
    room.env as Record<string, unknown>
  )

  if (!secret) {
    throw new Error("COLLABORATION_TOKEN_SECRET is not configured")
  }

  return secret
}

function createCollaborationErrorJsonResponse(
  error: unknown,
  headers?: HeadersInit
) {
  const collaborationError = toCollaborationError(error)

  return new Response(
    JSON.stringify(
      createCollaborationErrorResponse(
        collaborationError.code,
        collaborationError.message
      )
    ),
    {
      status: collaborationError.status,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    }
  )
}

function isLimitRejectionCode(code: CollaborationErrorCode) {
  return (
    code === "collaboration_too_many_connections" ||
    code === "collaboration_payload_too_large" ||
    code === "collaboration_state_too_large"
  )
}

function recordLimitRejection(
  error: ReturnType<typeof toCollaborationError>,
  input: {
    roomId: string
    documentId?: string | null
    sessionId?: string | null
    userId?: string | null
  }
) {
  if (!isLimitRejectionCode(error.code)) {
    return
  }

  recordCollaborationEvent({
    event: "limit_rejected",
    level: "warn",
    roomId: input.roomId,
    documentId: input.documentId,
    sessionId: input.sessionId,
    userId: input.userId,
    code: error.code,
    message: error.message,
  })
}

async function verifyRequestClaims(
  room: Room,
  request: PartyRequest | Request,
  options?: {
    requireClientVersionParams?: boolean
  }
): Promise<CollaborationSessionTokenClaims> {
  return verifyCollaborationRequestClaims({
    request,
    secret: getTokenSecret(room),
    expectedRoomId: getCanonicalRoomKey(room),
    requireClientVersionParams: options?.requireClientVersionParams,
    allowLegacyClientVersionParams:
      (room.env as Record<string, unknown>)
        .COLLABORATION_ALLOW_LEGACY_SCHEMA_VERSION === "true",
  })
}

async function fetchBootstrapDocument(room: Room, currentUserId: string) {
  const parsedRoom = parseRuntimeCollaborationRoomId(room)
  const canonicalRoomId = getCanonicalRoomKey(room)

  if (!parsedRoom) {
    throw new Error("Invalid collaboration room")
  }

  const collaborationDocument = await getCollaborationDocumentFromConvex(
    room.env as Record<string, unknown>,
    {
      currentUserId,
      documentId: parsedRoom.entityId,
    }
  )

  if (collaborationDocument.kind === "private-document") {
    throw new Error("Private documents do not support collaboration sessions")
  }

  const limits = resolveCollaborationLimits(room.env as Record<string, unknown>)

  if (
    getUtf8ByteLength(collaborationDocument.content) >
    limits.maxCanonicalHtmlBytes
  ) {
    throw new PartyKitCollaborationError("collaboration_state_too_large")
  }

  const payload: CollaborationBootstrapPayload = {
    ...collaborationDocument,
    contentJson: createCanonicalContentJson(collaborationDocument.content),
  }

  roomBootstrapCache.set(canonicalRoomId, payload)

  return payload
}

async function getEditableCollaborationDocument(
  room: Room,
  claims: DocumentCollaborationSessionTokenClaims
) {
  const collaborationDocument = await getCollaborationDocumentFromConvex(
    room.env as Record<string, unknown>,
    {
      currentUserId: claims.sub,
      documentId: claims.documentId,
    }
  )

  if (collaborationDocument.kind === "private-document") {
    throw new Error("Private documents do not support collaboration sessions")
  }

  if (!collaborationDocument.canEdit) {
    throw new Error("You do not have permission to edit this document")
  }

  return collaborationDocument
}

function updateRoomBootstrapCache(
  room: Room,
  patch: Partial<CollaborationBootstrapPayload>
) {
  const cachedPayload = roomBootstrapCache.get(getCanonicalRoomKey(room))

  if (!cachedPayload) {
    return
  }

  roomBootstrapCache.set(getCanonicalRoomKey(room), {
    ...cachedPayload,
    ...patch,
  })
}

async function bumpDocumentScopeKeys(
  room: Room,
  collaborationDocument: CollaborationDocumentFromConvex,
  flushReason: "periodic" | "leave" | "manual" = "manual",
  options?: {
    includeCollectionScopes?: boolean
  }
) {
  const scopeKeys = buildCollaborationDocumentScopeKeys(
    {
      documentId: collaborationDocument.documentId,
      kind: collaborationDocument.kind,
      workspaceId: collaborationDocument.workspaceId,
      teamId: collaborationDocument.teamId,
      itemId: collaborationDocument.itemId,
      searchWorkspaceId: collaborationDocument.searchWorkspaceId,
      teamMemberIds: collaborationDocument.teamMemberIds,
      projectScopes: collaborationDocument.projectScopes,
    },
    {
      includeCollectionScopes:
        options?.includeCollectionScopes ?? flushReason !== "periodic",
    }
  )

  await bumpScopedReadModelsFromConvex(room.env as Record<string, unknown>, {
    scopeKeys,
  })
}

async function loadCanonicalDocument(
  room: Room
) {
  const payload = await fetchBootstrapDocument(
    room,
    requireRoomDocumentClaims(room).sub
  )
  const json = normalizeCollaborationDocumentJson(payload.contentJson)

  return prosemirrorJSONToYDoc(
    richTextSchema,
    json,
    COLLABORATION_XML_FRAGMENT
  )
}

async function persistCanonicalDocument(
  room: Room,
  doc: Doc,
  flushReason: "periodic" | "leave" | "manual" = "periodic",
  options?: {
    workItemExpectedUpdatedAt?: string
    workItemTitle?: string
  }
) {
  const claims = requireRoomEditorClaims(room)
  const collaborationDocument = await getEditableCollaborationDocument(
    room,
    claims
  )
  const contentJson = normalizeCollaborationDocumentJson(
    yDocToProsemirrorJSON(doc, COLLABORATION_XML_FRAGMENT)
  )
  const { contentHtml } = prepareCanonicalCollaborationContent(contentJson)
  const persistedContentJson = createCanonicalContentJson(
    collaborationDocument.content
  )
  const isPersistedContentUnchanged =
    collaborationDocument.content === contentHtml ||
    areDocumentJsonEqual(contentJson, persistedContentJson)

  if (isPersistedContentUnchanged && !options?.workItemTitle) {
    markRoomCanonical(doc, contentJson)
    updateRoomBootstrapCache(room, {
      content: contentHtml,
      contentJson,
    })
    return
  }

  if (collaborationDocument.kind === "item-description") {
    if (!collaborationDocument.itemId) {
      throw new Error("Work item not found")
    }

    if (options?.workItemTitle) {
      await persistCollaborationWorkItemToConvex(
        room.env as Record<string, unknown>,
        {
          currentUserId: claims.sub,
          itemId: collaborationDocument.itemId,
          patch: {
            title: options.workItemTitle,
            description: contentHtml,
            expectedUpdatedAt:
              options.workItemExpectedUpdatedAt ??
              collaborationDocument.itemUpdatedAt ??
              undefined,
          },
        }
      )
    } else {
      await persistCollaborationItemDescriptionToConvex(
        room.env as Record<string, unknown>,
        {
          currentUserId: claims.sub,
          itemId: collaborationDocument.itemId,
          content: contentHtml,
          expectedUpdatedAt: collaborationDocument.updatedAt,
        }
      )
    }
  } else {
    await persistCollaborationDocumentToConvex(
      room.env as Record<string, unknown>,
      {
        currentUserId: claims.sub,
        documentId: claims.documentId,
        content: contentHtml,
        expectedUpdatedAt: collaborationDocument.updatedAt,
      }
    )
  }

  await bumpDocumentScopeKeys(room, collaborationDocument, flushReason)

  markRoomCanonical(doc, contentJson)

  updateRoomBootstrapCache(room, {
    content: contentHtml,
    contentJson,
  })
}

async function persistDocumentTitle(
  room: Room,
  documentTitle: string
) {
  const claims = requireRoomEditorClaims(room)
  const collaborationDocument = await getEditableCollaborationDocument(
    room,
    claims
  )

  if (collaborationDocument.kind === "item-description") {
    throw new Error("Document title flush is not supported for item descriptions")
  }

  if (documentTitle === collaborationDocument.title) {
    updateRoomBootstrapCache(room, {
      title: documentTitle,
    })
    return
  }

  await persistCollaborationDocumentToConvex(
    room.env as Record<string, unknown>,
    {
      currentUserId: claims.sub,
      documentId: claims.documentId,
      title: documentTitle,
    }
  )

  await bumpDocumentScopeKeys(room, collaborationDocument, "manual", {
    includeCollectionScopes: true,
  })

  updateRoomBootstrapCache(room, {
    title: documentTitle,
  })
}

function applyFlushContentJson(doc: Doc, contentJson: JSONContent) {
  replaceCollaborationDocFromJson(
    doc,
    normalizeCollaborationDocumentJson(contentJson)
  )
}

async function getActiveRoomDocument(room: Room) {
  const claims = getRoomSessionState(room.id).latestClaims

  if (!claims) {
    return null
  }

  const yDoc = await unstable_getYDoc(room, createYPartyKitOptions(room))
  observeRoomDocument(yDoc)

  return {
    claims,
    yDoc,
  }
}

async function handleRefreshRequest(
  room: Room,
  claims: InternalCollaborationRefreshTokenClaims,
  refreshRequest: CollaborationRoomRefreshRequest
) {
  const parsedRoom = parseRuntimeCollaborationRoomId(room)

  if (
    !parsedRoom ||
    parsedRoom.kind !== "doc" ||
    parsedRoom.entityId !== claims.documentId ||
    refreshRequest.documentId !== claims.documentId
  ) {
    throw new PartyKitCollaborationError("collaboration_room_mismatch")
  }

  recordCollaborationEvent({
    event: "refresh_received",
    roomId: room.id,
    documentId: claims.documentId,
    code: refreshRequest.kind,
  })

  const activeRoom = await getActiveRoomDocument(room)

  if (!activeRoom) {
    return
  }

  if (refreshRequest.kind === "document-deleted") {
    closeActiveRoomConnections(activeRoom.yDoc, {
      code: 4404,
      reason: "collaboration_document_deleted",
    })
    recordCollaborationEvent({
      event: "room_closed",
      level: "warn",
      roomId: room.id,
      documentId: claims.documentId,
      code: "collaboration_document_deleted",
    })
    return
  }

  if (refreshRequest.kind === "access-changed") {
    closeActiveRoomConnections(activeRoom.yDoc, {
      code: 4403,
      reason: "collaboration_access_revoked",
    })
    recordCollaborationEvent({
      event: "room_closed",
      level: "warn",
      roomId: room.id,
      documentId: claims.documentId,
      code: "collaboration_access_revoked",
    })
    return
  }

  const roomMeta = getRoomStateMeta(activeRoom.yDoc)

  if (roomMeta.dirty) {
    closeActiveRoomConnections(activeRoom.yDoc, {
      code: 4499,
      reason: "collaboration_conflict_reload_required",
    })
    recordCollaborationEvent({
      event: "refresh_conflict",
      level: "warn",
      roomId: room.id,
      documentId: claims.documentId,
      code: "collaboration_conflict_reload_required",
    })
    return
  }

  const payload = await fetchBootstrapDocument(room, activeRoom.claims.sub)
  const contentJson = normalizeCollaborationDocumentJson(payload.contentJson)

  replaceCollaborationDocFromJson(activeRoom.yDoc, contentJson)
  markRoomCanonical(activeRoom.yDoc, contentJson)
  recordCollaborationEvent({
    event: "refresh_applied",
    roomId: room.id,
    documentId: claims.documentId,
  })
}

function createYPartyKitOptions(room: Room): YPartyKitOptions {
  return {
    gc: false,
    persist: {
      mode: "history",
    },
    load: async () => {
      try {
        return await loadCanonicalDocument(room)
      } catch (error) {
        console.error("[collaboration] failed to load canonical document", {
          roomId: room.id,
          documentId: parseRuntimeCollaborationRoomId(room)?.entityId ?? null,
          userId: getRoomSessionState(room.id).latestClaims?.sub ?? null,
          error,
        })
        throw error
      }
    },
    callback: {
      debounceWait: COLLABORATION_PERSIST_DEBOUNCE_WAIT_MS,
      debounceMaxWait: COLLABORATION_PERSIST_DEBOUNCE_MAX_WAIT_MS,
      handler: async (doc) => {
        try {
          await persistCanonicalDocument(room, doc, "periodic")
        } catch (error) {
          const roomMeta = getRoomStateMeta(doc)
          roomMeta.lastPersistError =
            error instanceof Error
              ? error.message
              : "Failed to persist collaboration document"
          console.error("[collaboration] failed to persist canonical document", {
            roomId: room.id,
            documentId: parseRuntimeCollaborationRoomId(room)?.entityId ?? null,
            userId: getRoomSessionState(room.id).latestEditorClaims?.sub ?? null,
            error,
          })
          closeActiveRoomConnections(doc, {
            code: 1011,
            reason: "collaboration_persist_failed",
          })
          throw error
        }
      },
    },
  }
}

async function ensureCanonicalDocumentSeeded(
  room: Room,
  claims: DocumentCollaborationSessionTokenClaims
) {
  setRoomSessionClaims(room.id, claims)
  const options = createYPartyKitOptions(room)
  const yDoc = await unstable_getYDoc(room, options)
  observeRoomDocument(yDoc)
  const hasActiveConnections = getCollaborationConnectionCount(yDoc) > 0
  const payload = await fetchBootstrapDocument(room, claims.sub)
  const contentJson = normalizeCollaborationDocumentJson(payload.contentJson)
  const currentJson = normalizeCollaborationDocumentJson(
    yDocToProsemirrorJSON(yDoc, COLLABORATION_XML_FRAGMENT)
  )
  const roomMeta = getRoomStateMeta(yDoc)

  if (!hasActiveConnections) {
    if (!areDocumentJsonEqual(currentJson, contentJson)) {
      replaceCollaborationDocFromJson(yDoc, contentJson)
    }

    markRoomCanonical(yDoc, contentJson)
  } else if (!isEmptyDocumentJson(contentJson) && isCollaborationDocEmpty(yDoc)) {
    replaceCollaborationDocFromJson(yDoc, contentJson)
    markRoomCanonical(yDoc, contentJson)
  }

  return {
    options,
    yDoc,
  }
}

const collaboration = {
  async onBeforeConnect(req: PartyRequest, lobby: Lobby) {
    try {
      await verifyRequestClaims(
        {
          id: lobby.id,
          env: lobby.env,
        } as Room,
        req,
        {
          requireClientVersionParams: true,
        }
      )
      recordCollaborationEvent({
        event: "connect_accepted",
        roomId: lobby.id,
      })
      return req
    } catch (error) {
      const collaborationError = toCollaborationError(error)
      recordCollaborationEvent({
        event: "connect_rejected",
        level: "warn",
        roomId: lobby.id,
        code: collaborationError.code,
        message: collaborationError.message,
      })
      return createCollaborationErrorJsonResponse(error)
    }
  },
  async onConnect(
    connection: Connection,
    room: Room,
    context: { request: PartyRequest }
  ) {
    try {
      const claims = await verifyRequestClaims(room, context.request, {
        requireClientVersionParams: true,
      })
      const parsedRoom = parseRuntimeCollaborationRoomId(room)

      if (!parsedRoom) {
        throw new Error("Invalid collaboration room")
      }

      if (parsedRoom.kind === "chat") {
        if (claims.kind !== "chat") {
          throw new Error("Collaboration room mismatch")
        }

        connection.setState({
          kind: "chat",
          claims,
          typing: false,
        } satisfies ChatPresenceConnectionState)
        connection.addEventListener("message", (event: unknown) => {
          const payload = isMessageEventLike(event) ? event.data : event

          if (typeof payload !== "string") {
            return
          }

          handleChatPresenceMessage(payload, connection, room)
        })
        broadcastChatPresenceSnapshot(room)
        return
      }

      if (claims.kind !== "doc") {
        throw new Error("Collaboration room mismatch")
      }

      assertDocumentRoomAdmission(
        room,
        resolveCollaborationLimits(room.env as Record<string, unknown>),
        connection
      )

      if (typeof connection.setState === "function") {
        connection.setState({
          kind: "doc",
          claims,
        } satisfies DocumentConnectionState)
      }

      const { options } = await ensureCanonicalDocumentSeeded(room, claims)
      recordCollaborationEvent({
        event: "room_seeded",
        roomId: room.id,
        documentId: claims.documentId,
        sessionId: claims.sessionId,
        userId: claims.sub,
      })

      normalizeConnectionMessageEvents(connection)

      await onConnect(connection, room, {
        ...options,
        readOnly: claims.role === "viewer",
      })
    } catch (error) {
      const collaborationError = toCollaborationError(error)
      recordLimitRejection(collaborationError, {
        roomId: room.id,
        documentId:
          getRoomSessionState(room.id).latestClaims?.documentId ??
          parseRuntimeCollaborationRoomId(room)?.entityId ??
          null,
        sessionId: getRoomSessionState(room.id).latestClaims?.sessionId ?? null,
        userId: getRoomSessionState(room.id).latestClaims?.sub ?? null,
      })
      recordCollaborationEvent({
        event: "connect_rejected",
        level: "error",
        roomId: room.id,
        code: collaborationError.code,
        message: collaborationError.message,
      })
      throw error
    }
  },
  async onClose(_connection: Connection, room: Room) {
    const parsedRoom = parseRuntimeCollaborationRoomId(room)

    if (parsedRoom?.kind === "chat") {
      broadcastChatPresenceSnapshot(room)
      return
    }

    const yDoc = await unstable_getYDoc(room, createYPartyKitOptions(room))
    const isLastConnection = getCollaborationConnectionCount(yDoc) === 0

    if (!isLastConnection) {
      return
    }

    try {
      const claims = getRoomSessionState(room.id).latestEditorClaims

      if (!claims) {
        return
      }
      const roomMeta = getRoomStateMeta(yDoc)

      if (!roomMeta.dirty) {
        return
      }

      await persistCanonicalDocument(room, yDoc, "leave")
    } catch (error) {
      console.error("[collaboration] failed to persist room on last close", {
        roomId: room.id,
        documentId: parseRuntimeCollaborationRoomId(room)?.entityId ?? null,
        userId: getRoomSessionState(room.id).latestEditorClaims?.sub ?? null,
        error,
      })
    } finally {
      roomBootstrapCache.delete(getCanonicalRoomKey(room))
      roomSessionState.delete(getCanonicalRoomKey(room))
    }
  },
  async onRequest(req: PartyRequest, room: Room) {
    const url = new URL(req.url)
    const isFlushRequest = isCollaborationFlushRequestUrl(url)
    const isRefreshRequest = isCollaborationRefreshRequestUrl(url)
    const corsHeaders = createCollaborationRequestCorsHeaders()

    if (!isFlushRequest && !isRefreshRequest) {
      return new Response("Not found", { status: 404 })
    }

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    if (req.method !== "POST") {
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders,
      })
    }

    let claims: CollaborationSessionTokenClaims

    try {
      claims = await verifyRequestClaims(room, req)
    } catch (error) {
      return createCollaborationErrorJsonResponse(error, corsHeaders)
    }

    if (isRefreshRequest) {
      if (claims.kind !== "internal-refresh") {
        return createCollaborationErrorJsonResponse(
          new PartyKitCollaborationError("collaboration_forbidden"),
          corsHeaders
        )
      }

      try {
        await handleRefreshRequest(room, claims, await parseRefreshRequest(req))

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        })
      } catch (error) {
        return createCollaborationErrorJsonResponse(error, corsHeaders)
      }
    }

    if (claims.kind !== "doc") {
      return createCollaborationErrorJsonResponse(
        new PartyKitCollaborationError("collaboration_forbidden"),
        corsHeaders
      )
    }

    if (claims.role !== "editor") {
      return createCollaborationErrorJsonResponse(
        new PartyKitCollaborationError(
          "collaboration_forbidden",
          "Collaboration flush requires editor access"
        ),
        corsHeaders
      )
    }

    setRoomSessionClaims(room.id, claims)

    try {
      const startedAt = Date.now()
      recordCollaborationEvent({
        event: "flush_started",
        roomId: room.id,
        documentId: claims.documentId,
        sessionId: claims.sessionId,
        userId: claims.sub,
      })
      const flushRequest = await parseFlushRequest(
        req,
        resolveCollaborationLimits(room.env as Record<string, unknown>)
      )
      const { yDoc } = await ensureCanonicalDocumentSeeded(room, claims)

      if (flushRequest.kind === "document-title") {
        await persistDocumentTitle(room, flushRequest.documentTitle)
      } else if (flushRequest.kind === "teardown-content") {
        const hasOtherActiveConnections =
          countOtherActiveDocumentConnections(room, claims.sessionId) > 0

        if (hasOtherActiveConnections) {
          console.warn(
            "[collaboration] skipped teardown flush because other editors remain",
            {
              roomId: room.id,
              documentId: claims.documentId,
              sessionId: claims.sessionId,
            }
          )
          recordCollaborationEvent({
            event: "teardown_flush_skipped",
            level: "warn",
            roomId: room.id,
            documentId: claims.documentId,
            sessionId: claims.sessionId,
            userId: claims.sub,
          })
        } else {
          applyFlushContentJson(yDoc, flushRequest.contentJson)
          await persistCanonicalDocument(room, yDoc, "manual")
        }
      } else {
        await persistCanonicalDocument(room, yDoc, "manual", {
          ...(flushRequest.kind === "work-item-main"
            ? {
                workItemExpectedUpdatedAt:
                  flushRequest.workItemExpectedUpdatedAt,
                workItemTitle: flushRequest.workItemTitle,
              }
            : {}),
        })
      }

      recordCollaborationEvent({
        event: "flush_succeeded",
        roomId: room.id,
        documentId: claims.documentId,
        sessionId: claims.sessionId,
        userId: claims.sub,
        durationMs: Date.now() - startedAt,
      })

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    } catch (error) {
      const collaborationError = toCollaborationError(error)
      recordLimitRejection(collaborationError, {
        roomId: room.id,
        documentId: claims.documentId,
        sessionId: claims.sessionId,
        userId: claims.sub,
      })
      recordCollaborationEvent({
        event: "flush_failed",
        level: "error",
        roomId: room.id,
        documentId: claims.documentId,
        sessionId: claims.sessionId,
        userId: claims.sub,
        code: collaborationError.code,
        message: collaborationError.message,
      })
      return createCollaborationErrorJsonResponse(error, corsHeaders)
    }
  },
} satisfies PartyKitServer

export { collaboration }
export default collaboration
