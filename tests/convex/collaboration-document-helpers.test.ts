import { beforeEach, describe, expect, it, vi } from "vitest"

const collaborationDocumentMocks = vi.hoisted(() => ({
  assertServerToken: vi.fn(),
  getDocumentDoc: vi.fn(),
  getNow: vi.fn(),
  getProjectDoc: vi.fn(),
  getTeamDoc: vi.fn(),
  getWorkItemByDescriptionDocId: vi.fn(),
  listTeamMembershipsByTeam: vi.fn(),
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableDocumentAccess: vi.fn(),
  requireReadableDocumentAccess: vi.fn(),
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: collaborationDocumentMocks.assertServerToken,
  getNow: collaborationDocumentMocks.getNow,
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: collaborationDocumentMocks.getDocumentDoc,
  getProjectDoc: collaborationDocumentMocks.getProjectDoc,
  getTeamDoc: collaborationDocumentMocks.getTeamDoc,
  getWorkItemByDescriptionDocId:
    collaborationDocumentMocks.getWorkItemByDescriptionDocId,
  listTeamMembershipsByTeam:
    collaborationDocumentMocks.listTeamMembershipsByTeam,
}))

describe("collaboration document helpers", () => {
  beforeEach(() => {
    collaborationDocumentMocks.assertServerToken.mockReset()
    collaborationDocumentMocks.getDocumentDoc.mockReset()
    collaborationDocumentMocks.getNow.mockReset()
    collaborationDocumentMocks.getProjectDoc.mockReset()
    collaborationDocumentMocks.getTeamDoc.mockReset()
    collaborationDocumentMocks.getWorkItemByDescriptionDocId.mockReset()
    collaborationDocumentMocks.listTeamMembershipsByTeam.mockReset()
    collaborationDocumentMocks.getNow.mockReturnValue(
      "2026-06-06T08:00:00.000Z"
    )
  })

  it("loads item description context with team members and project scopes", async () => {
    const { getCollaborationWorkItemContext } = await import(
      "@/convex/app/collaboration_documents"
    )

    collaborationDocumentMocks.getWorkItemByDescriptionDocId.mockResolvedValue({
      id: "item_1",
      teamId: "team_1",
      primaryProjectId: "project_1",
      linkedProjectIds: ["project_1", "project_2"],
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
    collaborationDocumentMocks.listTeamMembershipsByTeam.mockResolvedValue([
      {
        teamId: "team_1",
        userId: "user_1",
      },
    ])
    collaborationDocumentMocks.getTeamDoc.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
    })
    collaborationDocumentMocks.getProjectDoc
      .mockResolvedValueOnce({
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
      })
      .mockResolvedValueOnce(null)

    await expect(
      getCollaborationWorkItemContext({} as never, {
        id: "doc_1",
        kind: "item-description",
      } as never)
    ).resolves.toEqual({
      workItem: expect.objectContaining({
        id: "item_1",
      }),
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
        },
      ],
      workItemTeam: {
        id: "team_1",
        workspaceId: "workspace_1",
      },
      projectScopes: [
        {
          projectId: "project_1",
          scopeType: "team",
          scopeId: "team_1",
        },
      ],
    })
  })

  it("returns empty work item context for non-item documents", async () => {
    const {
      getCollaborationWorkItemContext,
      getCollaborationWorkItemFields,
    } = await import("@/convex/app/collaboration_documents")

    await expect(
      getCollaborationWorkItemContext({} as never, {
        id: "doc_1",
        kind: "team-document",
      } as never)
    ).resolves.toEqual({
      workItem: null,
      teamMemberships: [],
      workItemTeam: null,
      projectScopes: [],
    })
    expect(getCollaborationWorkItemFields(null)).toEqual({
      itemId: null,
      itemUpdatedAt: null,
    })
    expect(
      getCollaborationWorkItemFields({
        id: "item_1",
        updatedAt: "2026-04-21T09:00:00.000Z",
      } as never)
    ).toEqual({
      itemId: "item_1",
      itemUpdatedAt: "2026-04-21T09:00:00.000Z",
    })
  })

  it("marks collaboration document bodies as migrated after expected content seeding", async () => {
    const { markCollaborationDocumentBodyMigratedHandler } = await import(
      "@/convex/app/collaboration_documents"
    )
    const patchMock = vi.fn()

    collaborationDocumentMocks.getDocumentDoc.mockResolvedValue({
      _id: "doc_db_1",
      id: "doc_1",
      bodySource: "convex-html",
      updatedAt: "2026-04-22T00:00:00.000Z",
    })

    await expect(
      markCollaborationDocumentBodyMigratedHandler(
        {
          db: {
            patch: patchMock,
          },
        } as never,
        {
          serverToken: "server_token",
          documentId: "doc_1",
          expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
        }
      )
    ).resolves.toEqual({
      bodySource: "cloudflare-yjs",
      bodyMigratedAt: "2026-06-06T08:00:00.000Z",
      changed: true,
    })
    expect(collaborationDocumentMocks.assertServerToken).toHaveBeenCalledWith(
      "server_token"
    )
    expect(patchMock).toHaveBeenCalledWith("doc_db_1", {
      bodySource: "cloudflare-yjs",
      bodyMigratedAt: "2026-06-06T08:00:00.000Z",
    })
  })

  it("does not patch documents that are already marked as migrated", async () => {
    const { markCollaborationDocumentBodyMigratedHandler } = await import(
      "@/convex/app/collaboration_documents"
    )
    const patchMock = vi.fn()

    collaborationDocumentMocks.getDocumentDoc.mockResolvedValue({
      _id: "doc_db_1",
      id: "doc_1",
      bodySource: "cloudflare-yjs",
      bodyMigratedAt: "2026-06-06T08:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
    })

    await expect(
      markCollaborationDocumentBodyMigratedHandler(
        {
          db: {
            patch: patchMock,
          },
        } as never,
        {
          serverToken: "server_token",
          documentId: "doc_1",
          expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
        }
      )
    ).resolves.toEqual({
      bodySource: "cloudflare-yjs",
      bodyMigratedAt: "2026-06-06T08:00:00.000Z",
      changed: false,
    })
    expect(patchMock).not.toHaveBeenCalled()
  })

  it("rejects migration marking when the Convex body changed after seeding", async () => {
    const { markCollaborationDocumentBodyMigratedHandler } = await import(
      "@/convex/app/collaboration_documents"
    )
    const patchMock = vi.fn()

    collaborationDocumentMocks.getDocumentDoc.mockResolvedValue({
      _id: "doc_db_1",
      id: "doc_1",
      bodySource: "convex-html",
      updatedAt: "2026-04-22T00:00:01.000Z",
    })

    await expect(
      markCollaborationDocumentBodyMigratedHandler(
        {
          db: {
            patch: patchMock,
          },
        } as never,
        {
          serverToken: "server_token",
          documentId: "doc_1",
          expectedUpdatedAt: "2026-04-22T00:00:00.000Z",
        }
      )
    ).rejects.toThrow(
      "Document changed before collaboration body migration"
    )
    expect(patchMock).not.toHaveBeenCalled()
  })
})
