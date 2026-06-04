import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getCommentDocMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getProjectDocMock = vi.fn()
const getWorkItemByDescriptionDocIdMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const getTeamMemberIdsMock = vi.fn()
const listCommentsByTargetMock = vi.fn()
const requireEditableDocumentAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const requireReadableDocumentAccessMock = vi.fn()
const getViewDocMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireReadableWorkItemAccessMock = vi.fn()
const requireReadableWorkspaceAccessMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const queueMentionAndCommentEmailJobsMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "comment_1",
  getNow: () => "2026-04-17T20:24:45.000Z",
}))

vi.mock("@/convex/app/data", async () => {
  const { createEmptyConvexRelationshipDataMocks } = await import(
    "@/tests/lib/fixtures/convex"
  )

  return {
    ...createEmptyConvexRelationshipDataMocks(),
    getCommentDoc: getCommentDocMock,
    getDocumentDoc: getDocumentDocMock,
    getProjectDoc: getProjectDocMock,
    getWorkItemByDescriptionDocId: getWorkItemByDescriptionDocIdMock,
    getWorkItemDoc: getWorkItemDocMock,
    getViewDoc: getViewDocMock,
    listCommentsByTarget: listCommentsByTargetMock,
    listUsersByIds: listUsersByIdsMock,
  }
})

vi.mock("@/convex/app/access", async () => {
  const { getTestWorkItemAudienceUserIds } =
    await import("@/tests/lib/fixtures/convex")

  return {
    getWorkItemAudienceUserIds: vi.fn(getTestWorkItemAudienceUserIds),
    requireEditableDocumentAccess: requireEditableDocumentAccessMock,
    requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
    requireReadableDocumentAccess: requireReadableDocumentAccessMock,
    requireReadableTeamAccess: requireReadableTeamAccessMock,
    requireReadableWorkItemAccess: requireReadableWorkItemAccessMock,
    requireReadableWorkspaceAccess: requireReadableWorkspaceAccessMock,
  }
})

vi.mock("@/convex/app/conversations", () => ({
  getTeamMemberIds: getTeamMemberIdsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
  queueMentionAndCommentEmailJobs: queueMentionAndCommentEmailJobsMock,
}))

function createCtx() {
  return {
    db: {
      delete: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    },
  }
}

function mockWorkItemCommentReactionTarget(
  workItemOverrides: Record<string, unknown> = {}
) {
  getCommentDocMock.mockResolvedValue({
    _id: "comment_1_db",
    id: "comment_1",
    targetType: "workItem",
    targetId: "item_1",
    reactions: [],
  })
  getWorkItemDocMock.mockResolvedValue({
    _id: "item_1_db",
    id: "item_1",
    teamId: "team_1",
    visibility: "team",
    creatorId: "user_1",
    assigneeId: null,
    assigneeIds: [],
    ...workItemOverrides,
  })
}

