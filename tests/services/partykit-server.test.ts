import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type JSONContent } from "@tiptap/core"
import { yDocToProsemirrorJSON } from "@tiptap/y-tiptap"

import { COLLABORATION_PROTOCOL_VERSION } from "@/lib/collaboration/protocol"
import {
  createAdmissionConnection,
  createCollaborationDocumentRecord,
  createChatToken,
  createDocumentConnectRequest,
  createDocumentConnection,
  createDocumentFlushUrl,
  createDocumentToken,
  createEmptyParagraphJson,
  createFlushRequest,
  createPartykitRoom,
  createRefreshRequest,
  createRefreshToken,
  createRichTextJson,
  createYDocFromRichText,
} from "@/tests/lib/fixtures/partykit"

const unstableGetYDocMock = vi.hoisted(() => vi.fn())
const onConnectMock = vi.hoisted(() => vi.fn())
const getCollaborationDocumentFromConvexMock = vi.hoisted(() => vi.fn())
const persistCollaborationDocumentToConvexMock = vi.hoisted(() => vi.fn())
const persistCollaborationItemDescriptionToConvexMock = vi.hoisted(() =>
  vi.fn()
)
const persistCollaborationWorkItemToConvexMock = vi.hoisted(() => vi.fn())
const bumpScopedReadModelsFromConvexMock = vi.hoisted(() => vi.fn())

vi.mock("y-partykit", () => ({
  onConnect: onConnectMock,
  unstable_getYDoc: unstableGetYDocMock,
}))

vi.mock("@/lib/collaboration/partykit-convex", () => ({
  getCollaborationDocumentFromConvex: getCollaborationDocumentFromConvexMock,
  persistCollaborationDocumentToConvex:
    persistCollaborationDocumentToConvexMock,
  persistCollaborationItemDescriptionToConvex:
    persistCollaborationItemDescriptionToConvexMock,
  persistCollaborationWorkItemToConvex:
    persistCollaborationWorkItemToConvexMock,
  bumpScopedReadModelsFromConvex: bumpScopedReadModelsFromConvexMock,
}))

function createDoc(contentJson: JSONContent) {
  return createYDocFromRichText(contentJson)
}

async function loadCollaboration() {
  const { collaboration } = await import("@/services/partykit/server")

  return collaboration
}

type CollaborationServer = Awaited<ReturnType<typeof loadCollaboration>>
type TestYDoc = ReturnType<typeof createDoc>

function mockYDoc(contentJson: JSONContent, connectionKeys: unknown[] = []) {
  const yDoc = createDoc(contentJson) as TestYDoc & {
    conns?: Map<unknown, unknown>
  }

  if (connectionKeys.length > 0) {
    yDoc.conns = new Map(connectionKeys.map((connection) => [connection, {}]))
  }

  unstableGetYDocMock.mockResolvedValue(yDoc)

  return yDoc
}

function mockEmptyYDoc() {
  return mockYDoc(createEmptyParagraphJson())
}

function mockCollaborationDocument(
  overrides: Parameters<typeof createCollaborationDocumentRecord>[0] = {}
) {
  getCollaborationDocumentFromConvexMock.mockResolvedValue(
    createCollaborationDocumentRecord(overrides)
  )
}

function mockItemDescriptionDocument(
  overrides: Parameters<typeof createCollaborationDocumentRecord>[0] = {}
) {
  mockCollaborationDocument({
    documentId: "doc_desc_1",
    kind: "item-description",
    title: "Item description",
    content: "<p></p>",
    itemId: "item_1",
    itemUpdatedAt: "2026-04-22T00:00:00.000Z",
    teamMemberIds: [],
    ...overrides,
  })
}

function createDocumentSocket() {
  return {
    addEventListener: vi.fn(),
    setState: vi.fn(),
  }
}

async function connectDocumentRoom(
  collaboration: CollaborationServer,
  options: {
    connection?: ReturnType<typeof createDocumentSocket>
    room?: ReturnType<typeof createPartykitRoom>
    roomId?: string
    token?: string
  } = {}
) {
  const roomId = options.roomId ?? options.room?.id ?? "doc:doc_team_1"
  const documentId = roomId.startsWith("doc:") ? roomId.slice(4) : "doc_team_1"
  const token = options.token ?? createDocumentToken({ documentId })

  await collaboration.onConnect(
    (options.connection ?? createDocumentSocket()) as never,
    (options.room ?? createPartykitRoom({ id: roomId })) as never,
    {
      request: createDocumentConnectRequest(roomId, token) as never,
    }
  )
}

function createDocumentRoomContext(roomId = "doc:doc_desc_1") {
  return createPartykitRoom({ id: roomId }) as never
}

function createDocumentRoomUrl(roomId: string, query = "") {
  return `http://127.0.0.1:1999/parties/main/${roomId}${query}`
}

