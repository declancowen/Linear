import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getCommentDocMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getWorkItemByDescriptionDocIdMock = vi.fn()
const getWorkItemDocMock = vi.fn()
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
}))

vi.mock("@/convex/app/access", () => ({
  getWorkItemAudienceUserIds: vi.fn(
    (
      item: {
        assigneeId?: string | null
        creatorId?: string | null
        visibility?: "team" | "private" | null
      },
      teamMemberIds: string[]
    ) =>
    (item.visibility ?? "team") === "private"
      ? [
          ...new Set(
            [item.creatorId, item.assigneeId].filter(
              (userId): userId is string => Boolean(userId)
            )
          ),
        ].filter((userId) => teamMemberIds.includes(userId))
      : teamMemberIds
  ),
  requireEditableDocumentAccess: requireEditableDocumentAccessMock,
  requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
  requireReadableDocumentAccess: requireReadableDocumentAccessMock,
  requireReadableWorkItemAccess: requireReadableWorkItemAccessMock,
}))

vi.mock("@/convex/app/conversations", () => ({
  getTeamMemberIds: getTeamMemberIdsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
}))

function createCtx() {
  return {
    db: {
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
    listCommentsByTargetMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireReadableWorkItemAccessMock.mockReset()
    getTeamMemberIdsMock.mockReset()
    queueEmailJobsMock.mockReset()

    listCommentsByTargetMock.mockResolvedValue([])
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

  it("uses item-level private access before toggling work item comment reactions", async () => {
    const { toggleCommentReactionHandler } = await import(
      "@/convex/app/comment_handlers"
    )
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
})