describe("comment handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getCommentDocMock.mockReset()
    getDocumentDocMock.mockReset()
    getProjectDocMock.mockReset()
    getWorkItemByDescriptionDocIdMock.mockReset()
    getWorkItemDocMock.mockReset()
    getViewDocMock.mockReset()
    listUsersByIdsMock.mockReset()
    listCommentsByTargetMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireReadableTeamAccessMock.mockReset()
    requireReadableWorkItemAccessMock.mockReset()
    requireReadableWorkspaceAccessMock.mockReset()
    getTeamMemberIdsMock.mockReset()
    queueEmailJobsMock.mockReset()
    queueMentionAndCommentEmailJobsMock.mockReset()

    listCommentsByTargetMock.mockResolvedValue([])
    listUsersByIdsMock.mockResolvedValue([
      {
        id: "user_1",
        name: "Alex",
        handle: "alex",
        email: "alex@example.com",
        preferences: {
          emailMentions: true,
        },
      },
      {
        id: "user_2",
        name: "Blake",
        handle: "blake",
        email: "blake@example.com",
        preferences: {
          emailMentions: true,
        },
      },
    ])
    requireEditableDocumentAccessMock.mockResolvedValue("member")
    requireEditableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableDocumentAccessMock.mockResolvedValue("member")
    requireReadableTeamAccessMock.mockResolvedValue("member")
    requireReadableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableWorkspaceAccessMock.mockResolvedValue("member")
    getTeamMemberIdsMock.mockResolvedValue(["user_1", "user_2"])
  })

  it("uses item-level private access before adding work item comments", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Private task",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
      subscriberIds: ["user_1"],
    })
    requireEditableWorkItemAccessMock.mockRejectedValueOnce(
      new Error("Work item not found")
    )

    await expect(
      addCommentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        origin: "https://app.example.com",
        targetType: "workItem",
        targetId: "item_1",
        content: "<p>Blocked</p>",
      })
    ).rejects.toThrow("Work item not found")

    expect(ctx.db.patch).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("rejects comments on editable private work items", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: null,
      title: "Private task",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: [],
    })

    await expect(
      addCommentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        targetType: "workItem",
        targetId: "item_1",
        content: "<p>No thread</p>",
      })
    ).rejects.toThrow("Comments are not available on private tasks")

    expect(ctx.db.patch).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("uses a supplied client comment id when adding work item comments", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    getCommentDocMock.mockResolvedValue(null)
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Task",
      visibility: "team",
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: ["user_1"],
    })

    const result = await addCommentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      commentId: "comment_client",
      origin: "https://app.example.com",
      targetType: "workItem",
      targetId: "item_1",
      content: "<p>Saved with client id</p>",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        id: "comment_client",
        content: "<p>Saved with client id</p>",
      })
    )
    expect(result.commentId).toBe("comment_client")
  })

  it("stores replies to replies on the root parent comment", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()
    const rootComment = {
      _id: "comment_root_db",
      id: "comment_root",
      targetType: "workItem",
      targetId: "item_1",
      parentCommentId: null,
      content: "<p>Root</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_1",
      createdAt: "2026-04-17T20:24:45.000Z",
    }
    const replyComment = {
      ...rootComment,
      _id: "comment_reply_db",
      id: "comment_reply",
      parentCommentId: "comment_root",
      content: "<p>Reply</p>",
      createdBy: "user_2",
    }

    getCommentDocMock.mockImplementation(async (_ctx, commentId: string) => {
      if (commentId === "comment_root") {
        return rootComment
      }

      if (commentId === "comment_reply") {
        return replyComment
      }

      return null
    })
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Task",
      visibility: "team",
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: [],
    })

    await addCommentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      commentId: "comment_client",
      origin: "https://app.example.com",
      targetType: "workItem",
      targetId: "item_1",
      parentCommentId: "comment_reply",
      content: "<p>Flatten me</p>",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        id: "comment_client",
        parentCommentId: "comment_root",
        content: "<p>Flatten me</p>",
      })
    )
  })

  it("stores comment preview metadata on work item comment notifications", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    getCommentDocMock.mockResolvedValue(null)
    getTeamMemberIdsMock.mockResolvedValue(["user_1", "user_2"])
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Task",
      visibility: "team",
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: ["user_2"],
    })

    const result = await addCommentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      commentId: "comment_client",
      origin: "https://app.example.com",
      targetType: "workItem",
      targetId: "item_1",
      content: "<p>Ship it with retries</p>",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        userId: "user_2",
        type: "comment",
        contentPreview: "Ship it with retries",
        targetCommentId: "comment_client",
      })
    )
    expect(result.notificationUserIds).toEqual(["user_2"])
  })

  it("persists allowed rich text references on comments", async () => {
    const { addCommentHandler } = await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    getCommentDocMock.mockResolvedValue(null)
    getWorkItemDocMock.mockImplementation(async (_ctx, itemId: string) => ({
      _id: `${itemId}_db`,
      id: itemId,
      teamId: "team_1",
      title: itemId === "item_2" ? "Referenced task" : "Task",
      visibility: "team",
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: [],
    }))
    getDocumentDocMock.mockResolvedValue({
      _id: "document_1_db",
      id: "document_1",
      kind: "team-document",
      teamId: "team_1",
      workspaceId: "workspace_1",
    })
    getProjectDocMock.mockResolvedValue({
      _id: "project_1_db",
      id: "project_1",
      scopeType: "team",
      scopeId: "team_1",
    })
    getViewDocMock.mockResolvedValue({
      _id: "view_1_db",
      id: "view_1",
      scopeType: "team",
      scopeId: "team_1",
    })

    await addCommentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      commentId: "comment_client",
      origin: "https://app.example.com",
      targetType: "workItem",
      targetId: "item_1",
      content: [
        '<a data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_2" href="/items/item_2">Referenced task</a>',
        '<a data-type="entity-reference" data-reference-type="document" data-reference-id="document_1" href="/docs/document_1">Referenced doc</a>',
        '<a data-type="entity-reference" data-reference-type="project" data-reference-id="project_1" href="/projects/project_1">Referenced project</a>',
        '<a data-type="entity-reference" data-reference-type="view" data-reference-id="view_1" href="/views/view_1">Referenced view</a>',
      ].join(""),
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        id: "comment_client",
        referencedWorkItemIds: ["item_2"],
        referencedDocumentIds: ["document_1"],
        referencedProjectIds: ["project_1"],
        referencedViewIds: ["view_1"],
      })
    )
  })

  it("uses item-level private access before toggling work item comment reactions", async () => {
    const { toggleCommentReactionHandler } =
      await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    mockWorkItemCommentReactionTarget({
      visibility: "private",
    })
    requireReadableWorkItemAccessMock.mockRejectedValueOnce(
      new Error("Work item not found")
    )

    await expect(
      toggleCommentReactionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        commentId: "comment_1",
        emoji: "like",
      })
    ).rejects.toThrow("Work item not found")

    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("returns the comment target after toggling comment reactions", async () => {
    const { toggleCommentReactionHandler } =
      await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    mockWorkItemCommentReactionTarget()

    await expect(
      toggleCommentReactionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        commentId: "comment_1",
        emoji: "like",
      })
    ).resolves.toMatchObject({
      commentId: "comment_1",
      targetType: "workItem",
      targetId: "item_1",
    })
  })

  it("rejects reactions on existing private work item comments", async () => {
    const { toggleCommentReactionHandler } =
      await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

    mockWorkItemCommentReactionTarget({
      teamId: null,
      visibility: "private",
    })

    await expect(
      toggleCommentReactionHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        commentId: "comment_1",
        emoji: "like",
      })
    ).rejects.toThrow("Comments are not available on private tasks")

    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("deletes a comment with its descendant replies after owner and target access checks", async () => {
    const { deleteCommentHandler } =
      await import("@/convex/app/comment_handlers")
    const ctx = createCtx()
    const rootComment = {
      _id: "comment_root_db",
      id: "comment_root",
      targetType: "workItem",
      targetId: "item_1",
      parentCommentId: null,
      content: "<p>Root</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_1",
      createdAt: "2026-04-17T20:24:45.000Z",
    }
    const replyComment = {
      _id: "comment_reply_db",
      id: "comment_reply",
      targetType: "workItem",
      targetId: "item_1",
      parentCommentId: "comment_root",
      content: "<p>Reply</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_2",
      createdAt: "2026-04-17T20:25:45.000Z",
    }

    getCommentDocMock.mockResolvedValue(rootComment)
    listCommentsByTargetMock.mockResolvedValue([rootComment, replyComment])
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Task",
      visibility: "team",
      creatorId: "user_1",
      assigneeId: null,
      subscriberIds: [],
    })

    await expect(
      deleteCommentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        commentId: "comment_root",
      })
    ).resolves.toMatchObject({
      ok: true,
      deletedCommentIds: ["comment_root", "comment_reply"],
      targetType: "workItem",
      targetId: "item_1",
    })

    expect(requireEditableWorkItemAccessMock).toHaveBeenCalled()
    expect(ctx.db.delete).toHaveBeenCalledWith("comment_root_db")
    expect(ctx.db.delete).toHaveBeenCalledWith("comment_reply_db")
  })
})
