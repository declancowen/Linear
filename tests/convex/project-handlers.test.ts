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

vi.mock("@/convex/app/work_helpers", () => ({
  assertWorkspaceLabelIds: assertWorkspaceLabelIdsMock,
}))

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
    const { createProjectHandler } = await import("@/convex/app/project_handlers")
    const ctx = createCtx()

    listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue([
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
    ])

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
        leadId: "user_missing",
      })
    ).rejects.toThrow("Lead must belong to the current workspace")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects workspace-scoped project members that are not workspace members", async () => {
    const { createProjectHandler } = await import("@/convex/app/project_handlers")
    const ctx = createCtx()

    listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue([
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
      {
        workspaceId: "workspace_1",
        userId: "user_2",
        role: "member",
      },
    ])

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
        leadId: "user_1",
        memberIds: ["user_2", "user_missing"],
      })
    ).rejects.toThrow("All project members must belong to the current workspace")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects overlong project names before inserting", async () => {
    const { createProjectHandler } = await import("@/convex/app/project_handlers")
    const ctx = createCtx()

    listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue([
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
      },
    ])

    await expect(
      createProjectHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
        templateType: "software-delivery",
        name: "x".repeat(65),
        summary: "Launch summary",
        priority: "medium",
      })
    ).rejects.toThrow("Project name must be at most 64 characters")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })
})
