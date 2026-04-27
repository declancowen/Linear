import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getSchema, type JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap"

import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"

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

const richTextSchema = getSchema(
  createRichTextBaseExtensions({
    includeCharacterCount: false,
  })
)
const currentClientVersionQuery = `protocolVersion=${COLLABORATION_PROTOCOL_VERSION}&schemaVersion=${RICH_TEXT_COLLABORATION_SCHEMA_VERSION}`

function createDocumentConnectUrl(roomId: string) {
  return `http://127.0.0.1:1999/parties/main/${roomId}?${currentClientVersionQuery}`
}

function createDocumentFlushUrl(roomId: string) {
  return `http://127.0.0.1:1999/parties/main/${roomId}?action=flush&${currentClientVersionQuery}`
}

function createDoc(contentJson: JSONContent) {
  return prosemirrorJSONToYDoc(richTextSchema, contentJson, "default")
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

  it("forwards work-item title metadata during manual collaboration flush", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Updated",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p>Updated</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1", "user_2"],
      projectScopes: [
        {
          projectId: "project_1",
          scopeType: "team",
          scopeId: "team_1",
        },
      ],
    })
    persistCollaborationWorkItemToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "work-item-main",
          contentJson,
          workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
          workItemTitle: "Updated title",
        }),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
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
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Body without title heading",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Original title",
      content: "<p>Body without title heading</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "document-title",
          documentTitle: "Retitled manually",
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(response.status).toBe(200)
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
  })

  it("accepts encoded PartyKit room ids during manual collaboration flush", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Body without title heading",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Original title",
      content: "<p>Body without title heading</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc%3Adoc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "document-title",
          documentTitle: "Retitled manually",
        }),
      }) as never,
      {
        id: "doc%3Adoc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(response.status).toBe(200)
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
  })

  it("accepts metadata-only collaboration flushes without a state vector", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Body without title heading",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Original title",
      content: "<p>Body without title heading</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "document-title",
          documentTitle: "Retitled manually",
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(response.status).toBe(200)
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
    const roomDoc = createDoc(contentJson) as ReturnType<typeof createDoc> & {
      conns?: Map<unknown, unknown>
    }
    roomDoc.conns = new Map([[Symbol("connection"), {}]])
    unstableGetYDocMock.mockResolvedValue(roomDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Original metadata title",
      content: "<p>Original body</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          contentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
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
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Canonical content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Canonical content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          contentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(response.status).toBe(200)
    expect(getCollaborationDocumentFromConvexMock).toHaveBeenCalled()
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
    expect(bumpScopedReadModelsFromConvexMock).not.toHaveBeenCalled()
  })

  it("skips unchanged manual document title flushes", async () => {
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Canonical content",
            },
          ],
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Canonical content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "document-title",
          documentTitle: "Doc",
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(response.status).toBe(200)
    expect(getCollaborationDocumentFromConvexMock).toHaveBeenCalled()
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
    expect(bumpScopedReadModelsFromConvexMock).not.toHaveBeenCalled()
  })

  it("ignores stale active client content and persists server-held room content", async () => {
    const liveRoomContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live collaborator content",
            },
          ],
        },
      ],
    }
    const staleFlushContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Stale closing-tab content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveRoomContentJson) as ReturnType<
      typeof createDoc
    > & {
      conns?: Map<unknown, unknown>
    }
    yDoc.conns = new Map([[Symbol("connection"), {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Persisted old content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1", "user_2"],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_closing",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          contentJson: staleFlushContentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
        getConnections: () => [
          {
            state: {
              kind: "doc",
              claims: {
                kind: "doc",
                sub: "user_2",
                roomId: "doc:doc_team_1",
                documentId: "doc_team_1",
                role: "editor",
                sessionId: "session_live",
                workspaceId: "workspace_1",
                exp: Math.floor(Date.now() / 1000) + 60,
              },
            },
          },
        ],
      } as never
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
    const liveRoomContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live collaborator content",
            },
          ],
        },
      ],
    }
    const teardownContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Closing tab content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveRoomContentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Live collaborator content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1", "user_2"],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_closing",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "teardown-content",
          contentJson: teardownContentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
        getConnections: () => [
          {
            state: {
              kind: "doc",
              claims: {
                kind: "doc",
                sub: "user_2",
                roomId: "doc:doc_team_1",
                documentId: "doc_team_1",
                role: "editor",
                sessionId: "session_live",
                workspaceId: "workspace_1",
                exp: Math.floor(Date.now() / 1000) + 60,
              },
            },
          },
        ],
      } as never
    )

    expect(response.status).toBe(200)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
    expect(bumpScopedReadModelsFromConvexMock).not.toHaveBeenCalled()
    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveRoomContentJson)
  })

  it("persists teardown-content flush when only viewers remain connected", async () => {
    const liveRoomContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live collaborator content",
            },
          ],
        },
      ],
    }
    const teardownContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Closing tab content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveRoomContentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Live collaborator content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1", "user_viewer"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_closing",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "teardown-content",
          contentJson: teardownContentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
        getConnections: () => [
          {
            state: {
              kind: "doc",
              claims: {
                kind: "doc",
                sub: "user_viewer",
                roomId: "doc:doc_team_1",
                documentId: "doc_team_1",
                role: "viewer",
                sessionId: "session_viewer",
                workspaceId: "workspace_1",
                exp: Math.floor(Date.now() / 1000) + 60,
              },
            },
          },
        ],
      } as never
    )

    expect(response.status).toBe(200)
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
    ).toEqual(teardownContentJson)
  })

  it("persists teardown-content flush when no other editor is connected", async () => {
    const liveRoomContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live collaborator content",
            },
          ],
        },
      ],
    }
    const teardownContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Closing tab content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveRoomContentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Live collaborator content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: ["user_1"],
      projectScopes: [],
    })
    persistCollaborationDocumentToConvexMock.mockResolvedValue({
      updatedAt: "2026-04-23T00:00:00.000Z",
    })
    bumpScopedReadModelsFromConvexMock.mockResolvedValue({
      versions: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_closing",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_team_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "teardown-content",
          contentJson: teardownContentJson,
        }),
      }) as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
        getConnections: () => [],
      } as never
    )

    expect(response.status).toBe(200)
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
    ).toEqual(teardownContentJson)
  })

  it("handles collaboration flush preflight requests", async () => {
    const { collaboration } = await import("@/services/partykit/server")

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
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_2",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          contentJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
              },
            ],
          },
        }),
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
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p></p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: false,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_2",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
      } as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    await collaboration.onClose(
      {} as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

    expect(
      persistCollaborationItemDescriptionToConvexMock
    ).not.toHaveBeenCalled()
    expect(persistCollaborationWorkItemToConvexMock).not.toHaveBeenCalled()
  })

  it("normalizes blob websocket message payloads before delegating to y-partykit", async () => {
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Doc",
            },
          ],
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

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

    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Doc</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      connection,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

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
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Canonical content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Canonical content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
      } as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    await collaboration.onClose(
      {} as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never
    )

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
    const canonicalContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Canonical content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(emptyContentJson) as ReturnType<typeof createDoc> & {
      conns?: Map<unknown, unknown>
    }
    yDoc.conns = new Map([[Symbol("connection"), {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockImplementation(async () => {
      const meta = yDoc.getMap("room-meta")
      meta.set("bootstrapDirty", true)
      meta.delete("bootstrapDirty")

      return {
        documentId: "doc_team_1",
        kind: "team-document",
        title: "Doc",
        content: "<p>Canonical content</p>",
        workspaceId: "workspace_1",
        teamId: "team_1",
        updatedAt: "2026-04-22T00:00:00.000Z",
        updatedBy: "user_1",
        canEdit: true,
        itemId: null,
        itemUpdatedAt: null,
        searchWorkspaceId: "workspace_1",
        teamMemberIds: [],
        projectScopes: [],
      }
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
      } as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(canonicalContentJson)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  })

  it("does not reseed a non-empty live room from canonical content while editors remain connected", async () => {
    const liveRoomJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live room content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveRoomJson) as ReturnType<typeof createDoc> & {
      conns?: Map<unknown, unknown>
    }
    yDoc.conns = new Map([[Symbol("connection"), {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Canonical content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
      } as never,
      {
        id: "doc:doc_team_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          CONVEX_URL: "https://convex-dev.example",
          CONVEX_SERVER_TOKEN: "server-token",
        },
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    expect(
      yDocToProsemirrorJSON(yDoc, "default") satisfies JSONContent
    ).toEqual(liveRoomJson)
    expect(persistCollaborationDocumentToConvexMock).not.toHaveBeenCalled()
  })

  it("returns 401 for invalid collaboration flush tokens", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          contentJson: {
            type: "doc",
            content: [],
          },
        }),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "collaboration_unauthenticated",
      message: "Invalid collaboration token",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("returns 401 for malformed collaboration token signatures", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: "Bearer claims.%",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
        }),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "collaboration_unauthenticated",
      message: "Invalid collaboration token",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("returns 422 for malformed collaboration flush JSON", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "not-json",
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "collaboration_invalid_payload",
      message: "Invalid collaboration flush request",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("returns 422 for malformed collaboration refresh JSON", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const refreshToken = createSignedCollaborationToken({
      kind: "internal-refresh",
      sub: "server",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      action: "refresh",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=refresh",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refreshToken}`,
            "Content-Type": "application/json",
          },
          body: "not-json",
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "collaboration_invalid_payload",
      message: "Invalid collaboration refresh request",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects stale schema versions before websocket admission", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      schemaVersion: 0,
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onBeforeConnect(
      new Request("http://127.0.0.1:1999/parties/main/doc:doc_desc_1", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response).toBeInstanceOf(Response)
    const rejectedResponse = response as Response

    expect(rejectedResponse.status).toBe(422)
    await expect(rejectedResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_schema_version_unsupported",
      reloadRequired: true,
    })
  })

  it("rejects missing client version params before websocket admission", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onBeforeConnect(
      new Request("http://127.0.0.1:1999/parties/main/doc:doc_desc_1", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response).toBeInstanceOf(Response)
    const rejectedResponse = response as Response

    expect(rejectedResponse.status).toBe(422)
    await expect(rejectedResponse.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_schema_version_required",
      reloadRequired: true,
    })
  })

  it("rejects stale schema versions on manual flush", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      schemaVersion: 0,
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
        }),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_schema_version_unsupported",
      reloadRequired: true,
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects stale client schema params on manual flush before parsing the body", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(
        `http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush&protocolVersion=${COLLABORATION_PROTOCOL_VERSION}&schemaVersion=0`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "not-json",
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_schema_version_unsupported",
      reloadRequired: true,
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects missing client schema params on manual flush before parsing the body", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "not-json",
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
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
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await expect(
      collaboration.onConnect(
        {
          addEventListener: vi.fn(),
          setState: vi.fn(),
        } as never,
        {
          id: "doc:doc_desc_1",
          env: {
            COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
            COLLABORATION_MAX_CONNECTIONS_PER_ROOM: "1",
          },
          getConnections: () => [
            {
              state: {
                kind: "doc",
                claims: {
                  role: "viewer",
                },
              },
            },
          ],
        } as never,
        {
          request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }) as never,
        }
      )
    ).rejects.toThrow("This document has too many active editors")
    expect(onConnectMock).not.toHaveBeenCalled()
  })

  it("does not emit connect_accepted when admission rejects after token preflight", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const request = new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }) as never
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
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p></p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })
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
        request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    expect(onConnectMock).toHaveBeenCalledTimes(1)
  })

  it("emits connect_accepted only after document provider handoff succeeds", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p></p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

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
        },
        getConnections: () => [],
      } as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

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
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await expect(
      collaboration.onConnect(
        {
          addEventListener: vi.fn(),
          setState: vi.fn(),
        } as never,
        {
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
        } as never,
        {
          request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }) as never,
        }
      )
    ).rejects.toThrow("This document has too many active editors")
    expect(onConnectMock).not.toHaveBeenCalled()
  })

  it("allows viewer websocket admission when only editor slots are full", async () => {
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p></p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: false,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_2",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

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
        request: new Request(createDocumentConnectUrl("doc:doc_desc_1"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
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
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
          padding: "x".repeat(100),
        }),
      }) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
          COLLABORATION_MAX_FLUSH_BODY_BYTES: "10",
        },
      } as never
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_payload_too_large",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects oversized teardown content payloads", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(createDocumentFlushUrl("doc:doc_desc_1"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
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

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "collaboration_payload_too_large",
    })
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
  })

  it("rejects oversized canonical content before seeding a room", async () => {
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Oversized canonical content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

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
          request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }) as never,
        }
      )
    ).rejects.toThrow("Collaboration document is too large")
    expect(onConnectMock).not.toHaveBeenCalled()
  })

  it("closes active room connections when a document delete refresh arrives", async () => {
    const closeMock = vi.fn()
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live content",
            },
          ],
        },
      ],
    }) as ReturnType<typeof createDoc> & {
      conns?: Map<{ close: (code?: number, reason?: string) => void }, unknown>
    }
    yDoc.conns = new Map([[{ close: closeMock }, {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValue({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Live content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

    const { collaboration } = await import("@/services/partykit/server")

    const documentToken = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const refreshToken = createSignedCollaborationToken({
      kind: "internal-refresh",
      sub: "server",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      action: "refresh",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const room = {
      id: "doc:doc_team_1",
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        CONVEX_URL: "https://convex-dev.example",
        CONVEX_SERVER_TOKEN: "server-token",
      },
      getConnections: () => [],
    }

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
        setState: vi.fn(),
      } as never,
      room as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${documentToken}`,
          },
        }) as never,
      }
    )

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=refresh",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refreshToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "document-deleted",
            documentId: "doc_team_1",
          }),
        }
      ) as never,
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
    const liveContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live room content",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveContentJson) as ReturnType<typeof createDoc> & {
      conns?: Map<{ close: (code?: number, reason?: string) => void }, unknown>
    }
    yDoc.conns = new Map([[{ close: closeMock }, {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock.mockResolvedValueOnce({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Live room content</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

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

    const { collaboration } = await import("@/services/partykit/server")

    const documentToken = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const refreshToken = createSignedCollaborationToken({
      kind: "internal-refresh",
      sub: "server",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      action: "refresh",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const room = {
      id: "doc:doc_team_1",
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        CONVEX_URL: "https://convex-dev.example",
        CONVEX_SERVER_TOKEN: "server-token",
      },
      getConnections: () => [],
    }

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
        setState: vi.fn(),
      } as never,
      room as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${documentToken}`,
          },
        }) as never,
      }
    )

    const responsePromise = collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=refresh",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refreshToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "canonical-updated",
            documentId: "doc_team_1",
          }),
        }
      ) as never,
      room as never
    )

    await fetchStarted
    yDoc.getText("race").insert(0, "edit during refresh")
    resolveRefreshFetch({
      documentId: "doc_team_1",
      kind: "team-document",
      title: "Doc",
      content: "<p>Canonical replacement</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:01.000Z",
      updatedBy: "user_2",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
      searchWorkspaceId: "workspace_1",
      teamMemberIds: [],
      projectScopes: [],
    })

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
    const liveContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Live room content",
            },
          ],
        },
      ],
    }
    const replacementContentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Canonical replacement",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(liveContentJson) as ReturnType<typeof createDoc> & {
      conns?: Map<{ close: (code?: number, reason?: string) => void }, unknown>
    }
    yDoc.conns = new Map([[{ close: closeMock }, {}]])
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getCollaborationDocumentFromConvexMock
      .mockResolvedValueOnce({
        documentId: "doc_team_1",
        kind: "team-document",
        title: "Doc",
        content: "<p>Live room content</p>",
        workspaceId: "workspace_1",
        teamId: "team_1",
        updatedAt: "2026-04-22T00:00:00.000Z",
        updatedBy: "user_1",
        canEdit: false,
        itemId: null,
        itemUpdatedAt: null,
        searchWorkspaceId: "workspace_1",
        teamMemberIds: [],
        projectScopes: [],
      })
      .mockResolvedValueOnce({
        documentId: "doc_team_1",
        kind: "team-document",
        title: "Doc",
        content: "<p>Canonical replacement</p>",
        workspaceId: "workspace_1",
        teamId: "team_1",
        updatedAt: "2026-04-22T00:00:01.000Z",
        updatedBy: "user_2",
        canEdit: false,
        itemId: null,
        itemUpdatedAt: null,
        searchWorkspaceId: "workspace_1",
        teamMemberIds: [],
        projectScopes: [],
      })

    const { collaboration } = await import("@/services/partykit/server")

    const viewerToken = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_viewer",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      role: "viewer",
      sessionId: "session_viewer",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const refreshToken = createSignedCollaborationToken({
      kind: "internal-refresh",
      sub: "server",
      roomId: "doc:doc_team_1",
      documentId: "doc_team_1",
      action: "refresh",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      exp: Math.floor(Date.now() / 1000) + 60,
    })
    const room = {
      id: "doc:doc_team_1",
      env: {
        COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        CONVEX_URL: "https://convex-dev.example",
        CONVEX_SERVER_TOKEN: "server-token",
      },
      getConnections: () => [],
    }

    await collaboration.onConnect(
      {
        addEventListener: vi.fn(),
        setState: vi.fn(),
      } as never,
      room as never,
      {
        request: new Request(createDocumentConnectUrl("doc:doc_team_1"), {
          headers: {
            Authorization: `Bearer ${viewerToken}`,
          },
        }) as never,
      }
    )

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=refresh",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refreshToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "canonical-updated",
            documentId: "doc_team_1",
          }),
        }
      ) as never,
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

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "chat",
      sub: "user_1",
      roomId: "chat:conversation_1",
      conversationId: "conversation_1",
      sessionId: "session_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

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
