import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"
import { verifySignedCollaborationToken } from "@/lib/server/collaboration-token"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getCollaborationDocumentServerMock = vi.fn()
const persistCollaborationDocumentServerMock = vi.fn()
const persistCollaborationItemDescriptionServerMock = vi.fn()
const updateWorkItemServerMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: vi.fn(),
}))

vi.mock("@/lib/server/convex", () => ({
  getCollaborationDocumentServer: getCollaborationDocumentServerMock,
  persistCollaborationDocumentServer: persistCollaborationDocumentServerMock,
  persistCollaborationItemDescriptionServer:
    persistCollaborationItemDescriptionServerMock,
  updateWorkItemServer: updateWorkItemServerMock,
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("document collaboration route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    getCollaborationDocumentServerMock.mockReset()
    persistCollaborationDocumentServerMock.mockReset()
    persistCollaborationItemDescriptionServerMock.mockReset()
    updateWorkItemServerMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    logProviderErrorMock.mockReset()

    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
    process.env.COLLABORATION_INTERNAL_SECRET = "test-collaboration-internal-secret"
    process.env.NEXT_PUBLIC_PARTYKIT_URL = "https://partykit.example.com"

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
  })

  it("returns the collaboration session contract for an editable document", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/documents/[documentId]/session/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
      title: "Spec",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
    })

    const response = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({
        documentId: "doc_1",
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      serviceUrl: "https://partykit.example.com",
      role: "editor",
      contentHtml: "<p>Hello</p>",
    })

    const claims = verifySignedCollaborationToken(payload.token)

    expect(claims).toMatchObject({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_1",
      documentId: "doc_1",
      role: "editor",
      workspaceId: "workspace_1",
    })
  })

  it("downgrades the session role when the current user is view-only", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/documents/[documentId]/session/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
      title: "Spec",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: false,
      itemId: null,
      itemUpdatedAt: null,
    })

    const response = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({
        documentId: "doc_1",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      role: "viewer",
    })
  })

  it("maps collaboration session lookup failures to typed responses", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/documents/[documentId]/session/route"
    )

    getCollaborationDocumentServerMock.mockRejectedValue(
      new ApplicationError("Document not found", 404, {
        code: "DOCUMENT_NOT_FOUND",
      })
    )

    const response = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({
        documentId: "doc_missing",
      }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Document not found",
      message: "Document not found",
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("rejects insecure collaboration transport when the app request is HTTPS", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/documents/[documentId]/session/route"
    )

    process.env.NEXT_PUBLIC_PARTYKIT_URL = "http://127.0.0.1:1999"

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
      title: "Spec",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
    })

    const response = await POST(
      new Request("https://localhost/api/collaboration/documents/doc_1/session", {
        method: "POST",
      }) as never,
      {
        params: Promise.resolve({
          documentId: "doc_1",
        }),
      }
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error:
        "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      message:
        "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      code: "COLLABORATION_UNAVAILABLE",
    })
  })

  it("boots a canonical document snapshot through the internal collaboration route", async () => {
    const { GET } = await import(
      "@/app/api/internal/collaboration/documents/[documentId]/bootstrap/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
      title: "Spec",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
    })

    const response = await GET(
      new Request(
        "http://localhost/api/internal/collaboration/documents/doc_1/bootstrap?currentUserId=user_1",
        {
          headers: {
            Authorization: "Bearer test-collaboration-internal-secret",
          },
        }
      ),
      {
        params: Promise.resolve({
          documentId: "doc_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      documentId: "doc_1",
      kind: "team-document",
      itemId: null,
      title: "Spec",
      contentHtml: "<p>Hello</p>",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      editable: true,
      deleted: false,
    })
    expect(payload.contentJson).toMatchObject({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello",
            },
          ],
        },
      ],
    })
  })

  it("rejects internal collaboration requests without the shared secret", async () => {
    const { GET } = await import(
      "@/app/api/internal/collaboration/documents/[documentId]/bootstrap/route"
    )

    const response = await GET(
      new Request(
        "http://localhost/api/internal/collaboration/documents/doc_1/bootstrap?currentUserId=user_1"
      ),
      {
        params: Promise.resolve({
          documentId: "doc_1",
        }),
      }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      message: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    })
  })

  it("persists standalone document collaboration through the canonical document route and bumps scoped keys", async () => {
    const { POST } = await import(
      "@/app/api/internal/collaboration/documents/[documentId]/persist/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
      title: "Spec",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
    })
    persistCollaborationDocumentServerMock.mockResolvedValue({
      ok: true,
    })
    bumpScopedReadModelVersionsServerMock.mockResolvedValue({
      versions: [],
    })

    const response = await POST(
      new Request(
        "http://localhost/api/internal/collaboration/documents/doc_1/persist",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-collaboration-internal-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentUserId: "user_1",
            title: "Spec",
            contentJson: {
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
            },
            flushReason: "periodic",
            sourceVersion: 2,
          }),
        }
      ),
      {
        params: Promise.resolve({
          documentId: "doc_1",
        }),
      }
    )

    expect(persistCollaborationDocumentServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      documentId: "doc_1",
      title: "Spec",
      content: "<p>Updated</p>",
      expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: ["document-detail:doc_1"],
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      scopeKeys: ["document-detail:doc_1"],
      flushReason: "periodic",
      sourceVersion: 2,
    })
  })

  it("persists item-description collaboration through the work-item description path", async () => {
    const { POST } = await import(
      "@/app/api/internal/collaboration/documents/[documentId]/persist/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
    })
    persistCollaborationItemDescriptionServerMock.mockResolvedValue({
      ok: true,
    })
    bumpScopedReadModelVersionsServerMock.mockResolvedValue({
      versions: [],
    })

    const response = await POST(
      new Request(
        "http://localhost/api/internal/collaboration/documents/doc_desc_1/persist",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-collaboration-internal-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentUserId: "user_1",
            contentHtml: "<p>Updated</p>",
          }),
        }
      ),
      {
        params: Promise.resolve({
          documentId: "doc_desc_1",
        }),
      }
    )

    expect(persistCollaborationItemDescriptionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      content: "<p>Updated</p>",
      expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: [
        "document-detail:doc_desc_1",
        "work-item-detail:item_1",
        "work-index:team_team_1",
      ],
    })
    expect(response.status).toBe(200)
  })

  it("persists item-description title and content atomically through the work-item path when provided", async () => {
    const { POST } = await import(
      "@/app/api/internal/collaboration/documents/[documentId]/persist/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_desc_1",
      kind: "item-description",
      title: "Item description",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: "team_1",
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: "item_1",
      itemUpdatedAt: "2026-04-22T00:00:00.000Z",
    })
    updateWorkItemServerMock.mockResolvedValue({
      ok: true,
    })
    bumpScopedReadModelVersionsServerMock.mockResolvedValue({
      versions: [],
    })

    const response = await POST(
      new Request(
        "http://localhost/api/internal/collaboration/documents/doc_desc_1/persist",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-collaboration-internal-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentUserId: "user_1",
            contentHtml: "<p>Updated</p>",
            workItemTitle: "Updated title",
            workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
            flushReason: "manual",
          }),
        }
      ),
      {
        params: Promise.resolve({
          documentId: "doc_desc_1",
        }),
      }
    )

    expect(updateWorkItemServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      patch: {
        title: "Updated title",
        description: "<p>Updated</p>",
        expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
      },
    })
    expect(persistCollaborationItemDescriptionServerMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })
})