function createRawDocumentRequest({
  authorization,
  body,
  method = "POST",
  roomId = "doc:doc_desc_1",
  url,
}: {
  authorization: string
  body?: unknown
  method?: string
  roomId?: string
  url?: string
}) {
  return new Request(url ?? createDocumentFlushUrl(roomId), {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  })
}

async function requestDocumentFlush(request: Request) {
  const collaboration = await loadCollaboration()

  return collaboration.onRequest(request as never, createDocumentRoomContext())
}

async function requestDocumentRefresh(request: Request) {
  const collaboration = await loadCollaboration()

  return collaboration.onRequest(request as never, createDocumentRoomContext())
}

async function expectInvalidCollaborationFlushToken(response: Response) {
  expect(response.status).toBe(401)
  await expect(response.json()).resolves.toEqual({
    ok: false,
    code: "collaboration_unauthenticated",
    message: "Invalid collaboration token",
  })
  expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
}

async function expectInvalidCollaborationPayload(
  response: Response,
  message: string
) {
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toEqual({
    ok: false,
    code: "collaboration_invalid_payload",
    message,
  })
  expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
}

async function expectUnsupportedSchemaResponse(response: Response) {
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    code: "collaboration_schema_version_unsupported",
    reloadRequired: true,
  })
  expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
}

async function expectPayloadTooLargeResponse(response: Response) {
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    code: "collaboration_payload_too_large",
  })
  expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
}

async function requestDocumentAdmission(options: {
  query?: string
  token: string
}) {
  const collaboration = await loadCollaboration()

  return collaboration.onBeforeConnect(
    new Request(createDocumentRoomUrl("doc:doc_desc_1", options.query), {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    }) as never,
    createDocumentRoomContext()
  )
}

async function expectDocumentAdmissionRejected(options: {
  code: string
  query?: string
  token: string
}) {
  const response = await requestDocumentAdmission(options)

  expect(response).toBeInstanceOf(Response)

  const rejectedResponse = response as Response

  expect(rejectedResponse.status).toBe(422)
  await expect(rejectedResponse.json()).resolves.toMatchObject({
    ok: false,
    code: options.code,
    reloadRequired: true,
  })
}

async function createViewerDocumentRoomSetup() {
  mockEmptyYDoc()
  onConnectMock.mockResolvedValue(undefined)
  mockItemDescriptionDocument({ canEdit: false })

  return {
    collaboration: await loadCollaboration(),
    token: createDocumentToken({
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      sub: "user_2",
    }),
  }
}

async function expectAdmissionLimitRejection(input: {
  env: Record<string, string | undefined>
  existingRole: "editor" | "viewer"
  token: string
}) {
  const collaboration = await loadCollaboration()

  await expect(
    collaboration.onConnect(
      createDocumentSocket() as never,
      createPartykitRoom({
        id: "doc:doc_desc_1",
        env: input.env,
        getConnections: () => [createAdmissionConnection(input.existingRole)],
      }) as never,
      {
        request: createDocumentConnectRequest(
          "doc:doc_desc_1",
          input.token
        ) as never,
      }
    )
  ).rejects.toThrow("This document has too many active editors")
  expect(onConnectMock).not.toHaveBeenCalled()
}

async function requestDocumentTitleFlush(
  options: {
    roomId?: string
    room?: ReturnType<typeof createPartykitRoom>
  } = {}
) {
  const contentJson = createRichTextJson("Body without title heading")
  mockYDoc(contentJson)
  mockCollaborationDocument({
    title: "Original title",
    content: "<p>Body without title heading</p>",
  })
  persistCollaborationDocumentToConvexMock.mockResolvedValue({
    updatedAt: "2026-04-23T00:00:00.000Z",
  })
  bumpScopedReadModelsFromConvexMock.mockResolvedValue({
    versions: [],
  })

  const collaboration = await loadCollaboration()
  const token = createDocumentToken()

  return collaboration.onRequest(
    createFlushRequest(options.roomId ?? "doc:doc_team_1", token, {
      kind: "document-title",
      documentTitle: "Retitled manually",
    }) as never,
    (options.room ?? createPartykitRoom()) as never
  )
}

function expectDocumentTitlePersisted() {
  expect(persistCollaborationDocumentToConvexMock).toHaveBeenCalledWith(
    expect.objectContaining({
      CONVEX_URL: "https://convex-dev.example",
    }),
    {
      currentUserId: "user_1",
      documentId: "doc_team_1",
      title: "Retitled manually",
    }
  )
}

async function requestUnchangedDocumentFlush(payload: {
  contentJson?: JSONContent
  documentTitle?: string
  kind: "content" | "document-title"
}) {
  const contentJson = createRichTextJson("Canonical content")
  mockYDoc(contentJson)
  mockCollaborationDocument()

  const collaboration = await loadCollaboration()
  const token = createDocumentToken()

  return collaboration.onRequest(
    createFlushRequest("doc:doc_team_1", token, payload) as never,
    createPartykitRoom() as never
  )
}

