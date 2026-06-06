import { beforeEach, describe, expect, it, vi } from "vitest"

import { createCanonicalContentJson } from "@/lib/collaboration/canonical-content"
import { DEFAULT_COLLABORATION_LIMITS } from "@/lib/collaboration/limits"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { ApplicationError } from "@/lib/server/application-errors"
import { verifySignedCollaborationToken } from "@/lib/server/collaboration-token"
import type { CollaborationSessionTokenClaims } from "@/lib/collaboration/transport"
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
const BODY_MIGRATED_AT = "2026-06-06T08:00:00.000Z"

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

type CollaborationDocumentFixture = {
  documentId: string
  kind: "team-document" | "private-document"
  title: string
  content: string
  bodySource?: "convex-html" | "cloudflare-yjs"
  bodyMigratedAt?: string | null
  workspaceId: string | null
  teamId: string | null
  updatedAt: string
  updatedBy: string
  canEdit: boolean
  itemId: string | null
  itemUpdatedAt: string | null
}

function collaborationDocumentFixture(
  overrides: Partial<CollaborationDocumentFixture> = {}
): CollaborationDocumentFixture {
  return {
    documentId: "doc_1",
    kind: "team-document",
    title: "Spec",
    content: "<p>Hello</p>",
    bodySource: "convex-html",
    workspaceId: "workspace_1",
    teamId: "team_1",
    updatedAt: "2026-04-22T00:00:00.000Z",
    updatedBy: "user_1",
    canEdit: true,
    itemId: null,
    itemUpdatedAt: null,
    ...overrides,
  }
}

function migratedCollaborationDocumentFixture(
  overrides: Partial<CollaborationDocumentFixture> = {}
): CollaborationDocumentFixture {
  return collaborationDocumentFixture({
    content: "<p>Projection only</p>",
    bodySource: "cloudflare-yjs",
    bodyMigratedAt: BODY_MIGRATED_AT,
    updatedAt: "2026-06-06T08:05:00.000Z",
    ...overrides,
  })
}

async function callDocumentSessionRoute(
  document: CollaborationDocumentFixture
) {
  const { POST } =
    await import("@/app/api/collaboration/documents/[documentId]/session/route")

  getCollaborationDocumentServerMock.mockResolvedValue(document)

  const response = await POST(...documentSessionRouteInput())

  expect(response.status).toBe(200)
  return response.json()
}

function documentMigrationPayload(migrated: boolean) {
  return {
    ok: true,
    migrated,
    bodySource: "cloudflare-yjs",
    bodyMigratedAt: BODY_MIGRATED_AT,
  }
}

async function expectDocumentMigrationPayload(
  response: Response,
  migrated: boolean
) {
  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual(
    documentMigrationPayload(migrated)
  )
}

describe("document collaboration session route contracts", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    mockCollaborationRouteAuthContext({
      extraMocks: [getCollaborationDocumentServerMock],
      requireAppContextMock,
      requireSessionMock,
      logProviderErrorMock,
    })
  })

  it("returns the collaboration session contract for an editable document", async () => {
    const payload = await callDocumentSessionRoute(
      collaborationDocumentFixture()
    )

    expect(payload).toMatchObject({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      serviceUrl: "https://partykit.example.com",
      role: "editor",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
      limits: DEFAULT_COLLABORATION_LIMITS,
      bodySource: "convex-html",
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

  it("omits Convex body bootstrap content for migrated Cloudflare Yjs documents", async () => {
    const payload = await callDocumentSessionRoute(
      migratedCollaborationDocumentFixture()
    )

    expect(payload).toMatchObject({
      bodySource: "cloudflare-yjs",
      bodyMigratedAt: BODY_MIGRATED_AT,
    })
    expect(payload).not.toHaveProperty("contentJson")
    expect(payload).not.toHaveProperty("contentHtml")
  })

  it("downgrades the session role when the current user is view-only", async () => {
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/session/route")

    getCollaborationDocumentServerMock.mockResolvedValue(
      collaborationDocumentFixture({
        canEdit: false,
      })
    )

    const response = await POST(...documentSessionRouteInput())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      role: "viewer",
    })
  })

  it("maps collaboration session lookup failures to typed responses", async () => {
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/session/route")

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
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/session/route")

    getCollaborationDocumentServerMock.mockResolvedValue(
      collaborationDocumentFixture({
        documentId: "doc_private_1",
        kind: "private-document",
        title: "Private notes",
        teamId: null,
      })
    )

    const response = await POST(...documentSessionRouteInput("doc_private_1"))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Private documents do not support collaboration sessions",
      message: "Private documents do not support collaboration sessions",
      code: "COLLABORATION_UNAVAILABLE",
    })
  })

  it("rejects insecure collaboration transport when the app request is HTTPS", async () => {
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/session/route")

    process.env.NEXT_PUBLIC_PARTYKIT_URL = "http://127.0.0.1:1999"

    getCollaborationDocumentServerMock.mockResolvedValue(
      collaborationDocumentFixture()
    )

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

  it("forwards editable document body migration requests to PartyKit", async () => {
    vi.stubEnv("COLLABORATION_BODY_MIGRATION_ENABLED", "true")
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/migrate/route")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(documentMigrationPayload(true)), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    getCollaborationDocumentServerMock.mockResolvedValue(
      collaborationDocumentFixture()
    )

    const response = await POST(...documentSessionRouteInput("doc_1"))

    await expectDocumentMigrationPayload(response, true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining(
          "/parties/main/doc%3Adoc_1?action=migrate-body"
        ),
      }),
      expect.objectContaining({
        method: "POST",
      })
    )

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined
    const token = headers?.Authorization?.replace("Bearer ", "")

    expect(token).toBeTruthy()
    expect(verifySignedCollaborationToken(token!)).toMatchObject<
      Partial<CollaborationSessionTokenClaims>
    >({
      kind: "internal-migration",
      sub: "server",
      roomId: "doc:doc_1",
      documentId: "doc_1",
      currentUserId: "user_1",
      action: "migrate-body",
    })
  })

  it("does not call PartyKit when the document body is already migrated", async () => {
    vi.stubEnv("COLLABORATION_BODY_MIGRATION_ENABLED", "true")
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/migrate/route")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    getCollaborationDocumentServerMock.mockResolvedValue(
      migratedCollaborationDocumentFixture()
    )

    const response = await POST(...documentSessionRouteInput("doc_1"))

    await expectDocumentMigrationPayload(response, false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects body migration for view-only users", async () => {
    vi.stubEnv("COLLABORATION_BODY_MIGRATION_ENABLED", "true")
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/migrate/route")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    getCollaborationDocumentServerMock.mockResolvedValue(
      collaborationDocumentFixture({
        canEdit: false,
      })
    )

    const response = await POST(...documentSessionRouteInput("doc_1"))

    await expectTypedJsonError(
      response,
      403,
      "You do not have permission to migrate this document",
      "COLLABORATION_FORBIDDEN"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects body migration while the operational gate is disabled", async () => {
    const { POST } =
      await import("@/app/api/collaboration/documents/[documentId]/migrate/route")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST(...documentSessionRouteInput("doc_1"))

    await expectTypedJsonError(
      response,
      503,
      "Collaboration body migration is not enabled",
      "COLLABORATION_UNAVAILABLE"
    )
    expect(getCollaborationDocumentServerMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
