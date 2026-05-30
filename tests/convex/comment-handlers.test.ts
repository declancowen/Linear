import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getCommentDocMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getWorkItemByDescriptionDocIdMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const listCommentsByTargetMock = vi.fn()
const requireEditableDocumentAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const requireReadableDocumentAccessMock = vi.fn()
const requireReadableWorkItemAccessMock = vi.fn()
const getTeamMemberIdsMock = vi.fn()
const queueEmailJobsMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: () => "comment_1",
  getNow: () => "2026-04-17T20:24:45.000Z",
}))

vi.mock("@/convex/app/data", () => ({
  getCommentDoc: getCommentDocMock,
  getDocumentDoc: getDocumentDocMock,
  getWorkItemByDescriptionDocId: getWorkItemByDescriptionDocIdMock,
  getWorkItemDoc: getWorkItemDocMock,
  listCommentsByTarget: listCommentsByTargetMock,
  listUsersByIds: listUsersByIdsMock,
}))

vi.mock("@/convex/app/access", async () => {
  const { getTestWorkItemAudienceUserIds } =
    await import("@/tests/lib/fixtures/convex")

  return {
    getWorkItemAudienceUserIds: vi.fn(getTestWorkItemAudienceUserIds),
    requireEditableDocumentAccess: requireEditableDocumentAccessMock,
    requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
    requireReadableDocumentAccess: requireReadableDocumentAccessMock,
    requireReadableWorkItemAccess: requireReadableWorkItemAccessMock,
  }
})

vi.mock("@/convex/app/conversations", () => ({
  getTeamMemberIds: getTeamMemberIdsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
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

describe("comment handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getCommentDocMock.mockReset()
    getDocumentDocMock.mockReset()
    getWorkItemByDescriptionDocIdMock.mockReset()
    getWorkItemDocMock.mockReset()
    listUsersByIdsMock.mockReset()
    listCommentsByTargetMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireReadableWorkItemAccessMock.mockReset()
    getTeamMemberIdsMock.mockReset()
    queueEmailJobsMock.mockReset()

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
    requireReadableWorkItemAccessMock.mockResolvedValue("member")
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

  it("uses item-level private access before toggling work item comment reactions", async () => {
    const { toggleCommentReactionHandler } =
      await import("@/convex/app/comment_handlers")
    const ctx = createCtx()

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
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
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
