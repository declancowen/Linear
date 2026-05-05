import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableWorkspaceAccessMock = vi.fn()
const getTeamDocMock = vi.fn()
const normalizeTeamMock = vi.fn()
const assertWorkspaceLabelIdsMock = vi.fn()
const requireViewMutationAccessMock = vi.fn()
const resolveViewWorkspaceIdMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "view_1",
  getNow: () => "2026-04-21T09:00:00.000Z",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireEditableWorkspaceAccess: requireEditableWorkspaceAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getTeamDoc: getTeamDocMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: normalizeTeamMock,
}))

vi.mock("@/convex/app/work_helpers", () => ({
  assertWorkspaceLabelIds: assertWorkspaceLabelIdsMock,
  requireViewMutationAccess: requireViewMutationAccessMock,
  resolveViewWorkspaceId: resolveViewWorkspaceIdMock,
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

describe("view handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireEditableWorkspaceAccessMock.mockReset()
    getTeamDocMock.mockReset()
    normalizeTeamMock.mockReset()
    assertWorkspaceLabelIdsMock.mockReset()
    requireViewMutationAccessMock.mockReset()
    resolveViewWorkspaceIdMock.mockReset()
  })

  it("derives the default item level from the team experience on create", async () => {
    const { createViewHandler } = await import("@/convex/app/view_handlers")
    const ctx = createCtx()

    getTeamDocMock.mockResolvedValue({
      _id: "team_doc_1",
    })
    normalizeTeamMock.mockReturnValue({
      id: "team_1",
      workspaceId: "workspace_1",
      slug: "platform",
      settings: {
        experience: "software-development",
        features: {
          views: true,
          issues: true,
          projects: true,
          docs: true,
        },
      },
    })

    const view = await createViewHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
    })

    expect(view).toMatchObject({
      itemLevel: "epic",
      showChildItems: true,
    })
    expect(ctx.db.insert).toHaveBeenCalledWith("views", view)
  })

  it("toggles view filter values while preserving other filters", async () => {
    const { toggleViewFilterValueHandler } = await import(
      "@/convex/app/view_handlers"
    )
    const ctx = createCtx()

    requireViewMutationAccessMock.mockResolvedValue({
      _id: "view_doc_1",
      filters: {
        labelIds: ["label_1", "label_2"],
        status: ["todo"],
      },
    })
    resolveViewWorkspaceIdMock.mockResolvedValue("workspace_1")

    await toggleViewFilterValueHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      key: "labelIds",
      value: "label_2",
    } as never)
    await toggleViewFilterValueHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      viewId: "view_1",
      key: "labelIds",
      value: "label_3",
    } as never)

    expect(ctx.db.patch).toHaveBeenNthCalledWith(1, "view_doc_1", {
      filters: {
        labelIds: ["label_1"],
        status: ["todo"],
      },
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
    expect(ctx.db.patch).toHaveBeenNthCalledWith(2, "view_doc_1", {
      filters: {
        labelIds: ["label_1", "label_2", "label_3"],
        status: ["todo"],
      },
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
  })
})
