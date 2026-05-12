import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableWorkspaceAccessMock = vi.fn()
const assertWorkspaceLabelIdsMock = vi.fn()
const getProjectDocMock = vi.fn()
const getTeamDocMock = vi.fn()
const listMilestonesByProjectMock = vi.fn()
const listNotificationsByEntityMock = vi.fn()
const listProjectUpdatesByProjectMock = vi.fn()
const listTeamMembershipsByTeamMock = vi.fn()
const listViewsByScopeMock = vi.fn()
const listWorkspaceMembershipsByWorkspaceMock = vi.fn()
const normalizeTeamMock = vi.fn()
const normalizeTeamWorkflowSettingsMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "project_1",
  getNow: () => "2026-04-20T22:20:00.000Z",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireEditableWorkspaceAccess: requireEditableWorkspaceAccessMock,
}))

vi.mock("@/convex/app/work_helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/convex/app/work_helpers")>()

  return {
    ...actual,
    assertWorkspaceLabelIds: assertWorkspaceLabelIdsMock,
  }
})

vi.mock("@/convex/app/data", () => ({
  getProjectDoc: getProjectDocMock,
  getTeamDoc: getTeamDocMock,
  listMilestonesByProject: listMilestonesByProjectMock,
  listNotificationsByEntity: listNotificationsByEntityMock,
  listProjectUpdatesByProject: listProjectUpdatesByProjectMock,
  listTeamMembershipsByTeam: listTeamMembershipsByTeamMock,
  listViewsByScope: listViewsByScopeMock,
  listWorkspaceMembershipsByWorkspace: listWorkspaceMembershipsByWorkspaceMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: normalizeTeamMock,
  normalizeTeamWorkflowSettings: normalizeTeamWorkflowSettingsMock,
}))

vi.mock("@/convex/app/cleanup", () => ({
  cleanupRemainingLinksAfterDelete: vi.fn(),
  cleanupViewFiltersForDeletedEntities: vi.fn(),
  deleteDocs: vi.fn(),
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      query: vi.fn(),
    },
  }
}

function mockWorkspaceMemberships(userIds: string[]) {
  listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue(
    userIds.map((userId, index) => ({
      workspaceId: "workspace_1",
      userId,
      role: index === 0 ? "admin" : "member",
    }))
  )
}

async function expectWorkspaceProjectCreateRejected(
  ctx: ReturnType<typeof createCtx>,
  patch: Record<string, unknown>,
  message: string
) {
  const { createProjectHandler } = await import("@/convex/app/project_handlers")

  await expect(
    createProjectHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      scopeType: "workspace",
      scopeId: "workspace_1",
      templateType: "software-delivery",
      name: "Launch",
      summary: "Launch summary",
      priority: "medium",
      ...patch,
    })
  ).rejects.toThrow(message)
  expect(ctx.db.insert).not.toHaveBeenCalled()
}

describe("project handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireEditableWorkspaceAccessMock.mockReset()
    assertWorkspaceLabelIdsMock.mockReset()
    getProjectDocMock.mockReset()
    getTeamDocMock.mockReset()
    listMilestonesByProjectMock.mockReset()
    listNotificationsByEntityMock.mockReset()
    listProjectUpdatesByProjectMock.mockReset()
    listTeamMembershipsByTeamMock.mockReset()
    listViewsByScopeMock.mockReset()
    listWorkspaceMembershipsByWorkspaceMock.mockReset()
    normalizeTeamMock.mockReset()
    normalizeTeamWorkflowSettingsMock.mockReset()

    normalizeTeamWorkflowSettingsMock.mockReturnValue({
      templateDefaults: {
        "software-delivery": {
          defaultViewLayout: "board",
          targetWindowDays: 14,
        },
      },
    })
  })

  it("rejects workspace-scoped project leads that are not workspace members", async () => {
    const ctx = createCtx()

    mockWorkspaceMemberships(["user_1"])
    await expectWorkspaceProjectCreateRejected(
      ctx,
      { leadId: "user_missing" },
      "Lead must belong to the current workspace"
    )
  })

  it("rejects workspace-scoped project members that are not workspace members", async () => {
    const ctx = createCtx()

    mockWorkspaceMemberships(["user_1", "user_2"])
    await expectWorkspaceProjectCreateRejected(
      ctx,
      {
        leadId: "user_1",
        memberIds: ["user_2", "user_missing"],
      },
      "All project members must belong to the current workspace"
    )
  })

  it("rejects overlong project names before inserting", async () => {
    const ctx = createCtx()

    mockWorkspaceMemberships(["user_1"])
    await expectWorkspaceProjectCreateRejected(
      ctx,
      { name: "x".repeat(65) },
      "Project name must be at most 64 characters"
    )
  })

  it("rejects invalid project schedule strings before inserting", async () => {
    const ctx = createCtx()

    mockWorkspaceMemberships(["user_1"])
    await expectWorkspaceProjectCreateRejected(
      ctx,
      { startDate: "not-a-date" },
      "Start date must be a valid calendar date"
    )
  })

  it("creates workspace projects with normalized member and template defaults", async () => {
    const { createProjectHandler } = await import("@/convex/app/project_handlers")
    const ctx = createCtx()

    mockWorkspaceMemberships(["user_1", "user_2"])

    await expect(
      createProjectHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
        templateType: "software-delivery",
        name: "  Launch Plan  ",
        summary: "Launch summary",
        priority: "medium",
        labelIds: ["label_1", "label_1"],
        leadId: null,
        memberIds: ["user_2", "user_2"],
      })
    ).resolves.toEqual({
      workspaceId: "workspace_1",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        id: "project_1",
        name: "Launch Plan",
        leadId: "user_1",
        memberIds: ["user_2", "user_1"],
        labelIds: ["label_1"],
        presentation: expect.objectContaining({
          layout: "board",
        }),
      })
    )
  })

  it("deletes project-owned custom views without deleting unrelated scope views", async () => {
    const { deleteProjectHandler } = await import("@/convex/app/project_handlers")
    const ctx = createCtx()

    getProjectDocMock.mockResolvedValue({
      _id: "project_doc_1",
      id: "project_1",
      scopeType: "team",
      scopeId: "team_1",
    })
    getTeamDocMock.mockResolvedValue({
      slug: "platform",
    })
    listMilestonesByProjectMock.mockResolvedValue([
      {
        _id: "milestone_doc_1",
        id: "milestone_1",
      },
    ])
    listProjectUpdatesByProjectMock.mockResolvedValue([])
    listNotificationsByEntityMock.mockResolvedValue([])
    listViewsByScopeMock.mockResolvedValue([
      {
        _id: "view_doc_1",
        containerType: "project-items",
        containerId: "project_1",
      },
      {
        _id: "view_doc_2",
        containerType: null,
        entityKind: "items",
        route: "/team/platform/projects/project_1",
      },
      {
        _id: "view_doc_3",
        containerType: null,
        entityKind: "items",
        route: "/team/platform/projects/other",
      },
    ])
    ctx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: vi.fn().mockResolvedValue([
          {
            _id: "view_doc_2",
          },
          {
            _id: "view_doc_4",
          },
        ]),
      }),
    })

    await deleteProjectHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      projectId: "project_1",
    })

    expect(ctx.db.delete).toHaveBeenCalledWith("project_doc_1")
  })
})
