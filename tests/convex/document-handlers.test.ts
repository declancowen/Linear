import { beforeEach, describe, expect, it, vi } from "vitest"

const buildMentionEmailJobsMock = vi.fn()
const assertServerTokenMock = vi.fn()
const getDocumentDocMock = vi.fn()
const listActiveUsersByIdsMock = vi.fn()
const requireEditableDocumentAccessMock = vi.fn()
const getTeamMemberIdsMock = vi.fn()
const getWorkspaceUserIdsMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const createNotificationMock = vi.fn()

vi.mock("@/lib/email/builders", () => ({
  buildMentionEmailJobs: buildMentionEmailJobsMock,
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  getNow: () => "2026-04-17T20:24:45.000Z",
  createId: vi.fn(),
}))

vi.mock("@/convex/app/data", () => ({
  getAttachmentDoc: vi.fn(),
  getDocumentDoc: getDocumentDocMock,
  getTeamDoc: vi.fn(),
  getUserDoc: vi.fn(),
  getWorkItemDoc: vi.fn(),
  listActiveUsersByIds: listActiveUsersByIdsMock,
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableDocumentAccess: requireEditableDocumentAccessMock,
  requireEditableTeamAccess: vi.fn(),
  requireEditableWorkspaceAccess: vi.fn(),
  requireReadableDocumentAccess: vi.fn(),
  requireWorkspaceAdminAccess: vi.fn(),
}))

vi.mock("@/convex/app/conversations", () => ({
  getTeamMemberIds: getTeamMemberIdsMock,
  getWorkspaceUserIds: getWorkspaceUserIdsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
}))

vi.mock("@/convex/app/collaboration_utils", () => ({
  createNotification: createNotificationMock,
}))

vi.mock("@/convex/app/assets", () => ({
  resolveAttachmentTarget: vi.fn(),
}))

vi.mock("@/convex/app/lifecycle", () => ({
  deleteDocumentCascade: vi.fn(),
}))

vi.mock("@/convex/app/normalization", () => ({
  listDocumentPresenceViewers: vi.fn(),
  normalizeTeam: vi.fn(),
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

describe("document mention notifications", () => {
  beforeEach(() => {
    buildMentionEmailJobsMock.mockReset()
    assertServerTokenMock.mockReset()
    getDocumentDocMock.mockReset()
    listActiveUsersByIdsMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
    getTeamMemberIdsMock.mockReset()
    getWorkspaceUserIdsMock.mockReset()
    queueEmailJobsMock.mockReset()
    createNotificationMock.mockReset()

    buildMentionEmailJobsMock.mockImplementation(({ emails }) => emails)
    createNotificationMock.mockImplementation(
      (
        userId: string,
        actorId: string,
        message: string,
        entityType: string,
        entityId: string,
        type: string
      ) => ({
        id: `notification_${userId}`,
        userId,
        actorId,
        message,
        entityType,
        entityId,
        type,
      })
    )
    getDocumentDocMock.mockResolvedValue({
      _id: "document_1_db",
      id: "document_1",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Launch Notes",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span></p>',
      createdBy: "user_1",
      updatedBy: "user_1",
    })
    getWorkspaceUserIdsMock.mockResolvedValue(["user_1", "user_2", "user_3"])
    listActiveUsersByIdsMock.mockResolvedValue([
      {
        id: "user_1",
        name: "Alex",
        email: "alex@example.com",
        preferences: {
          emailMentions: true,
        },
      },
      {
        id: "user_2",
        name: "Sam",
        email: "sam@example.com",
        preferences: {
          emailMentions: true,
        },
      },
      {
        id: "user_3",
        name: "Taylor",
        email: "taylor@example.com",
        preferences: {
          emailMentions: true,
        },
      },
    ])
    queueEmailJobsMock.mockResolvedValue(undefined)
  })

  it("allows sending a pending count that is backed by persisted mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } = await import(
      "@/convex/app/document_handlers"
    )
    const ctx = createCtx()

    const result = await sendDocumentMentionNotificationsHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      documentId: "document_1",
      mentions: [
        {
          userId: "user_2",
          count: 1,
        },
      ],
    })

    expect(result).toEqual({
      recipientCount: 1,
      mentionCount: 1,
    })
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user_2",
      "user_1",
      "Alex mentioned you in Launch Notes",
      "document",
      "document_1",
      "mention"
    )
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        userId: "user_2",
      })
    )
    expect(queueEmailJobsMock).toHaveBeenCalledWith(
      ctx,
      expect.arrayContaining([
        expect.objectContaining({
          email: "sam@example.com",
          mentionCount: 1,
        }),
      ])
    )
  })

  it("rejects recipients who are not present in persisted document mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } = await import(
      "@/convex/app/document_handlers"
    )
    const ctx = createCtx()

    await expect(
      sendDocumentMentionNotificationsHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        documentId: "document_1",
        mentions: [
          {
            userId: "user_3",
            count: 1,
          },
        ],
      })
    ).rejects.toThrow("One or more mentioned users are not present in the document")

    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("rejects counts that exceed persisted document mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } = await import(
      "@/convex/app/document_handlers"
    )
    const ctx = createCtx()

    await expect(
      sendDocumentMentionNotificationsHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        documentId: "document_1",
        mentions: [
          {
            userId: "user_2",
            count: 3,
          },
        ],
      })
    ).rejects.toThrow("One or more mentioned users are not present in the document")

    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })
})