function expectNoDocumentFlushPersistence() {
  expect(getCollaborationDocumentFromConvexMock).toHaveBeenCalled()
  expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  expect(bumpScopedReadModelsFromConvexMock).not.toHaveBeenCalled()
}

async function requestTeardownContentFlush(options: {
  connections?: unknown[]
  persist?: boolean
  teamMemberIds?: string[]
}) {
  const liveRoomContentJson = createRichTextJson("Live collaborator content")
  const teardownContentJson = createRichTextJson("Closing tab content")
  const yDoc = mockYDoc(liveRoomContentJson)
  mockCollaborationDocument({
    content: "<p>Live collaborator content</p>",
    teamMemberIds: options.teamMemberIds,
  })

  if (options.persist) {
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })
  }

  const collaboration = await loadCollaboration()
  const token = createDocumentToken({ sessionId: "session_closing" })
  const response = await collaboration.onRequest(
    createFlushRequest("doc:doc_team_1", token, {
      kind: "teardown-content",
      contentJson: teardownContentJson,
    }) as never,
    createPartykitRoom({ connections: options.connections }) as never
  )

  return {
    liveRoomContentJson,
    response,
    teardownContentJson,
    yDoc,
  }
}

function expectTeardownContentPersisted(yDoc: TestYDoc, contentJson: JSONContent) {
  expect(persistCollaborationDocumentToConvexMock).toHaveBeenCalledWith(
    expect.objectContaining({
      CONVEX_URL: "https://convex-dev.example",
    }),
    expect.objectContaining({
      content: "<p>Closing tab content</p>",
    })
  )
  expect(bumpScopedReadModelsFromConvexMock).toHaveBeenCalled()
  expect(
    yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
  ).toEqual(contentJson)
}

