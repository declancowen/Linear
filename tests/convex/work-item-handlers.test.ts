import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getTeamDocMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const normalizeTeamMock = vi.fn()
const validateWorkItemParentMock = vi.fn()
const getClampedNotifiedMentionCountsMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "item_1",
  getNow: () => "2026-04-20T22:20:00.000Z",
  toTeamKeyPrefix: () => "LAN",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: getDocumentDocMock,
  getTeamDoc: getTeamDocMock,
  getWorkItemDoc: getWorkItemDocMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  listDocumentPresenceViewers: vi.fn(),
  normalizeTeam: normalizeTeamMock,
}))

vi.mock("@/convex/app/work_helpers", () => ({
  assertWorkspaceLabelIds: vi.fn(),
  collectWorkItemCascadeIds: vi.fn(),
  getResolvedProjectLinkForWorkItemUpdate: vi.fn(),
  projectBelongsToTeamScope: vi.fn(),
  validateWorkItemParent: validateWorkItemParentMock,
}))

vi.mock("@/convex/app/collaboration_utils", () => ({
  createNotification: vi.fn(),
}))

vi.mock("@/convex/app/document_handlers", () => ({
  getClampedNotifiedMentionCounts: getClampedNotifiedMentionCountsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: vi.fn(),
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
      query: vi.fn(),
    },
  }
}

describe("work item handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    getDocumentDocMock.mockReset()
    getTeamDocMock.mockReset()
    getWorkItemDocMock.mockReset()
    normalizeTeamMock.mockReset()
    validateWorkItemParentMock.mockReset()
    getClampedNotifiedMentionCountsMock.mockReset()

    getDocumentDocMock.mockResolvedValue({
      _id: "db_doc_1",
      id: "doc_1",
      title: "Launch task description",
      content: "<p>Existing</p>",
      notifiedMentionCounts: {},
    })
    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      name: "Launch",
      workspaceId: "workspace_1",
      settings: {},
    })
    getWorkItemDocMock.mockResolvedValue({
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      type: "task",
      title: "Launch task",
      updatedAt: "2026-04-20T22:00:00.000Z",
      parentId: null,
      primaryProjectId: null,
      startDate: null,
      targetDate: null,
      descriptionDocId: "doc_1",
      assigneeId: null,
      status: "backlog",
    })
    normalizeTeamMock.mockReturnValue({
      settings: {
        experience: "software-development",
        features: {
          issues: true,
        },
      },
    })
    getClampedNotifiedMentionCountsMock.mockReturnValue({})
  })

  it("rejects invalid schedule strings on create before inserting", async () => {
    const { createWorkItemHandler } = await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
        dueDate: "not-a-date",
      })
    ).rejects.toThrow("Due date must be a valid calendar date")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("creates work items with empty description documents", async () => {
    const { createWorkItemHandler } = await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([]),
      })),
    })

    await createWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      teamId: "team_1",
      type: "sub-task",
      title: "Test",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
    })

    expect(ctx.db.insert).toHaveBeenNthCalledWith(1, "documents", {
      id: "item_1",
      kind: "item-description",
      workspaceId: "workspace_1",
      teamId: "team_1",
      title: "Test description",
      content: "<p></p>",
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: "user_1",
      updatedBy: "user_1",
      createdAt: "2026-04-20T22:20:00.000Z",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
  })

  it("rejects invalid schedule strings on update before patching", async () => {
    const { updateWorkItemHandler } = await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      updateWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        itemId: "item_1",
        patch: {
          startDate: "not-a-date",
        },
      })
    ).rejects.toThrow("Start date must be a valid calendar date")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("treats any provided expectedUpdatedAt value as a CAS guard", async () => {
    const { updateWorkItemHandler } = await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      updateWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        itemId: "item_1",
        patch: {
          expectedUpdatedAt: "",
        },
      })
    ).rejects.toThrow("Work item changed while you were editing")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("persists collaboration title and description updates without origin-driven side effects", async () => {
    const { persistCollaborationWorkItemHandler } = await import(
      "@/convex/app/work_item_handlers"
    )
    const ctx = createCtx()

    await persistCollaborationWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      itemId: "item_1",
      patch: {
        title: "Updated title",
        description: "<p>Updated</p>",
        expectedUpdatedAt: "2026-04-20T22:00:00.000Z",
      },
    })

    expect(ctx.db.patch).toHaveBeenNthCalledWith(1, "db_item_1", {
      title: "Updated title",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
    expect(ctx.db.patch).toHaveBeenNthCalledWith(2, "db_doc_1", {
      content: "<p>Updated</p>",
      notifiedMentionCounts: {},
      title: "Updated title description",
      updatedAt: "2026-04-20T22:20:00.000Z",
      updatedBy: "user_1",
    })
    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
  })

  it("shifts timeline dates in calendar-day space when moving a scheduled item", async () => {
    const { shiftTimelineItemHandler } = await import(
      "@/convex/app/work_item_handlers"
    )
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue({
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      title: "Launch task",
      startDate: "2026-03-08",
      dueDate: "2026-03-08",
      targetDate: "2026-03-10",
    })

    await shiftTimelineItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      itemId: "item_1",
      nextStartDate: "2026-03-09",
    })

    expect(ctx.db.patch).toHaveBeenCalledWith("db_item_1", {
      startDate: "2026-03-09",
      dueDate: "2026-03-09",
      targetDate: "2026-03-11",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
  })
})
