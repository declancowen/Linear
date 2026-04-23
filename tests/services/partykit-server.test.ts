import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getSchema, type JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap"

import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"

const unstableGetYDocMock = vi.hoisted(() => vi.fn())
const onConnectMock = vi.hoisted(() => vi.fn())
const getCollaborationDocumentFromConvexMock = vi.hoisted(() => vi.fn())
const persistCollaborationDocumentToConvexMock = vi.hoisted(() => vi.fn())
const persistCollaborationItemDescriptionToConvexMock = vi.hoisted(() => vi.fn())
const persistCollaborationWorkItemToConvexMock = vi.hoisted(() => vi.fn())
const bumpScopedReadModelsFromConvexMock = vi.hoisted(() => vi.fn())

vi.mock("y-partykit", () => ({
  onConnect: onConnectMock,
  unstable_getYDoc: unstableGetYDocMock,
}))

vi.mock("@/lib/collaboration/partykit-convex", () => ({
  getCollaborationDocumentFromConvex: getCollaborationDocumentFromConvexMock,
  persistCollaborationDocumentToConvex: persistCollaborationDocumentToConvexMock,
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
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
        }
      ) as never,
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "document-title",
            documentTitle: "Retitled manually",
          }),
        }
      ) as never,
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc%3Adoc_team_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "document-title",
            documentTitle: "Retitled manually",
          }),
        }
      ) as never,
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "document-title",
            documentTitle: "Retitled manually",
          }),
        }
      ) as never,
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
    const roomDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Original body",
            },
          ],
        },
      ],
    })
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_team_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "content",
            contentJson,
          }),
        }
      ) as never,
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
        content: "<h1>Body heading only</h1><p>Body without metadata rename</p>",
      })
    )
  })

  it("handles collaboration flush preflight requests", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
          },
        }
      ) as never,
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
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
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
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toBe(
      "Collaboration flush requires editor access"
    )
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
        request: new Request("http://127.0.0.1:1999/parties/main/doc:doc_desc_1", {
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

    expect(persistCollaborationItemDescriptionToConvexMock).not.toHaveBeenCalled()
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
        request: new Request("http://127.0.0.1:1999/parties/main/doc:doc_team_1", {
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
    expect(Array.from(new Uint8Array(normalizedEvent?.data ?? new ArrayBuffer(0)))).toEqual([1, 2, 3])
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
        request: new Request("http://127.0.0.1:1999/parties/main/doc:doc_team_1", {
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
        request: new Request("http://127.0.0.1:1999/parties/main/doc:doc_team_1", {
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

  it("returns 401 for invalid collaboration flush tokens", async () => {
    const { collaboration } = await import("@/services/partykit/server")

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
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
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: {
          COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
        },
      } as never
    )

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe(
      "Invalid collaboration token"
    )
    expect(getCollaborationDocumentFromConvexMock).not.toHaveBeenCalled()
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
