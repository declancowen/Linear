import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  expectPrivateWorkItemMutationDenied,
  mockEmptyQueryCollect,
} from "@/tests/lib/fixtures/convex"

const assertServerTokenMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableTeamDocMock = vi.fn()
const requireReadableDocumentAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const requireReadableWorkItemAccessMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireReadableWorkspaceAccessMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getProjectDocMock = vi.fn()
const getTeamDocMock = vi.fn()
const getUserDocMock = vi.fn()
const getViewDocMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listLabelsByWorkspaceMock = vi.fn()
const listPrivateWorkItemsByCreatorMock = vi.fn()
const listWorkItemActivitiesByWorkItemsMock = vi.fn()
const normalizeTeamMock = vi.fn()
const validateWorkItemParentMock = vi.fn()
const getResolvedProjectLinkForWorkItemUpdateMock = vi.fn()
const getClampedNotifiedMentionCountsMock = vi.fn()
const createNotificationMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "item_1",
  getNow: () => "2026-04-20T22:20:00.000Z",
  toTeamKeyPrefix: () => "LAN",
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireEditableTeamDoc: requireEditableTeamDocMock,
  requireReadableDocumentAccess: requireReadableDocumentAccessMock,
  requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
  requireReadableWorkItemAccess: requireReadableWorkItemAccessMock,
  requireReadableTeamAccess: requireReadableTeamAccessMock,
  requireReadableWorkspaceAccess: requireReadableWorkspaceAccessMock,
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: getDocumentDocMock,
  getProjectDoc: getProjectDocMock,
  getTeamDoc: getTeamDocMock,
  getUserDoc: getUserDocMock,
  getViewDoc: getViewDocMock,
  getWorkItemDoc: getWorkItemDocMock,
  listLabelsByWorkspace: listLabelsByWorkspaceMock,
  listPrivateWorkItemsByCreator: listPrivateWorkItemsByCreatorMock,
  listWorkItemActivitiesByWorkItems: listWorkItemActivitiesByWorkItemsMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  listDocumentPresenceViewers: vi.fn(),
  normalizeTeam: normalizeTeamMock,
}))

vi.mock("@/convex/app/work_helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/convex/app/work_helpers")>()

  return {
    ...actual,
    assertWorkspaceLabelIds: vi.fn(),
    collectWorkItemCascadeIds: vi.fn(),
    getResolvedProjectLinkForWorkItemUpdate:
      getResolvedProjectLinkForWorkItemUpdateMock,
    projectBelongsToTeamScope: vi.fn(),
    validateWorkItemParent: validateWorkItemParentMock,
  }
})

