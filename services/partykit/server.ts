import type {
  Connection,
  Lobby,
  PartyKitServer,
  Request as PartyRequest,
  Room,
} from "partykit/server"
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from "y-partykit"
import {
  clearRange,
  getLevelKeyRangeAsEncoded,
  YPartyKitStorage,
} from "y-partykit/storage"
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
import {
  decodeDocumentStateVector,
  doesStateVectorDominate,
  getDocumentStateVector,
} from "../../lib/collaboration/state-vectors"
import {
  resolveCollaborationAppOrigin,
  resolveCollaborationInternalSecret,
  resolveCollaborationTokenSecret,
} from "../../lib/collaboration/config"
import { parseCollaborationRoomId } from "../../lib/collaboration/rooms"
import {
  parseCollaborationSessionTokenClaims,
  type CollaborationSessionTokenClaims,
} from "../../lib/collaboration/transport"
import { createRichTextBaseExtensions } from "../../lib/rich-text/extensions"

type CollaborationBootstrapPayload = {
  documentId: string
  kind: "team-document" | "workspace-document" | "private-document" | "item-description"
  itemId: string | null
  title: string
  contentHtml: string
  contentJson?: JSONContent
}

type CollaborationRoomStateMeta = {
  dirty: boolean
  lastCanonicalHash: string | null
  lastPersistError: string | null
}

type CollaborationRoomSessionState = {
  latestClaims: CollaborationSessionTokenClaims | null
  latestEditorClaims: CollaborationSessionTokenClaims | null
}

const richTextExtensions = createRichTextBaseExtensions({
  includeCharacterCount: false,
})
const richTextSchema = getSchema(richTextExtensions)
const roomBootstrapCache = new Map<string, CollaborationBootstrapPayload>()
const roomSessionState = new Map<string, CollaborationRoomSessionState>()
const roomStateMeta = new WeakMap<Doc, CollaborationRoomStateMeta>()
const observedRoomDocs = new WeakSet<Doc>()
const EMPTY_DOCUMENT_JSON: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
}

const COLLABORATION_FLUSH_FENCE_TIMEOUT_MS = 5_000
const COLLABORATION_FLUSH_FENCE_POLL_MS = 25

