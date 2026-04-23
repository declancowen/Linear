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
  COLLABORATION_FLUSH_PATH,
  COLLABORATION_PERSIST_DEBOUNCE_MAX_WAIT_MS,
  COLLABORATION_PERSIST_DEBOUNCE_WAIT_MS,
  COLLABORATION_XML_FRAGMENT,
} from "../../lib/collaboration/constants"
import { resolveCollaborationTokenSecret } from "../../lib/collaboration/config"
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
  parseCollaborationSessionTokenClaims,
  type ChatCollaborationSessionTokenClaims,
  type CollaborationSessionTokenClaims,
  type DocumentCollaborationSessionTokenClaims,
} from "../../lib/collaboration/transport"
import { createRichTextBaseExtensions } from "../../lib/rich-text/extensions"
import { buildCollaborationDocumentScopeKeys } from "../../lib/scoped-sync/document-scope-keys"

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

type CollaborationFlushRequest =
  | {
      kind: "content"
      contentJson: JSONContent
    }
  | {
      kind: "document-title"
      documentTitle: string
    }
  | {
      kind: "work-item-main"
      contentJson: JSONContent
      workItemExpectedUpdatedAt?: string
      workItemTitle?: string
    }

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

function closeActiveRoomConnections(doc: Doc) {
  const conns = (doc as Doc & { conns?: Map<Connection, unknown> }).conns

  if (!(conns instanceof Map)) {
    return
  }

  for (const connection of conns.keys()) {
    try {
      connection.close()
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

function base64UrlToBase64(value: string) {
  const withPadding = value.replace(/-/g, "+").replace(/_/g, "/")
  const remainder = withPadding.length % 4

  if (remainder === 0) {
    return withPadding
  }

  return `${withPadding}${"=".repeat(4 - remainder)}`
}

function decodeBase64UrlUtf8(value: string) {
  const normalized = base64UrlToBase64(value)
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function decodeBase64UrlBytes(value: string) {
  const normalized = base64UrlToBase64(value)
  const binary = atob(normalized)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function parseFlushRequest(
  request: PartyRequest
): Promise<CollaborationFlushRequest> {
  const rawBody = await request.text()

  if (!rawBody.trim()) {
    throw new Error("Invalid collaboration flush request")
  }

  const parsed = JSON.parse(rawBody) as unknown

  if (!isRecord(parsed)) {
    throw new Error("Invalid collaboration flush request")
  }

  if (parsed.kind === "document-title") {
    if (typeof parsed.documentTitle !== "string") {
      throw new Error("Invalid collaboration flush request")
    }

    return {
      kind: "document-title",
      documentTitle: parsed.documentTitle,
    }
  }

  if (parsed.kind === "content") {
    if (!isRecord(parsed.contentJson)) {
      throw new Error("Invalid collaboration flush request")
    }

    return {
      kind: "content",
      contentJson: parsed.contentJson as JSONContent,
    }
  }

  if (parsed.kind === "work-item-main") {
    if (!isRecord(parsed.contentJson)) {
      throw new Error("Invalid collaboration flush request")
    }

    if (
      typeof parsed.workItemExpectedUpdatedAt !== "undefined" &&
      typeof parsed.workItemExpectedUpdatedAt !== "string"
    ) {
      throw new Error("Invalid collaboration flush request")
    }

    if (
      typeof parsed.workItemTitle !== "undefined" &&
      typeof parsed.workItemTitle !== "string"
    ) {
      throw new Error("Invalid collaboration flush request")
    }

    return {
      kind: "work-item-main",
      contentJson: parsed.contentJson as JSONContent,
      ...(typeof parsed.workItemExpectedUpdatedAt === "string"
        ? {
            workItemExpectedUpdatedAt: parsed.workItemExpectedUpdatedAt,
          }
        : {}),
      ...(typeof parsed.workItemTitle === "string"
        ? {
            workItemTitle: parsed.workItemTitle,
          }
        : {}),
    }
  }

  throw new Error("Invalid collaboration flush request")
}

function createCollaborationFlushCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

function getCollaborationFlushErrorStatus(message: string) {
  if (message === "Document not found" || message === "Work item not found") {
    return 404
  }

  if (
    message === "You do not have permission to edit this document" ||
    message === "Collaboration flush requires editor access"
  ) {
    return 403
  }

  return 400
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  )

  return new Uint8Array(signature)
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index]! ^ right[index]!
  }

  return mismatch === 0
}

async function verifyRequestClaims(
  room: Room,
  request: PartyRequest | Request
): Promise<CollaborationSessionTokenClaims> {
  const url = new URL(request.url)
  const authorization = request.headers.get("authorization")?.trim()
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null
  const token = bearerToken || url.searchParams.get("token")?.trim()

  if (!token) {
    throw new Error("Missing collaboration token")
  }

  const [encodedClaims, providedSignature, ...rest] = token.split(".")

  if (!encodedClaims || !providedSignature || rest.length > 0) {
    throw new Error("Invalid collaboration token")
  }

  const expectedSignature = await signPayload(
    encodedClaims,
    getTokenSecret(room)
  )
  const providedSignatureBytes = decodeBase64UrlBytes(providedSignature)

  if (!timingSafeEqual(expectedSignature, providedSignatureBytes)) {
    throw new Error("Invalid collaboration token signature")
  }

  const claims = parseCollaborationSessionTokenClaims(
    JSON.parse(decodeBase64UrlUtf8(encodedClaims))
  )

  if (claims.exp * 1000 <= Date.now()) {
    throw new Error("Expired collaboration token")
  }

  const parsedRoom = parseRuntimeCollaborationRoomId(room)

  if (!parsedRoom || parsedRoom.roomId !== claims.roomId) {
    throw new Error("Collaboration room mismatch")
  }

  return claims
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
          closeActiveRoomConnections(doc)
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
  } else if (!roomMeta.dirty && !areDocumentJsonEqual(currentJson, contentJson)) {
    replaceCollaborationDocFromJson(yDoc, contentJson)
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
        req
      )
      return req
    } catch (error) {
      console.error("[collaboration] rejected websocket handshake", {
        roomId: lobby.id,
        url: req.url,
        error: error instanceof Error ? error.message : error,
      })
      return new Response(
        error instanceof Error ? error.message : "Unauthorized",
        {
          status: 401,
        }
      )
    }
  },
  async onConnect(
    connection: Connection,
    room: Room,
    context: { request: PartyRequest }
  ) {
    try {
      const claims = await verifyRequestClaims(room, context.request)
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

      const { options } = await ensureCanonicalDocumentSeeded(room, claims)

      normalizeConnectionMessageEvents(connection)

      await onConnect(connection, room, {
        ...options,
        readOnly: claims.role === "viewer",
      })
    } catch (error) {
      console.error("[collaboration] failed during room connect", {
        roomId: room.id,
        error,
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
    const isFlushRequest =
      url.searchParams.get("action") ===
      COLLABORATION_FLUSH_PATH.replace("/", "")
    const corsHeaders = createCollaborationFlushCorsHeaders()

    if (!isFlushRequest) {
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
      return new Response(
        error instanceof Error ? error.message : "Unauthorized",
        {
          status: 401,
          headers: corsHeaders,
        }
      )
    }

    if (claims.kind !== "doc") {
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders,
      })
    }

    if (claims.role !== "editor") {
      return new Response("Collaboration flush requires editor access", {
        status: 403,
        headers: corsHeaders,
      })
    }

    setRoomSessionClaims(room.id, claims)

    try {
      const flushRequest = await parseFlushRequest(req)
      const { yDoc } = await ensureCanonicalDocumentSeeded(room, claims)

      if (flushRequest.kind === "document-title") {
        await persistDocumentTitle(room, flushRequest.documentTitle)
      } else {
        applyFlushContentJson(yDoc, flushRequest.contentJson)
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

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to flush collaboration state"

      return new Response(message, {
        status: getCollaborationFlushErrorStatus(message),
        headers: corsHeaders,
      })
    }
  },
} satisfies PartyKitServer

export { collaboration }
export default collaboration
