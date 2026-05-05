import { beforeEach, describe, expect, it, vi } from "vitest"

const collaborationDocumentMocks = vi.hoisted(() => ({
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
  assertServerToken: vi.fn(),
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: vi.fn(),
  getProjectDoc: collaborationDocumentMocks.getProjectDoc,
  getTeamDoc: collaborationDocumentMocks.getTeamDoc,
  getWorkItemByDescriptionDocId:
    collaborationDocumentMocks.getWorkItemByDescriptionDocId,
  listTeamMembershipsByTeam:
    collaborationDocumentMocks.listTeamMembershipsByTeam,
}))

describe("collaboration document helpers", () => {
  beforeEach(() => {
    collaborationDocumentMocks.getProjectDoc.mockReset()
    collaborationDocumentMocks.getTeamDoc.mockReset()
    collaborationDocumentMocks.getWorkItemByDescriptionDocId.mockReset()
    collaborationDocumentMocks.listTeamMembershipsByTeam.mockReset()
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
})
