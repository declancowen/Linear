import { beforeEach, describe, expect, it, vi } from "vitest"

import { createCanonicalContentJson } from "@/lib/collaboration/canonical-content"
import { DEFAULT_COLLABORATION_LIMITS } from "@/lib/collaboration/limits"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { ApplicationError } from "@/lib/server/application-errors"
import { verifySignedCollaborationToken } from "@/lib/server/collaboration-token"
import {
  createProviderErrorsMockModule,
  createRouteHandlerInput,
  createRouteAuthMockModule,
  expectTypedJsonError,
  mockCollaborationRouteAuthContext,
} from "@/tests/lib/fixtures/api-routes"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getCollaborationDocumentServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () =>
  createRouteAuthMockModule(requireSessionMock, requireAppContextMock)
)

vi.mock("@/lib/server/convex", () => ({
  getCollaborationDocumentServer: getCollaborationDocumentServerMock,
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(logProviderErrorMock)
)

function documentSessionRouteInput(
  documentId = "doc_1",
  url = "http://localhost",
  init?: RequestInit
) {
  return createRouteHandlerInput(
    url,
    {
      documentId,
    },
    init
  )
}

describe("document collaboration session route contracts", () => {
  beforeEach(() => {
    mockCollaborationRouteAuthContext({
      extraMocks: [getCollaborationDocumentServerMock],
      requireAppContextMock,
      requireSessionMock,
      logProviderErrorMock,
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

    const response = await POST(...documentSessionRouteInput())

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      serviceUrl: "https://partykit.example.com",
      role: "editor",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
      limits: DEFAULT_COLLABORATION_LIMITS,
      contentJson: createCanonicalContentJson("<p>Hello</p>"),
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
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
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

    const response = await POST(...documentSessionRouteInput())

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

    const response = await POST(...documentSessionRouteInput("doc_missing"))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Document not found",
      message: "Document not found",
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("rejects private documents for collaboration sessions", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/documents/[documentId]/session/route"
    )

    getCollaborationDocumentServerMock.mockResolvedValue({
      documentId: "doc_private_1",
      kind: "private-document",
      title: "Private notes",
      content: "<p>Hello</p>",
      workspaceId: "workspace_1",
      teamId: null,
      updatedAt: "2026-04-22T00:00:00.000Z",
      updatedBy: "user_1",
      canEdit: true,
      itemId: null,
      itemUpdatedAt: null,
    })

    const response = await POST(...documentSessionRouteInput("doc_private_1"))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Private documents do not support collaboration sessions",
      message: "Private documents do not support collaboration sessions",
      code: "COLLABORATION_UNAVAILABLE",
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
      ...documentSessionRouteInput(
        "doc_1",
        "https://localhost/api/collaboration/documents/doc_1/session",
        {
          method: "POST",
        }
      )
    )

    await expectTypedJsonError(
      response,
      503,
      "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      "COLLABORATION_UNAVAILABLE"
    )
  })
})