type CollaborationFlushRequest = {
  expectedStateVector: Map<number, number> | null
  workItemExpectedUpdatedAt?: string
  workItemTitle?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeDocumentJson(value: unknown): JSONContent {
  if (isRecord(value) && typeof value.type === "string") {
    return value as JSONContent
  }

  return EMPTY_DOCUMENT_JSON
}

function isEmptyDocumentJson(value: JSONContent) {
  const normalized = normalizeDocumentJson(value)

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
    normalizeDocumentJson(
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
    normalizeDocumentJson(contentJson),
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
  return JSON.stringify(normalizeDocumentJson(value))
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
  const existingState = roomSessionState.get(roomId)

  if (existingState) {
    return existingState
  }

  const nextState: CollaborationRoomSessionState = {
    latestClaims: null,
    latestEditorClaims: null,
  }

  roomSessionState.set(roomId, nextState)

  return nextState
}

function setRoomSessionClaims(
  roomId: string,
  claims: CollaborationSessionTokenClaims
) {
  const state = getRoomSessionState(roomId)

  state.latestClaims = claims

  if (claims.role === "editor") {
    state.latestEditorClaims = claims
  }

  return state
}

function requireRoomClaims(room: Room) {
  const claims = getRoomSessionState(room.id).latestClaims

  if (!claims) {
    throw new Error("Missing room collaboration claims")
  }

  return claims
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

function getAppOrigin(room: Room) {
  const explicitOrigin = resolveCollaborationAppOrigin(
    room.env as Record<string, unknown>
  )

  if (!explicitOrigin) {
    throw new Error("COLLABORATION_APP_ORIGIN is not configured")
  }

  return explicitOrigin.replace(/\/$/, "")
}

function getInternalSecret(room: Room) {
  const secret = resolveCollaborationInternalSecret(
    room.env as Record<string, unknown>
  )

  if (!secret) {
    throw new Error("COLLABORATION_INTERNAL_SECRET is not configured")
  }

  return secret
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

async function waitForRoomStateVector(
  doc: Doc,
  expectedStateVector: Map<number, number>
) {
  const deadline = Date.now() + COLLABORATION_FLUSH_FENCE_TIMEOUT_MS

  while (Date.now() <= deadline) {
    if (
      doesStateVectorDominate(
        getDocumentStateVector(doc),
        expectedStateVector
      )
    ) {
      return
    }

    await new Promise((resolve) => {
      setTimeout(resolve, COLLABORATION_FLUSH_FENCE_POLL_MS)
    })
  }

  throw new Error("Timed out waiting for collaboration room to receive local updates")
}

async function parseFlushRequest(
  request: PartyRequest
): Promise<CollaborationFlushRequest> {
  const rawBody = await request.text()

  if (!rawBody.trim()) {
    return {
      expectedStateVector: null,
    }
  }

  const parsed = JSON.parse(rawBody) as unknown

  if (!isRecord(parsed) || typeof parsed.stateVector !== "string") {
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
    expectedStateVector: decodeDocumentStateVector(parsed.stateVector),
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

  const parsedRoom = parseCollaborationRoomId(room.id)

  if (!parsedRoom || parsedRoom.roomId !== claims.roomId) {
    throw new Error("Collaboration room mismatch")
  }

  return claims
}

async function fetchBootstrapDocument(room: Room, currentUserId: string) {
  const response = await fetch(
    `${getAppOrigin(room)}/api/internal/collaboration/documents/${parseCollaborationRoomId(room.id)?.entityId ?? ""}/bootstrap?currentUserId=${encodeURIComponent(currentUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${getInternalSecret(room)}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to bootstrap collaboration document (${response.status})`
    )
  }

  const payload = (await response.json()) as CollaborationBootstrapPayload

  roomBootstrapCache.set(room.id, payload)

  return payload
}

async function clearPersistedRoomState(room: Room) {
  await Promise.all([
    clearRange(
      room.storage,
      ["v1", room.id, "update", 0],
      ["v1", room.id, "update", Number.MAX_SAFE_INTEGER]
    ),
    clearRange(
      room.storage,
      ["v1_sv", room.id],
      ["v1_sv", `${room.id}\uffff`]
    ),
  ])
}

async function hasPersistedRoomUpdates(room: Room) {
  const persistedKeys = await getLevelKeyRangeAsEncoded(room.storage, {
    gte: ["v1", room.id, "update", 0],
    lt: ["v1", room.id, "update", Number.MAX_SAFE_INTEGER],
  })

  return persistedKeys.length > 0
}

async function loadCanonicalDocument(
  room: Room
) {
  await clearPersistedRoomState(room)
  const payload = await fetchBootstrapDocument(room, requireRoomClaims(room).sub)
  const json = normalizeDocumentJson(payload.contentJson)

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
  const contentJson = normalizeDocumentJson(
    yDocToProsemirrorJSON(doc, COLLABORATION_XML_FRAGMENT)
  )

  const response = await fetch(
    `${getAppOrigin(room)}/api/internal/collaboration/documents/${claims.documentId}/persist`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getInternalSecret(room)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentUserId: claims.sub,
        contentJson,
        flushReason,
        ...(options?.workItemExpectedUpdatedAt
          ? {
              workItemExpectedUpdatedAt: options.workItemExpectedUpdatedAt,
            }
          : {}),
        ...(options?.workItemTitle
          ? {
              workItemTitle: options.workItemTitle,
            }
          : {}),
      }),
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to persist collaboration document (${response.status})`
    )
  }

  markRoomCanonical(doc, contentJson)

  const cachedPayload = roomBootstrapCache.get(room.id)

  if (cachedPayload) {
    roomBootstrapCache.set(room.id, {
      ...cachedPayload,
      contentJson,
    })
  }
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
          documentId: parseCollaborationRoomId(room.id)?.entityId ?? null,
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
            documentId: parseCollaborationRoomId(room.id)?.entityId ?? null,
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
  claims: CollaborationSessionTokenClaims
) {
  setRoomSessionClaims(room.id, claims)
  const options = createYPartyKitOptions(room)
  const yDoc = await unstable_getYDoc(room, options)
  observeRoomDocument(yDoc)
  const hasActiveConnections = getCollaborationConnectionCount(yDoc) > 0
  const payload = await fetchBootstrapDocument(room, claims.sub)
  const contentJson = normalizeDocumentJson(payload.contentJson)
  const currentJson = normalizeDocumentJson(
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
    writeCollaborationDocFromJson(yDoc, contentJson)
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
      const { options } = await ensureCanonicalDocumentSeeded(room, claims)

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
    const yDoc = await unstable_getYDoc(room, createYPartyKitOptions(room))
    const isLastConnection = getCollaborationConnectionCount(yDoc) === 0

    if (!isLastConnection) {
      return
    }

    try {
      const claims = getRoomSessionState(room.id).latestClaims

      if (!claims) {
        return
      }

      if (!(await hasPersistedRoomUpdates(room))) {
        return
      }

      await persistCanonicalDocument(room, yDoc, "leave")
      await clearPersistedRoomState(room)
    } catch (error) {
      console.error("[collaboration] failed to persist room on last close", {
        roomId: room.id,
        documentId: parseCollaborationRoomId(room.id)?.entityId ?? null,
        userId: getRoomSessionState(room.id).latestEditorClaims?.sub ?? null,
        error,
      })
    } finally {
      roomBootstrapCache.delete(room.id)
      roomSessionState.delete(room.id)
    }
  },
  async onRequest(req: PartyRequest, room: Room) {
    const claims = await verifyRequestClaims(room, req)
    setRoomSessionClaims(room.id, claims)
    const url = new URL(req.url)

    if (
      req.method !== "POST" ||
      url.searchParams.get("action") !== COLLABORATION_FLUSH_PATH.replace("/", "")
    ) {
      return new Response("Not found", { status: 404 })
    }

    try {
      const flushRequest = await parseFlushRequest(req)
      const { yDoc } = await ensureCanonicalDocumentSeeded(room, claims)

      if (flushRequest.expectedStateVector) {
        await waitForRoomStateVector(yDoc, flushRequest.expectedStateVector)
      }

      await persistCanonicalDocument(room, yDoc, "manual", {
        workItemExpectedUpdatedAt: flushRequest.workItemExpectedUpdatedAt,
        workItemTitle: flushRequest.workItemTitle,
      })

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to flush collaboration state"

      return new Response(message, {
        status:
          message === "Timed out waiting for collaboration room to receive local updates"
            ? 409
            : 400,
      })
    }
  },
} satisfies PartyKitServer

export { collaboration }
export default collaboration