vi.mock("@/convex/app/collaboration_utils", () => ({
  createNotification: createNotificationMock,
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

function createPrivateWorkItemDoc() {
  return {
    _id: "db_item_1",
    id: "item_1",
    teamId: null,
    workspaceId: "workspace_1",
    type: "task",
    title: "Private task",
    updatedAt: "2026-04-20T22:00:00.000Z",
    parentId: null,
    primaryProjectId: null,
    startDate: null,
    targetDate: null,
    descriptionDocId: "doc_1",
    assigneeId: null,
    assigneeIds: [],
    creatorId: "user_1",
    subscriberIds: [],
    status: "todo",
    visibility: "private",
    labelIds: [],
  }
}

describe("work item handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireEditableTeamDocMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    requireReadableWorkItemAccessMock.mockReset()
    requireReadableTeamAccessMock.mockReset()
    requireReadableWorkspaceAccessMock.mockReset()
    getDocumentDocMock.mockReset()
    getProjectDocMock.mockReset()
    getTeamDocMock.mockReset()
    getUserDocMock.mockReset()
    getViewDocMock.mockReset()
    getWorkItemDocMock.mockReset()
    listLabelsByWorkspaceMock.mockReset()
    listPrivateWorkItemsByCreatorMock.mockReset()
    listWorkItemActivitiesByWorkItemsMock.mockReset()
    normalizeTeamMock.mockReset()
    validateWorkItemParentMock.mockReset()
    getResolvedProjectLinkForWorkItemUpdateMock.mockReset()
    getClampedNotifiedMentionCountsMock.mockReset()
    createNotificationMock.mockReset()

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
    requireEditableTeamDocMock.mockResolvedValue({
      id: "team_1",
      name: "Launch",
      workspaceId: "workspace_1",
      settings: {},
    })
    requireReadableDocumentAccessMock.mockResolvedValue("member")
    requireEditableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableTeamAccessMock.mockResolvedValue("member")
    requireReadableWorkspaceAccessMock.mockResolvedValue("member")
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
      subscriberIds: [],
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
    getResolvedProjectLinkForWorkItemUpdateMock.mockReturnValue({
      cascadeItemIds: [],
      resolvedPrimaryProjectId: null,
      shouldCascadeProjectLink: false,
    })
    listLabelsByWorkspaceMock.mockResolvedValue([])
    listPrivateWorkItemsByCreatorMock.mockResolvedValue([])
    listWorkItemActivitiesByWorkItemsMock.mockResolvedValue([])
    getClampedNotifiedMentionCountsMock.mockReturnValue({})
    createNotificationMock.mockImplementation(
      (
        userId: string,
        actorId: string,
        message: string,
        entityType: string,
        entityId: string,
        type: string
      ) => ({
        id: "notification_1",
        userId,
        actorId,
        message,
        entityType,
        entityId,
        type,
      })
    )
  })

  it("rejects invalid schedule strings on create before inserting", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
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

  it("rejects non task types for private work items", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        teamId: null,
        workspaceId: "workspace_1",
        type: "epic",
        title: "Private epic",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
        visibility: "private",
      })
    ).rejects.toThrow("Private tasks can only use task and sub-task types")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects private creates with a team", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        teamId: "team_1",
        workspaceId: "workspace_1",
        type: "task",
        title: "Private task with team",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
        visibility: "private",
      })
    ).rejects.toThrow("Private tasks cannot belong to a team")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects workspace labels on private creates before inserting", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    listLabelsByWorkspaceMock.mockResolvedValue([
      {
        id: "label_1",
        workspaceId: "workspace_1",
        scopeType: "workspace",
        ownerId: null,
      },
    ])

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        teamId: null,
        workspaceId: "workspace_1",
        type: "task",
        title: "Private task with label",
        primaryProjectId: null,
        assigneeId: null,
        labelIds: ["label_1"],
        priority: "medium",
        visibility: "private",
      })
    ).rejects.toThrow("One or more labels are invalid")

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("stores owner-private labels on private creates", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    listLabelsByWorkspaceMock.mockResolvedValue([
      {
        id: "label_private",
        workspaceId: "workspace_1",
        scopeType: "private",
        ownerId: "user_1",
      },
    ])

    await createWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      teamId: null,
      workspaceId: "workspace_1",
      type: "task",
      title: "Private task with label",
      primaryProjectId: null,
      assigneeId: null,
      labelIds: ["label_private"],
      priority: "medium",
      visibility: "private",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItems",
      expect.objectContaining({
        labelIds: ["label_private"],
        visibility: "private",
      })
    )
  })

  it("drops assignees from private creates before storing or notifying", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    mockEmptyQueryCollect(ctx)

    const result = await createWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      teamId: null,
      workspaceId: "workspace_1",
      type: "task",
      title: "Private task",
      primaryProjectId: "project_1",
      assigneeId: "user_2",
      priority: "medium",
      visibility: "private",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItems",
      expect.objectContaining({
        assigneeId: null,
        key: "PVT-001",
        labelIds: [],
        primaryProjectId: null,
        visibility: "private",
        workspaceId: "workspace_1",
      })
    )
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        kind: "item-description",
        teamId: null,
        workspaceId: "workspace_1",
      })
    )
    expect(requireEditableTeamDocMock).not.toHaveBeenCalled()
    expect(requireReadableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
    expect(createNotificationMock).not.toHaveBeenCalled()
    expect(result.assignmentEmails).toEqual([])
  })

  it("numbers private creates by current user and workspace", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    mockEmptyQueryCollect(ctx)
    listPrivateWorkItemsByCreatorMock.mockResolvedValue([
      {
        id: "private_1",
        creatorId: "user_1",
        key: "PVT-001",
        teamId: null,
        workspaceId: "workspace_1",
        visibility: "private",
      },
      {
        id: "private_2",
        creatorId: "user_1",
        key: "PVT-002",
        teamId: null,
        workspaceId: "workspace_2",
        visibility: "private",
      },
    ])

    await createWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      teamId: null,
      workspaceId: "workspace_1",
      type: "task",
      title: "Private task",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      visibility: "private",
    })

    expect(listPrivateWorkItemsByCreatorMock).toHaveBeenCalledWith(
      ctx,
      "user_1"
    )
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItems",
      expect.objectContaining({
        key: "PVT-002",
        visibility: "private",
      })
    )
  })

  it("creates work items with empty description documents", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    mockEmptyQueryCollect(ctx)

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
      bodySource: "convex-html",
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: "user_1",
      updatedBy: "user_1",
      createdAt: "2026-04-20T22:20:00.000Z",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
  })

  it("rejects duplicate client-supplied work item ids before inserting", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        id: "item_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })
    ).rejects.toThrow("Work item id already exists")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects duplicate client-supplied description document ids before inserting", async () => {
    const { createWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        descriptionDocId: "doc_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })
    ).rejects.toThrow("Description document id already exists")

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects invalid schedule strings on update before patching", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
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

  it("uses item-level private access before updating work items", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expectPrivateWorkItemMutationDenied({
      ctx,
      itemId: "item_1",
      mock: requireEditableWorkItemAccessMock,
      mutate: () =>
        updateWorkItemHandler(ctx as never, {
          serverToken: "server_token",
          currentUserId: "user_2",
          origin: "https://app.example.com",
          itemId: "item_1",
          patch: {
            title: "Updated title",
          },
        }),
      userId: "user_2",
    })
  })

  it("ignores private work item assignee and project patches on update", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    const privateItem = {
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      type: "task",
      title: "Private task",
      updatedAt: "2026-04-20T22:00:00.000Z",
      parentId: null,
      primaryProjectId: "project_1",
      startDate: null,
      targetDate: null,
      descriptionDocId: "doc_1",
      assigneeId: "user_1",
      creatorId: "user_1",
      status: "todo",
      visibility: "private",
    }
    getWorkItemDocMock.mockResolvedValue(privateItem)
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([privateItem]),
      })),
    })
    validateWorkItemParentMock.mockResolvedValue(null)

    await updateWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      itemId: "item_1",
      patch: {
        assigneeId: "user_2",
        primaryProjectId: "project_2",
        status: "done",
      },
    })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "db_item_1",
      expect.objectContaining({
        assigneeId: null,
        assigneeIds: [],
        primaryProjectId: null,
        status: "done",
        title: "Private task",
      })
    )
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it("rejects workspace labels on private work item updates", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue(createPrivateWorkItemDoc())
    listLabelsByWorkspaceMock.mockResolvedValue([
      {
        id: "label_1",
        workspaceId: "workspace_1",
        scopeType: "workspace",
        ownerId: null,
      },
    ])

    await expect(
      updateWorkItemHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        itemId: "item_1",
        patch: {
          labelIds: ["label_1"],
        },
      })
    ).rejects.toThrow("One or more labels are invalid")

    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("updates owner-private labels on private work items", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue(createPrivateWorkItemDoc())
    listLabelsByWorkspaceMock.mockResolvedValue([
      {
        id: "label_private",
        workspaceId: "workspace_1",
        scopeType: "private",
        ownerId: "user_1",
      },
    ])

    await updateWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      itemId: "item_1",
      patch: {
        labelIds: ["label_private"],
      },
    })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "db_item_1",
      expect.objectContaining({
        labelIds: ["label_private"],
        primaryProjectId: null,
      })
    )
  })

  it("updates private subtasks without revalidating an unchanged parent through a team", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    const privateSubtask = {
      _id: "db_item_1",
      id: "item_1",
      teamId: null,
      workspaceId: "workspace_1",
      type: "sub-task",
      title: "Private subtask",
      updatedAt: "2026-04-20T22:00:00.000Z",
      parentId: "parent_1",
      primaryProjectId: null,
      startDate: null,
      targetDate: null,
      descriptionDocId: "doc_1",
      assigneeId: null,
      creatorId: "user_1",
      subscriberIds: [],
      status: "todo",
      visibility: "private",
    }
    getWorkItemDocMock.mockResolvedValue(privateSubtask)
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([privateSubtask]),
      })),
    })

    await updateWorkItemHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      itemId: "item_1",
      patch: {
        status: "done",
      },
    })

    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "db_item_1",
      expect.objectContaining({
        status: "done",
        title: "Private subtask",
      })
    )
  })

  it("treats any provided expectedUpdatedAt value as a CAS guard", async () => {
    const { updateWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
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
    const { persistCollaborationWorkItemHandler } =
      await import("@/convex/app/work_item_handlers")
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
    expect(ctx.db.patch).toHaveBeenNthCalledWith(3, "db_item_1", {
      linkedDocumentIds: [],
      linkedWorkItemIds: [],
      referencedProjectIds: [],
      referencedViewIds: [],
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
    expect(validateWorkItemParentMock).not.toHaveBeenCalled()
  })

  it("shifts timeline dates in calendar-day space when moving a scheduled item", async () => {
    const { shiftTimelineItemHandler } =
      await import("@/convex/app/work_item_handlers")
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

  it("patches description documents only when title or content changes", async () => {
    const { patchWorkItemDescriptionDocument } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    const existing = {
      _id: "db_item_1",
      id: "item_1",
      descriptionDocId: "doc_1",
      teamId: "team_1",
    }

    await patchWorkItemDescriptionDocument(ctx as never, {
      existing: existing as never,
      nextTitle: "Launch task",
      nextDescription: undefined,
      currentUserId: "user_1",
      now: "2026-04-20T22:20:00.000Z",
      titleChanged: false,
    })
    expect(getDocumentDocMock).not.toHaveBeenCalled()

    await patchWorkItemDescriptionDocument(ctx as never, {
      existing: existing as never,
      nextTitle: "Updated title",
      nextDescription: "<p>Updated</p>",
      currentUserId: "user_1",
      now: "2026-04-20T22:20:00.000Z",
      titleChanged: true,
    })

    expect(ctx.db.patch).toHaveBeenCalledWith("db_doc_1", {
      content: "<p>Updated</p>",
      notifiedMentionCounts: {},
      title: "Updated title description",
      updatedAt: "2026-04-20T22:20:00.000Z",
      updatedBy: "user_1",
    })
    expect(ctx.db.patch).toHaveBeenCalledWith("db_item_1", {
      linkedDocumentIds: [],
      linkedWorkItemIds: [],
      referencedProjectIds: [],
      referencedViewIds: [],
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
  })

  it("creates assignment emails only for changed assignees with email preferences", async () => {
    const { createAssignmentNotificationForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()
    const existing = {
      id: "item_1",
      assigneeId: null,
    }
    const args = {
      currentUserId: "user_1",
      patch: {
        assigneeId: "user_2",
      },
    }

    getUserDocMock.mockResolvedValue({
      id: "user_2",
      email: "sam@example.com",
      name: "Sam",
      preferences: {
        emailAssignments: true,
      },
    })

    await expect(
      createAssignmentNotificationForWorkItemUpdate(ctx as never, {
        args: args as never,
        existing: existing as never,
        actorName: "Alex",
        teamName: "Launch",
        nextTitle: "Launch task",
      })
    ).resolves.toEqual([
      {
        notificationId: "notification_1",
        email: "sam@example.com",
        name: "Sam",
        itemTitle: "Launch task",
        itemId: "item_1",
        actorName: "Alex",
        teamName: "Launch",
      },
    ])
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        id: "notification_1",
      })
    )

    await expect(
      createAssignmentNotificationForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeId: "user_2",
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: "user_2",
        } as never,
        actorName: "Alex",
        teamName: "Launch",
        nextTitle: "Launch task",
      })
    ).resolves.toEqual([])
  })

  it("creates assignment notifications for each newly added assignee", async () => {
    const { createAssignmentNotificationForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    getUserDocMock.mockImplementation(async (_ctx, userId: string) => ({
      id: userId,
      email: `${userId}@example.com`,
      name: userId,
      preferences: {
        emailAssignments: userId === "user_3",
      },
    }))

    await expect(
      createAssignmentNotificationForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeIds: ["user_2", "user_3"],
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: "user_2",
          assigneeIds: ["user_2"],
        } as never,
        actorName: "Alex",
        teamName: "Launch",
        nextTitle: "Launch task",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        email: "user_3@example.com",
        name: "user_3",
      }),
    ])
    expect(ctx.db.insert).toHaveBeenCalledTimes(1)
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user_3",
      "user_1",
      expect.any(String),
      "workItem",
      "item_1",
      "assignment"
    )
  })

  it("does not create assignment notifications for private work item updates", async () => {
    const { createAssignmentNotificationForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createAssignmentNotificationForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeId: "user_2",
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: null,
          visibility: "private",
        } as never,
        actorName: "Alex",
        teamName: "Launch",
        nextTitle: "Private task",
      })
    ).resolves.toEqual([])
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("creates status notifications for the resolved assignee and subscribers on status changes", async () => {
    const { createStatusChangeNotificationForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await createStatusChangeNotificationForWorkItemUpdate(ctx as never, {
      args: {
        currentUserId: "user_1",
        patch: {
          status: "done",
        },
      } as never,
      existing: {
        id: "item_1",
        assigneeId: "user_2",
        subscriberIds: ["user_3"],
        status: "todo",
      } as never,
      actorName: "Alex",
      teamName: "Launch",
      nextTitle: "Launch task",
    })
    expect(ctx.db.insert).toHaveBeenCalledTimes(2)
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        id: "notification_1",
      })
    )
    expect(createNotificationMock).toHaveBeenNthCalledWith(
      1,
      "user_2",
      "user_1",
      expect.stringContaining('moved "Launch task" to Done'),
      "workItem",
      "item_1",
      "status-change"
    )
    expect(createNotificationMock).toHaveBeenNthCalledWith(
      2,
      "user_3",
      "user_1",
      expect.stringContaining('moved "Launch task" to Done'),
      "workItem",
      "item_1",
      "status-change"
    )

    ctx.db.insert.mockClear()
    await createStatusChangeNotificationForWorkItemUpdate(ctx as never, {
      args: {
        currentUserId: "user_1",
        patch: {
          status: "todo",
        },
      } as never,
      existing: {
        id: "item_1",
        assigneeId: "user_2",
        subscriberIds: [],
        status: "todo",
      } as never,
      actorName: "Alex",
      teamName: "Launch",
      nextTitle: "Launch task",
    })
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("records status change activity independently of notification recipients", async () => {
    const { createStatusChangeActivityForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createStatusChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            status: "done",
          },
        } as never,
        existing: {
          id: "item_1",
          status: "todo",
        } as never,
        now: "2026-04-20T22:20:00.000Z",
      })
    ).resolves.toMatchObject({
      itemId: "item_1",
      actorId: "user_1",
      type: "status-change",
      fromStatus: "todo",
      toStatus: "done",
      createdAt: "2026-04-20T22:20:00.000Z",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItemActivities",
      expect.objectContaining({
        itemId: "item_1",
        fromStatus: "todo",
        toStatus: "done",
      })
    )

    ctx.db.insert.mockClear()
    await expect(
      createStatusChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            status: "todo",
          },
        } as never,
        existing: {
          id: "item_1",
          status: "todo",
        } as never,
        now: "2026-04-20T22:20:00.000Z",
      })
    ).resolves.toBeNull()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("records label change activity when labels change", async () => {
    const { createLabelChangeActivityForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createLabelChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            labelIds: ["label_2", "label_1"],
          },
        } as never,
        existing: {
          id: "item_1",
          labelIds: ["label_1"],
        } as never,
        now: "2026-04-20T22:25:00.000Z",
      })
    ).resolves.toMatchObject({
      itemId: "item_1",
      actorId: "user_1",
      type: "label-change",
      fromLabelIds: ["label_1"],
      toLabelIds: ["label_1", "label_2"],
      createdAt: "2026-04-20T22:25:00.000Z",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItemActivities",
      expect.objectContaining({
        itemId: "item_1",
        type: "label-change",
        fromLabelIds: ["label_1"],
        toLabelIds: ["label_1", "label_2"],
      })
    )

    ctx.db.insert.mockClear()
    await expect(
      createLabelChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            labelIds: ["label_1"],
          },
        } as never,
        existing: {
          id: "item_1",
          labelIds: ["label_1"],
        } as never,
        now: "2026-04-20T22:25:00.000Z",
      })
    ).resolves.toBeNull()
    expect(ctx.db.insert).not.toHaveBeenCalled()

  })

  it("records assignee change activity when assignees change", async () => {
    const { createAssigneeChangeActivityForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await expect(
      createAssigneeChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeIds: ["user_2", "user_3"],
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: "user_2",
          assigneeIds: ["user_2"],
        } as never,
        now: "2026-04-20T22:30:00.000Z",
      })
    ).resolves.toMatchObject({
      itemId: "item_1",
      actorId: "user_1",
      type: "assignee-change",
      fromAssigneeIds: ["user_2"],
      toAssigneeIds: ["user_2", "user_3"],
      createdAt: "2026-04-20T22:30:00.000Z",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "workItemActivities",
      expect.objectContaining({
        itemId: "item_1",
        type: "assignee-change",
        fromAssigneeIds: ["user_2"],
        toAssigneeIds: ["user_2", "user_3"],
      })
    )

    ctx.db.insert.mockClear()
    await expect(
      createAssigneeChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeIds: ["user_2"],
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: "user_2",
          assigneeIds: ["user_2"],
        } as never,
        now: "2026-04-20T22:30:00.000Z",
      })
    ).resolves.toBeNull()
    expect(ctx.db.insert).not.toHaveBeenCalled()

    await expect(
      createAssigneeChangeActivityForWorkItemUpdate(ctx as never, {
        args: {
          currentUserId: "user_1",
          patch: {
            assigneeId: "user_2",
          },
        } as never,
        existing: {
          id: "item_1",
          assigneeId: null,
          visibility: "private",
        } as never,
        now: "2026-04-20T22:30:00.000Z",
      })
    ).resolves.toBeNull()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("does not create status notifications for private work item updates", async () => {
    const { createStatusChangeNotificationForWorkItemUpdate } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    await createStatusChangeNotificationForWorkItemUpdate(ctx as never, {
      args: {
        currentUserId: "user_1",
        patch: {
          status: "done",
        },
      } as never,
      existing: {
        id: "item_1",
        assigneeId: "user_1",
        status: "todo",
        visibility: "private",
      } as never,
      actorName: "Alex",
      teamName: "Launch",
      nextTitle: "Private task",
    })

    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("sets work item subscriptions explicitly", async () => {
    const { setWorkItemSubscriptionHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

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
      creatorId: "user_2",
      subscriberIds: ["user_2"],
      status: "todo",
      visibility: "team",
    })

    await expect(
      setWorkItemSubscriptionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        itemId: "item_1",
        subscribed: true,
      })
    ).resolves.toEqual({ subscribed: true })
    expect(ctx.db.patch).toHaveBeenCalledWith("db_item_1", {
      subscriberIds: ["user_2", "user_1"],
      updatedAt: "2026-04-20T22:20:00.000Z",
    })

    ctx.db.patch.mockClear()
    await expect(
      setWorkItemSubscriptionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        itemId: "item_1",
        subscribed: false,
      })
    ).resolves.toEqual({ subscribed: false })
    expect(ctx.db.patch).toHaveBeenCalledWith("db_item_1", {
      subscriberIds: ["user_2"],
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
  })

  it("rejects private work item subscriptions", async () => {
    const { setWorkItemSubscriptionHandler } =
      await import("@/convex/app/work_item_handlers")
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue({
      _id: "db_item_1",
      id: "item_1",
      teamId: "team_1",
      type: "task",
      title: "Private task",
      updatedAt: "2026-04-20T22:00:00.000Z",
      parentId: null,
      primaryProjectId: null,
      startDate: null,
      targetDate: null,
      descriptionDocId: "doc_1",
      assigneeId: null,
      creatorId: "user_1",
      subscriberIds: [],
      status: "todo",
      visibility: "private",
    })

    await expect(
      setWorkItemSubscriptionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        itemId: "item_1",
        subscribed: true,
      })
    ).rejects.toThrow("Private tasks do not support subscriptions")
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })
})