describe("PartyKit collaboration server", () => {
  beforeEach(() => {
    unstableGetYDocMock.mockReset()
    onConnectMock.mockReset()
    getCollaborationDocumentFromConvexMock.mockReset()
    persistCollaborationDocumentToConvexMock.mockReset()
    persistCollaborationItemDescriptionToConvexMock.mockReset()
    persistCollaborationWorkItemToConvexMock.mockReset()
    bumpScopedReadModelsFromConvexMock.mockReset()

    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("loads canonical document content through the PartyKit load callback", async () => {
    const contentJson = createRichTextJson("Loaded canonical content")
    mockYDoc(createEmptyParagraphJson())
    onConnectMock.mockResolvedValue(undefined)
    mockCollaborationDocument({
      content: "<p>Loaded canonical content</p>",
    })

    const collaboration = await loadCollaboration()
    const room = createPartykitRoom({ id: "doc:doc_team_1" })

    await connectDocumentRoom(collaboration, { room })

    const { loadYPartyKitCanonicalDocument } = await import(
      "@/services/partykit/server"
    )
    const loadedDoc = await loadYPartyKitCanonicalDocument(room as never)

    expect(
      yDocToProsemirrorJSON(loadedDoc, "default") satisfies JSONContent
    ).toEqual(contentJson)
  })

  it("logs and rethrows PartyKit load failures with room context", async () => {
    const room = createPartykitRoom({ id: "doc:doc_desc_1" })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { loadYPartyKitCanonicalDocument } = await import(
      "@/services/partykit/server"
    )

    await expect(loadYPartyKitCanonicalDocument(room as never)).rejects.toThrow(
      "Missing room collaboration claims"
    )

    expect(errorSpy).toHaveBeenCalledWith(
      "[collaboration] failed to load canonical document",
      expect.objectContaining({
        documentId: "doc_desc_1",
        error: expect.any(Error),
        roomId: "doc:doc_desc_1",
        userId: null,
      })
    )
  })

  it("forwards work-item title metadata during manual collaboration flush", async () => {
    const contentJson = createRichTextJson("Updated")
    mockYDoc(contentJson)
    mockItemDescriptionDocument({
      content: "<p>Updated</p>",
      teamMemberIds: ["user_1", "user_2"],
      projectScopes: [
        { projectId: "project_1", scopeType: "team", scopeId: "team_1" },
      ],
    })
    persistCollaborationWorkItemToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_desc_1", token, {
        kind: "work-item-main",
        contentJson,
        workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
        workItemTitle: "Updated title",
      }) as never,
      createPartykitRoom({ id: "doc:doc_desc_1" }) as never
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
    expect(persistCollaborationWorkItemToConvexMock).toHaveBeenCalledWith(
      expect.objectContaining({
        CONVEX_URL: "https://convex-dev.example",
      }),
      {
        currentUserId: "user_1",
        itemId: "item_1",
        patch: {
          title: "Updated title",
          description: "<p>Updated</p>",
          expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
        },
      }
    )
    expect(bumpScopedReadModelsFromConvexMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        scopeKeys: [
          "document-detail:doc_desc_1",
          "work-item-detail:item_1",
          "work-index:team_team_1",
          "work-index:personal_user_1",
          "work-index:personal_user_2",
          "project-detail:project_1",
          "project-index:team_team_1",
          "search-seed:workspace_1",
        ],
      }
    )
  })

  it("forwards explicit document title metadata during manual collaboration flush", async () => {
    const response = await requestDocumentTitleFlush()

    expect(response.status).toBe(200)
    expectDocumentTitlePersisted()
  })

  it("accepts encoded PartyKit room ids during manual collaboration flush", async () => {
    const response = await requestDocumentTitleFlush({
      roomId: "doc%3Adoc_team_1",
      room: createPartykitRoom({ id: "doc%3Adoc_team_1" }),
    })

    expect(response.status).toBe(200)
    expectDocumentTitlePersisted()
  })

  it("accepts metadata-only collaboration flushes without a state vector", async () => {
    const response = await requestDocumentTitleFlush()

    expect(response.status).toBe(200)
    expectDocumentTitlePersisted()
  })

  it("does not derive document metadata title from collaboration body content", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            {
              type: "text",
              text: "Body heading only",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Body without metadata rename",
            },
          ],
        },
      ],
    }
    mockYDoc(contentJson, [Symbol("connection")])
    mockCollaborationDocument({
      title: "Original metadata title",
      content: "<p>Original body</p>",
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const collaboration = await loadCollaboration()

    const token = createDocumentToken()

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_team_1", token, {
        kind: "content",
        contentJson,
      }) as never,
      createPartykitRoom() as never
    )

    expect(response.status).toBe(200)
    expect(persistCollaborationDocumentToConvexMock).toHaveBeenCalledWith(
      expect.objectContaining({
        CONVEX_URL: "https://convex-dev.example",
      }),
      expect.objectContaining({
        currentUserId: "user_1",
        documentId: "doc_team_1",
        content:
          "<h1>Body heading only</h1><p>Body without metadata rename</p>",
      })
    )
  })

  it("skips unchanged manual document content flushes", async () => {
    const contentJson = createRichTextJson("Canonical content")
    const response = await requestUnchangedDocumentFlush({
      kind: "content",
      contentJson,
    })

    expect(response.status).toBe(200)
    expectNoDocumentFlushPersistence()
  })

  it("skips unchanged manual document title flushes", async () => {
    const response = await requestUnchangedDocumentFlush({
      kind: "document-title",
      documentTitle: "Doc",
    })

    expect(response.status).toBe(200)
    expectNoDocumentFlushPersistence()
  })

  it("ignores stale active client content and persists server-held room content", async () => {
    const liveRoomContentJson = createRichTextJson("Live collaborator content")
    const staleFlushContentJson = createRichTextJson(
      "Stale closing-tab content"
    )
    const yDoc = mockYDoc(liveRoomContentJson, [Symbol("connection")])
    mockCollaborationDocument({
      content: "<p>Persisted old content</p>",
      teamMemberIds: ["user_1", "user_2"],
    })

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ sessionId: "session_closing" })

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_team_1", token, {
        kind: "content",
        contentJson: staleFlushContentJson,
      }) as never,
      createPartykitRoom({ connections: [createDocumentConnection()] }) as never
    )

    expect(response.status).toBe(200)
    expect(persistCollaborationDocumentToConvexMock).toHaveBeenCalledWith(
      expect.objectContaining({
        CONVEX_URL: "https://convex-dev.example",
      }),
      expect.objectContaining({
        content: "<p>Live collaborator content</p>",
      })
    )
    expect(bumpScopedReadModelsFromConvexMock).toHaveBeenCalled()
    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveRoomContentJson)
  })

  it("skips teardown-content flush when another editor is connected", async () => {
    const { liveRoomContentJson, response, yDoc } =
      await requestTeardownContentFlush({
        connections: [createDocumentConnection()],
        teamMemberIds: ["user_1", "user_2"],
      })

    expect(response.status).toBe(200)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
    expect(bumpScopedReadModelsFromConvexMock).not.toHaveBeenCalled()
    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveRoomContentJson)
  })

  it("persists teardown-content flush when only viewers remain connected", async () => {
    const { response, teardownContentJson, yDoc } =
      await requestTeardownContentFlush({
        connections: [
          createDocumentConnection({
            role: "viewer",
            sessionId: "session_viewer",
            sub: "user_viewer",
          }),
        ],
        persist: true,
        teamMemberIds: ["user_1", "user_viewer"],
      })

    expect(response.status).toBe(200)
    expectTeardownContentPersisted(yDoc, teardownContentJson)
  })

  it("persists teardown-content flush when no other editor is connected", async () => {
    const { response, teardownContentJson, yDoc } =
      await requestTeardownContentFlush({
        persist: true,
      })

    expect(response.status).toBe(200)
    expectTeardownContentPersisted(yDoc, teardownContentJson)
  })

  it("handles collaboration flush preflight requests", async () => {
    const collaboration = await loadCollaboration()

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS"
    )
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Authorization, Content-Type"
    )
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects viewer-role manual flush requests before persisting", async () => {
    mockEmptyYDoc()

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      sub: "user_2",
    })

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_desc_1", token, {
        kind: "content",
        contentJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
            },
          ],
        },
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_forbidden",
      message: "Collaboration flush requires editor access",
    })
    expect(persistCollaborationWorkItemToConvexMock).not.toHaveBeenCalled()
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("does not attempt a last-close persist for viewer-only rooms", async () => {
    const { collaboration, token } = await createViewerDocumentRoomSetup()

    const room = createPartykitRoom({ id: "doc:doc_desc_1" })

    await connectDocumentRoom(collaboration, { room, token })

    await collaboration.onClose({} as never, room as never)

    expect(
      persistCollaborationItemDescriptionToConvexMock
    ).not.toHaveBeenCalled()
    expect(persistCollaborationWorkItemToConvexMock).not.toHaveBeenCalled()
  })

  it("normalizes blob websocket message payloads before delegating to y-partykit", async () => {
    mockYDoc(createRichTextJson("Doc"))

    let registeredMessageListener: ((payload: unknown) => void) | null = null
    const downstreamMessageListener = vi.fn()
    const connection = {
      addEventListener: vi.fn((type: string, listener: unknown) => {
        if (type === "message") {
          registeredMessageListener = listener as (payload: unknown) => void
        }
      }),
    } as never

    onConnectMock.mockImplementation(async (nextConnection) => {
      nextConnection.addEventListener("message", downstreamMessageListener)
    })

    mockCollaborationDocument({
      content: "<p>Doc</p>",
      teamMemberIds: [],
    })

    const collaboration = await loadCollaboration()

    const token = createDocumentToken()

    await collaboration.onConnect(connection, createPartykitRoom() as never, {
      request: createDocumentConnectRequest("doc:doc_team_1", token) as never,
    })

    const rawPayload = new Uint8Array([1, 2, 3]).buffer
    const messageListener = registeredMessageListener

    expect(messageListener).not.toBeNull()

    if (!messageListener) {
      throw new Error("Expected a message listener to be registered")
    }

    ;(messageListener as (payload: unknown) => void)(new Blob([rawPayload]))

    await vi.waitFor(() => {
      expect(downstreamMessageListener).toHaveBeenCalledTimes(1)
    })

    const normalizedEvent = downstreamMessageListener.mock.calls[0]?.[0] as
      | { data: ArrayBuffer }
      | undefined

    expect(normalizedEvent?.data).toBeInstanceOf(ArrayBuffer)
    expect(
      Array.from(new Uint8Array(normalizedEvent?.data ?? new ArrayBuffer(0)))
    ).toEqual([1, 2, 3])
  })

  it("does not clear room storage on last close when nothing changed", async () => {
    const contentJson = createRichTextJson("Canonical content")
    mockYDoc(contentJson)
    onConnectMock.mockResolvedValue(undefined)
    mockCollaborationDocument({ teamMemberIds: [] })

    const collaboration = await loadCollaboration()

    await connectDocumentRoom(collaboration)

    await collaboration.onClose({} as never, createPartykitRoom() as never)

    expect(getCollaborationDocumentFromConvexMock).toHaveBeenCalledTimes(1)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  })

  it("replaces canonical content instead of appending when reseeding a dirty empty room", async () => {
    const emptyContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    }
    const canonicalContentJson = createRichTextJson("Canonical content")
    const yDoc = mockYDoc(emptyContentJson, [Symbol("connection")])
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockImplementation(async () => {
      const meta = yDoc.getMap("room-meta")
      meta.set("bootstrapDirty", true)
      meta.delete("bootstrapDirty")

      return createCollaborationDocumentRecord({ teamMemberIds: [] })
    })

    const collaboration = await loadCollaboration()

    await connectDocumentRoom(collaboration)

    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(canonicalContentJson)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  })

  it("does not reseed a non-empty live room from canonical content while editors remain connected", async () => {
    const liveRoomJson = createRichTextJson("Live room content")
    const yDoc = mockYDoc(liveRoomJson, [Symbol("connection")])
    onConnectMock.mockResolvedValue(undefined)
    mockCollaborationDocument({ teamMemberIds: [] })

    const collaboration = await loadCollaboration()

    await connectDocumentRoom(collaboration)

    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveRoomJson)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  })

  it("returns 401 for invalid collaboration flush tokens", async () => {
    const response = await requestDocumentFlush(
      createRawDocumentRequest({
        authorization: "Bearer invalid-token",
        body: {
          kind: "content",
          contentJson: {
            type: "doc",
            content: [],
          },
        },
      })
    )

    await expectInvalidCollaborationFlushToken(response)
  })

  it("returns 401 for malformed collaboration token signatures", async () => {
    const response = await requestDocumentFlush(
      createRawDocumentRequest({
        authorization: "Bearer claims.%",
        body: {
          kind: "content",
        },
      })
    )

    await expectInvalidCollaborationFlushToken(response)
  })

  it("returns 422 for malformed collaboration flush JSON", async () => {
    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await requestDocumentFlush(
      createRawDocumentRequest({
        authorization: `Bearer ${token}`,
        body: "not-json",
      })
    )

    await expectInvalidCollaborationPayload(
      response,
      "Invalid collaboration flush request"
    )
  })

  it("returns 422 for malformed collaboration refresh JSON", async () => {
    const refreshToken = createRefreshToken({ documentId: "doc_desc_1" })

    const response = await requestDocumentRefresh(
      createRefreshRequest("doc:doc_desc_1", refreshToken, "not-json")
    )

    await expectInvalidCollaborationPayload(
      response,
      "Invalid collaboration refresh request"
    )
  })

  it("rejects stale schema versions before websocket admission", async () => {
    const token = createDocumentToken({
      documentId: "doc_desc_1",
      schemaVersion: 0,
    })

    await expectDocumentAdmissionRejected({
      code: "collaboration_schema_version_unsupported",
      token,
    })
  })

  it("rejects missing client version params before websocket admission", async () => {
    const token = createDocumentToken({ documentId: "doc_desc_1" })

    await expectDocumentAdmissionRejected({
      code: "collaboration_schema_version_required",
      token,
    })
  })

  it("rejects stale schema versions on manual flush", async () => {
    const token = createDocumentToken({
      documentId: "doc_desc_1",
      schemaVersion: 0,
    })

    const response = await requestDocumentFlush(
      createFlushRequest("doc:doc_desc_1", token, {
        kind: "content",
      })
    )

    await expectUnsupportedSchemaResponse(response)
  })

  it("rejects stale client schema params on manual flush before parsing the body", async () => {
    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await requestDocumentFlush(
      createRawDocumentRequest({
        authorization: `Bearer ${token}`,
        body: "not-json",
        url: createDocumentRoomUrl(
          "doc:doc_desc_1",
          `?action=flush&protocolVersion=${COLLABORATION_PROTOCOL_VERSION}&schemaVersion=0`
        ),
      })
    )

    await expectUnsupportedSchemaResponse(response)
  })

  it("rejects missing client schema params on manual flush before parsing the body", async () => {
    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await requestDocumentFlush(
      createRawDocumentRequest({
        authorization: `Bearer ${token}`,
        body: "not-json",
        url: createDocumentRoomUrl("doc:doc_desc_1", "?action=flush"),
      })
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_schema_version_required",
      reloadRequired: true,
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects document websocket admission above the total connection limit", async () => {
    mockEmptyYDoc()
    const token = createDocumentToken({
      documentId: "doc_desc_1",
      role: "viewer",
    })

    await expectAdmissionLimitRejection({
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "1",
      },
      existingRole: "viewer",
      token,
    })
  })

  it("does not emit connect_accepted when admission rejects after token preflight", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockEmptyYDoc()

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })
    const request = createDocumentConnectRequest(
      "doc:doc_desc_1",
      token
    ) as never
    const room = {
      id: "doc:doc_desc_1",
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "5",
        COLLABORATION_MAX_EDITORS_PER_ROOM: "1",
      },
      getConnections: () => [
        {
          state: {
            kind: "doc",
            claims: {
              role: "editor",
            },
          },
        },
      ],
    } as never

    await expect(collaboration.onBeforeConnect(request, room)).resolves.toBe(
      request
    )
    await expect(
      collaboration.onConnect(
        {
          addEventListener: vi.fn(),
          setState: vi.fn(),
        } as never,
        room,
        {
          request,
        }
      )
    ).rejects.toThrow("This document has too many active editors")

    expect(infoSpy).not.toHaveBeenCalledWith(
      "[collaboration]",
      expect.objectContaining({
        event: "connect_accepted",
      })
    )
    expect(warnSpy).toHaveBeenCalledWith(
      "[collaboration]",
      expect.objectContaining({
        event: "limit_rejected",
        code: "collaboration_too_many_connections",
      })
    )
    expect(errorSpy).toHaveBeenCalledWith(
      "[collaboration]",
      expect.objectContaining({
        event: "connect_rejected",
        code: "collaboration_too_many_connections",
      })
    )
    expect(onConnectMock).not.toHaveBeenCalled()
  })

  it("does not count the connecting socket twice during admission", async () => {
    mockEmptyYDoc()
    onConnectMock.mockResolvedValue(undefined)
    mockItemDescriptionDocument()

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })
    const connection = {
      addEventListener: vi.fn(),
      setState: vi.fn(),
      state: undefined,
    }

    await collaboration.onConnect(
      connection as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
          COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "1",
          COLLABORATION_MAX_EDITORS_PER_ROOM: "1",
        },
        getConnections: () => [connection],
      } as never,
      {
        request: createDocumentConnectRequest("doc:doc_desc_1", token) as never,
      }
    )

    expect(onConnectMock).toHaveBeenCalledTimes(1)
  })

  it("emits connect_accepted only after document provider handoff succeeds", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    mockEmptyYDoc()
    onConnectMock.mockResolvedValue(undefined)
    mockItemDescriptionDocument()

    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })

    await connectDocumentRoom(collaboration, {
      room: createPartykitRoom({ id: "doc:doc_desc_1" }),
      token,
    })

    expect(onConnectMock).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      "[collaboration]",
      expect.objectContaining({
        event: "connect_accepted",
        roomId: "doc:doc_desc_1",
        documentId: "doc_desc_1",
        sessionId: "session_1",
        userId: "user_1",
      })
    )
  })

  it("rejects document websocket admission above the editor limit", async () => {
    mockEmptyYDoc()
    const token = createDocumentToken({ documentId: "doc_desc_1" })

    await expectAdmissionLimitRejection({
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "5",
        COLLABORATION_MAX_EDITORS_PER_ROOM: "1",
      },
      existingRole: "editor",
      token,
    })
  })

  it("allows viewer websocket admission when only editor slots are full", async () => {
    const { collaboration, token } = await createViewerDocumentRoomSetup()

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
        setState: vi.fn(),
      } as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
          COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "5",
          COLLABORATION_MAX_EDITORS_PER_ROOM: "1",
        },
        getConnections: () => [
          {
            state: {
              kind: "doc",
              claims: {
                role: "editor",
              },
            },
          },
        ],
      } as never,
      {
        request: createDocumentConnectRequest("doc:doc_desc_1", token) as never,
      }
    )

    expect(onConnectMock).toHaveBeenCalledTimes(1)
    expect(onConnectMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        readOnly: true,
      })
    )
  })

  it("rejects oversized flush bodies before parsing", async () => {
    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_desc_1", token, {
        kind: "content",
        padding: "x".repeat(100),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          COLLABORATION_MAX_FLUSH_BODY_BYTES: "10",
        },
      } as never
    )

    await expectPayloadTooLargeResponse(response)
  })

  it("rejects oversized teardown content payloads", async () => {
    const collaboration = await loadCollaboration()

    const token = createDocumentToken({ documentId: "doc_desc_1" })

    const response = await collaboration.onRequest(
      createFlushRequest("doc:doc_desc_1", token, {
        kind: "teardown-content",
        contentJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This is larger than the configured JSON limit",
                },
              ],
            },
          ],
        },
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          COLLABORATION_MAX_FLUSH_BODY_BYTES: "10000",
          COLLABORATION_MAX_CONTENT_JSON_BYTES: "20",
        },
      } as never
    )

    await expectPayloadTooLargeResponse(response)
  })

  it("rejects oversized canonical content before seeding a room", async () => {
    mockEmptyYDoc()
    mockCollaborationDocument({
      content: "<p>Oversized canonical content</p>",
      teamMemberIds: [],
    })

    const collaboration = await loadCollaboration()

    const token = createDocumentToken()

    await expect(
      collaboration.onConnect(
        {
          addEventListener: vi.fn(),
          setState: vi.fn(),
        } as never,
        {
          id: "doc:doc_team_1",
          env: {
            COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
            CONVEX_URL: "https://convex-dev.example",
            CONVEX_SERVER_TOKEN: "server-token",
            COLLABORATION_MAX_CANONICAL_HTML_BYTES: "10",
          },
          getConnections: () => [],
        } as never,
        {
          request: createDocumentConnectRequest(
            "doc:doc_team_1",
            token
          ) as never,
        }
      )
    ).rejects.toThrow("Collaboration document is too large")
    expect(onConnectMock).not.toHaveBeenCalled()
  })

  it("closes active room connections when a document delete refresh arrives", async () => {
    const closeMock = vi.fn()
    mockYDoc(createRichTextJson("Live content"), [{ close: closeMock }])
    onConnectMock.mockResolvedValue(undefined)
    mockCollaborationDocument({
      content: "<p>Live content</p>",
      teamMemberIds: [],
    })

    const collaboration = await loadCollaboration()

    const refreshToken = createRefreshToken()
    const room = createPartykitRoom()

    await connectDocumentRoom(collaboration, { room })

    const response = await collaboration.onRequest(
      createRefreshRequest("doc:doc_team_1", refreshToken, {
        kind: "document-deleted",
        documentId: "doc_team_1",
      }) as never,
      room as never
    )

    expect(response.status).toBe(200)
    expect(closeMock).toHaveBeenCalledWith(
      4404,
      "collaboration_document_deleted"
    )
  })

  it("does not apply canonical refresh content if the room changes during fetch", async () => {
    const closeMock = vi.fn()
    const liveContentJson = createRichTextJson("Live room content")
    const yDoc = mockYDoc(liveContentJson, [{ close: closeMock }])
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValueOnce(
      createCollaborationDocumentRecord({
        content: "<p>Live room content</p>",
        teamMemberIds: [],
      })
    )

    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    let resolveRefreshFetch!: (payload: unknown) => void
    const refreshFetch = new Promise((resolve) => {
      resolveRefreshFetch = resolve
    })
    getCollaborationDocumentFromConvexMock.mockImplementationOnce(() => {
      markFetchStarted()
      return refreshFetch
    })

    const collaboration = await loadCollaboration()

    const refreshToken = createRefreshToken()
    const room = createPartykitRoom()

    await connectDocumentRoom(collaboration, { room })

    const responsePromise = collaboration.onRequest(
      createRefreshRequest("doc:doc_team_1", refreshToken, {
        kind: "canonical-updated",
        documentId: "doc_team_1",
      }) as never,
      room as never
    )

    await fetchStarted
    yDoc.getText("race").insert(0, "edit during refresh")
    resolveRefreshFetch(
      createCollaborationDocumentRecord({
        content: "<p>Canonical replacement</p>",
        updatedAt: "2026-04-22T00:00:01.000Z",
        updatedBy: "user_2",
        teamMemberIds: [],
      })
    )

    const response = await responsePromise

    expect(response.status).toBe(200)
    expect(closeMock).toHaveBeenCalledWith(
      4499,
      "collaboration_conflict_reload_required"
    )
    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveContentJson)
  })

  it("does not persist or close viewers after a server-applied canonical refresh", async () => {
    const closeMock = vi.fn()
    const liveContentJson = createRichTextJson("Live room content")
    const replacementContentJson = createRichTextJson("Canonical replacement")
    const yDoc = mockYDoc(liveContentJson, [{ close: closeMock }])
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock
      .mockResolvedValueOnce(
        createCollaborationDocumentRecord({
          content: "<p>Live room content</p>",
          canEdit: false,
          teamMemberIds: [],
        })
      )
      .mockResolvedValueOnce(
        createCollaborationDocumentRecord({
          content: "<p>Canonical replacement</p>",
          updatedAt: "2026-04-22T00:00:01.000Z",
          updatedBy: "user_2",
          canEdit: false,
          teamMemberIds: [],
        })
      )

    const collaboration = await loadCollaboration()

    const viewerToken = createDocumentToken({
      role: "viewer",
      sessionId: "session_viewer",
      sub: "user_viewer",
    })
    const refreshToken = createRefreshToken()
    const room = createPartykitRoom()

    await connectDocumentRoom(collaboration, { room, token: viewerToken })

    const response = await collaboration.onRequest(
      createRefreshRequest("doc:doc_team_1", refreshToken, {
        kind: "canonical-updated",
        documentId: "doc_team_1",
      }) as never,
      room as never
    )
    const options = unstableGetYDocMock.mock.calls.at(-1)?.[1] as {
      callback: {
        handler: (doc: typeof yDoc) => Promise<void>
      }
    }

    expect(response.status).toBe(200)
    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(replacementContentJson)
    await expect(options.callback.handler(yDoc)).resolves.toBeUndefined()
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it("broadcasts ephemeral chat typing snapshots without invoking y-partykit", async () => {
    const listeners = new Map<string, (payload: unknown) => void>()
    const connection = {
      id: "connection_1",
      state: null as unknown,
      addEventListener: vi.fn(
        (type: string, listener: (payload: unknown) => void) => {
          listeners.set(type, listener)
        }
      ),
      setState: vi.fn((nextState: unknown) => {
        connection.state = nextState
        return connection.state
      }),
    }
    const broadcastMock = vi.fn()
    const room = {
      id: "chat:conversation_1",
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
      },
      getConnections: vi.fn(() => [connection]),
      broadcast: broadcastMock,
    }

    const collaboration = await loadCollaboration()

    const token = createChatToken()

    await collaboration.onConnect(connection as never, room as never, {
      request: new Request(
        "http://127.0.0.1:1999/parties/main/chat:conversation_1",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      ) as never,
    })

    expect(onConnectMock).not.toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenLastCalledWith(
      JSON.stringify({
        type: "presence_snapshot",
        participants: [
          {
            userId: "user_1",
            sessionId: "session_1",
            typing: false,
          },
        ],
      })
    )

    listeners.get("message")?.(
      JSON.stringify({
        type: "typing",
        typing: true,
      })
    )

    expect(broadcastMock).toHaveBeenLastCalledWith(
      JSON.stringify({
        type: "presence_snapshot",
        participants: [
          {
            userId: "user_1",
            sessionId: "session_1",
            typing: true,
          },
        ],
      })
    )
  })
})
