import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createTestNotificationRecord,
  mockEmptyQueryCollect,
} from "@/tests/lib/fixtures/convex"

const buildMentionEmailJobsMock = vi.fn()
const assertServerTokenMock = vi.fn()
const getAttachmentDocMock = vi.fn()
const getDocumentDocMock = vi.fn()
const getProjectDocMock = vi.fn()
const listAttachmentsByStorageIdMock = vi.fn()
const getWorkItemByDescriptionDocIdMock = vi.fn()
const listActiveUsersByIdsMock = vi.fn()
const requireEditableDocumentAccessMock = vi.fn()
const requireEditableWorkItemAccessMock = vi.fn()
const requireReadableDocumentAccessMock = vi.fn()
const requireReadableTeamAccessMock = vi.fn()
const requireReadableWorkItemAccessMock = vi.fn()
const requireReadableWorkspaceAccessMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const getTeamMemberIdsMock = vi.fn()
const getViewDocMock = vi.fn()
const getWorkspaceUserIdsMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const createNotificationMock = vi.fn()
const listDocumentPresenceViewersMock = vi.fn()
type MockDocumentRecord = {
  _id: string
  notifiedMentionCounts?: Record<string, number>
  [key: string]: unknown
}

let documentRecord: MockDocumentRecord

vi.mock("@/lib/email/builders", () => ({
  buildMentionEmailJobs: buildMentionEmailJobsMock,
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  getNow: () => "2026-04-17T20:24:45.000Z",
  createId: vi.fn(),
}))

vi.mock("@/convex/app/data", () => ({
  getAttachmentDoc: getAttachmentDocMock,
  getDocumentDoc: getDocumentDocMock,
  getProjectDoc: getProjectDocMock,
  getTeamDoc: vi.fn(),
  getUserDoc: vi.fn(),
  getViewDoc: getViewDocMock,
  getWorkItemByDescriptionDocId: getWorkItemByDescriptionDocIdMock,
  getWorkItemDoc: getWorkItemDocMock,
  listActiveUsersByIds: listActiveUsersByIdsMock,
  listAttachmentsByStorageId: listAttachmentsByStorageIdMock,
}))

vi.mock("@/convex/app/access", async () => {
  const { getTestWorkItemAudienceUserIds } =
    await import("@/tests/lib/fixtures/convex")

  return {
    getWorkItemAudienceUserIds: vi.fn(getTestWorkItemAudienceUserIds),
    requireEditableDocumentAccess: requireEditableDocumentAccessMock,
    requireEditableTeamAccess: vi.fn(),
    requireEditableWorkItemAccess: requireEditableWorkItemAccessMock,
    requireEditableWorkspaceAccess: vi.fn(),
    requireReadableDocumentAccess: requireReadableDocumentAccessMock,
    requireReadableTeamAccess: requireReadableTeamAccessMock,
    requireReadableWorkItemAccess: requireReadableWorkItemAccessMock,
    requireReadableWorkspaceAccess: requireReadableWorkspaceAccessMock,
    requireWorkspaceAdminAccess: vi.fn(),
  }
})

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
  listDocumentPresenceViewers: listDocumentPresenceViewersMock,
  normalizeTeam: vi.fn(),
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
        if (id === documentRecord._id) {
          documentRecord = {
            ...documentRecord,
            ...value,
          }
        }
      }),
      delete: vi.fn(),
      query: vi.fn(),
    },
    storage: {
      delete: vi.fn(),
      generateUploadUrl: vi.fn(async () => "https://upload.example.com"),
      getMetadata: vi.fn(async () => ({
        contentType: "text/plain",
        size: 12,
      })),
      getUrl: vi.fn(async () => "https://files.example.com/file.txt"),
    },
  }
}

function createPrivateAttachmentWorkItemDoc() {
  return {
    _id: "item_1_db",
    id: "item_1",
    teamId: "team_1",
    visibility: "private",
    creatorId: "user_1",
    assigneeId: null,
  }
}

async function mockPrivateAttachmentTargetAccessDenied() {
  const assets = await import("@/convex/app/assets")
  const data = await import("@/convex/app/data")

  vi.mocked(assets.resolveAttachmentTarget).mockResolvedValue({
    teamId: "team_1",
    entityType: "workItem",
    recordId: "item_1_db" as never,
  })
  vi.mocked(data.getWorkItemDoc).mockResolvedValue(
    createPrivateAttachmentWorkItemDoc() as never
  )
  requireEditableWorkItemAccessMock.mockRejectedValueOnce(
    new Error("Work item not found")
  )
}

async function mockDeletableDocumentAttachment(
  storageAttachments: Array<{ _id: string; storageId: string }>
) {
  const assets = await import("@/convex/app/assets")

  getAttachmentDocMock.mockResolvedValue({
    _id: "attachment_1_db",
    id: "attachment_1",
    targetType: "document",
    targetId: "document_1",
    teamId: null,
    storageId: "storage_1",
  })
  vi.mocked(assets.resolveAttachmentTarget).mockResolvedValue({
    teamId: "team_1",
    entityType: "document",
    recordId: "document_1_db" as never,
  })
  listAttachmentsByStorageIdMock.mockResolvedValue(storageAttachments)
}

describe("document mention notifications", () => {
  beforeEach(() => {
    buildMentionEmailJobsMock.mockReset()
    assertServerTokenMock.mockReset()
    getAttachmentDocMock.mockReset()
    getDocumentDocMock.mockReset()
    getProjectDocMock.mockReset()
    listAttachmentsByStorageIdMock.mockReset()
    listActiveUsersByIdsMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
    requireEditableWorkItemAccessMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireReadableTeamAccessMock.mockReset()
    requireReadableWorkItemAccessMock.mockReset()
    requireReadableWorkspaceAccessMock.mockReset()
    getWorkItemByDescriptionDocIdMock.mockReset()
    getWorkItemDocMock.mockReset()
    getTeamMemberIdsMock.mockReset()
    getViewDocMock.mockReset()
    getWorkspaceUserIdsMock.mockReset()
    queueEmailJobsMock.mockReset()
    createNotificationMock.mockReset()
    listDocumentPresenceViewersMock.mockReset()

    buildMentionEmailJobsMock.mockImplementation(({ emails }) => emails)
    createNotificationMock.mockImplementation(createTestNotificationRecord)
    documentRecord = {
      _id: "document_1_db",
      id: "document_1",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Launch Notes",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span></p>',
      createdBy: "user_1",
      updatedAt: "2026-04-17T20:24:45.000Z",
      updatedBy: "user_1",
    }
    getDocumentDocMock.mockImplementation(async () => documentRecord)
    getWorkspaceUserIdsMock.mockResolvedValue(["user_1", "user_2", "user_3"])
    requireEditableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableDocumentAccessMock.mockResolvedValue("member")
    requireReadableTeamAccessMock.mockResolvedValue("member")
    requireReadableWorkItemAccessMock.mockResolvedValue("member")
    requireReadableWorkspaceAccessMock.mockResolvedValue("member")
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
    listAttachmentsByStorageIdMock.mockResolvedValue([])
  })

  it("allows sending a pending count that is backed by persisted mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
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
    expect(ctx.db.patch).toHaveBeenCalledWith("document_1_db", {
      notifiedMentionCounts: {
        user_2: 1,
      },
    })
  })

  it("rejects recipients who are not present in persisted document mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
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
    ).rejects.toThrow(
      "One or more mentioned users are not present in the document"
    )

    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("rejects counts that exceed persisted document mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
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
    ).rejects.toThrow(
      "One or more mentioned users are not present in the document"
    )

    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("blocks replaying the same mention batch after the remaining unsent count is exhausted", async () => {
    const { sendDocumentMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    documentRecord = {
      ...documentRecord,
      notifiedMentionCounts: {
        user_2: 1,
      },
    }

    await expect(
      sendDocumentMentionNotificationsHandler(ctx as never, {
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
    ).resolves.toEqual({
      recipientCount: 1,
      mentionCount: 1,
    })

    expect(documentRecord.notifiedMentionCounts).toEqual({
      user_2: 2,
    })

    await expect(
      sendDocumentMentionNotificationsHandler(ctx as never, {
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
    ).rejects.toThrow(
      "One or more mentioned users were already notified for this document"
    )
  })

  it("clamps notified mention counts when content updates remove sent mentions", async () => {
    const { updateDocumentContentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    documentRecord = {
      ...documentRecord,
      notifiedMentionCounts: {
        user_2: 2,
      },
    }

    await updateDocumentContentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      documentId: "document_1",
      content: "<p>No mentions remain.</p>",
    })

    expect(ctx.db.patch).toHaveBeenCalledWith("document_1_db", {
      content: "<p>No mentions remain.</p>",
      notifiedMentionCounts: {},
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      linkedDocumentIds: [],
      linkedViewIds: [],
      updatedAt: "2026-04-17T20:24:45.000Z",
      updatedBy: "user_1",
    })
  })

  it("persists allowed document inline references as linked relationships", async () => {
    const { updateDocumentContentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    const content = [
      '<a data-type="entity-reference" data-reference-type="workItem" data-reference-id="item_1" href="/items/item_1">Item</a>',
      '<a data-type="entity-reference" data-reference-type="document" data-reference-id="document_2" href="/docs/document_2">Doc</a>',
      '<a data-type="entity-reference" data-reference-type="project" data-reference-id="project_1" href="/projects/project_1">Project</a>',
      '<a data-type="entity-reference" data-reference-type="view" data-reference-id="view_1" href="/views/view_1">View</a>',
    ].join("")

    getDocumentDocMock.mockImplementation(async (_ctx, documentId: string) =>
      documentId === "document_2"
        ? {
            _id: "document_2_db",
            id: "document_2",
            kind: "team-document",
            workspaceId: "workspace_1",
            teamId: "team_1",
            title: "Reference doc",
          }
        : documentRecord
    )
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      visibility: "team",
      title: "Referenced item",
    })
    getProjectDocMock.mockResolvedValue({
      _id: "project_1_db",
      id: "project_1",
      scopeType: "workspace",
      scopeId: "workspace_1",
    })
    getViewDocMock.mockResolvedValue({
      _id: "view_1_db",
      id: "view_1",
      scopeType: "workspace",
      scopeId: "workspace_1",
    })

    await updateDocumentContentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      documentId: "document_1",
      content,
    })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "document_1_db",
      expect.objectContaining({
        linkedDocumentIds: ["document_2"],
        linkedProjectIds: ["project_1"],
        linkedViewIds: ["view_1"],
        linkedWorkItemIds: ["item_1"],
      })
    )
  })

  it("rejects direct generic updates to work item descriptions", async () => {
    const {
      renameDocumentHandler,
      updateDocumentContentHandler,
      updateDocumentHandler,
    } = await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    documentRecord = {
      ...documentRecord,
      kind: "item-description",
    }

    await expect(
      updateDocumentContentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
        content: "<p>Bypass attempt</p>",
      })
    ).rejects.toThrow(
      "Work item description documents can't be updated directly"
    )
    await expect(
      updateDocumentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Bypass attempt",
      })
    ).rejects.toThrow(
      "Work item description documents can't be updated directly"
    )
    await expect(
      renameDocumentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Bypass attempt",
      })
    ).rejects.toThrow(
      "Work item description documents can't be updated directly"
    )

    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("sends work-item self-mentions through notifications and email jobs", async () => {
    const { sendItemDescriptionMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
    const data = await import("@/convex/app/data")
    const normalization = await import("@/convex/app/normalization")
    const ctx = createCtx()

    documentRecord = {
      _id: "item_description_db",
      id: "document_1",
      kind: "item-description",
      workspaceId: "workspace_1",
      teamId: "team_1",
      title: "Test description",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_1">@alex</span></p>',
      createdBy: "user_1",
      updatedBy: "user_1",
    }

    vi.mocked(data.getWorkItemDoc).mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Test item",
      descriptionDocId: "document_1",
    } as never)
    vi.mocked(data.getTeamDoc).mockResolvedValue({
      _id: "team_1_db",
      id: "team_1",
      name: "Ops",
    } as never)
    vi.mocked(normalization.normalizeTeam).mockReturnValue({
      name: "Ops",
    } as never)
    getTeamMemberIdsMock.mockResolvedValue(["user_1", "user_2"])

    const result = await sendItemDescriptionMentionNotificationsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        itemId: "item_1",
        mentions: [
          {
            userId: "user_1",
            count: 1,
          },
        ],
      }
    )

    expect(result).toEqual({
      recipientCount: 1,
      mentionCount: 1,
    })
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user_1",
      "user_1",
      'Alex mentioned you in the description of "Test item" in Ops',
      "workItem",
      "item_1",
      "mention"
    )
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        userId: "user_1",
        actorId: "user_1",
      })
    )
    expect(queueEmailJobsMock).toHaveBeenCalledWith(
      ctx,
      expect.arrayContaining([
        expect.objectContaining({
          email: "alex@example.com",
          entityId: "item_1",
          mentionCount: 1,
        }),
      ])
    )
    expect(documentRecord.notifiedMentionCounts).toEqual({
      user_1: 1,
    })
  })

  it("rejects private item description mentions outside the work item audience", async () => {
    const { sendItemDescriptionMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
    const data = await import("@/convex/app/data")
    const ctx = createCtx()

    documentRecord = {
      _id: "item_description_db",
      id: "document_1",
      kind: "item-description",
      workspaceId: "workspace_1",
      teamId: "team_1",
      title: "Test description",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_3">@taylor</span></p>',
      createdBy: "user_1",
      updatedBy: "user_1",
    }

    vi.mocked(data.getWorkItemDoc).mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      title: "Test item",
      descriptionDocId: "document_1",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: "user_2",
    } as never)
    getTeamMemberIdsMock.mockResolvedValue(["user_1", "user_2", "user_3"])

    await expect(
      sendItemDescriptionMentionNotificationsHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        itemId: "item_1",
        mentions: [
          {
            userId: "user_3",
            count: 1,
          },
        ],
      })
    ).rejects.toThrow(
      "One or more mentioned users are invalid for this work item"
    )

    expect(createNotificationMock).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("uses work item audience for private item-description document mentions", async () => {
    const { sendDocumentMentionNotificationsHandler } =
      await import("@/convex/app/document_handlers")
    const data = await import("@/convex/app/data")
    const ctx = createCtx()

    documentRecord = {
      _id: "item_description_db",
      id: "document_1",
      kind: "item-description",
      workspaceId: "workspace_1",
      teamId: null,
      title: "Private description",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_3">@taylor</span></p>',
      createdBy: "user_1",
      updatedBy: "user_1",
    }
    vi.mocked(data.getWorkItemByDescriptionDocId).mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: null,
      workspaceId: "workspace_1",
      title: "Private task",
      descriptionDocId: "document_1",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
    } as never)

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
    ).rejects.toThrow(
      "One or more mentioned users are invalid for this document"
    )

    expect(getWorkspaceUserIdsMock).not.toHaveBeenCalled()
    expect(getTeamMemberIdsMock).not.toHaveBeenCalled()
    expect(createNotificationMock).not.toHaveBeenCalled()
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("uses item-level private access before creating work item attachments", async () => {
    const { createAttachmentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    await mockPrivateAttachmentTargetAccessDenied()

    await expect(
      createAttachmentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        targetType: "workItem",
        targetId: "item_1",
        storageId: "storage_1" as never,
        fileName: "notes.txt",
        contentType: "text/plain",
        size: 12,
      })
    ).rejects.toThrow("Work item not found")

    expect(ctx.storage.getMetadata).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("uses item-level private access before issuing work item attachment upload URLs", async () => {
    const { generateAttachmentUploadUrlHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    await mockPrivateAttachmentTargetAccessDenied()

    await expect(
      generateAttachmentUploadUrlHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        targetType: "workItem",
        targetId: "item_1",
      })
    ).rejects.toThrow("Work item not found")

    expect(ctx.storage.generateUploadUrl).not.toHaveBeenCalled()
  })

  it("uses item-level private access before deleting work item attachments", async () => {
    const { deleteAttachmentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    getAttachmentDocMock.mockResolvedValue({
      _id: "attachment_1_db",
      id: "attachment_1",
      targetType: "workItem",
      targetId: "item_1",
      teamId: "team_1",
      storageId: "storage_1",
    })
    await mockPrivateAttachmentTargetAccessDenied()

    await expect(
      deleteAttachmentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_2",
        attachmentId: "attachment_1",
      })
    ).rejects.toThrow("Work item not found")

    expect(ctx.storage.delete).not.toHaveBeenCalled()
    expect(ctx.db.delete).not.toHaveBeenCalled()
  })

  it("requires work item attachments to be removed through description save", async () => {
    const { deleteAttachmentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    getAttachmentDocMock.mockResolvedValue({
      _id: "attachment_1_db",
      id: "attachment_1",
      targetType: "workItem",
      targetId: "item_1",
      teamId: "team_1",
      storageId: "storage_1",
    })
    const assets = await import("@/convex/app/assets")
    vi.mocked(assets.resolveAttachmentTarget).mockResolvedValue({
      teamId: "team_1",
      entityType: "workItem",
      recordId: "item_1_db" as never,
    })
    getWorkItemDocMock.mockResolvedValue({
      _id: "item_1_db",
      id: "item_1",
      teamId: "team_1",
      visibility: "team",
    })

    await expect(
      deleteAttachmentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        attachmentId: "attachment_1",
      })
    ).rejects.toThrow(
      "Work item attachments must be removed by saving the description"
    )
    expect(ctx.storage.delete).not.toHaveBeenCalled()
    expect(ctx.db.delete).not.toHaveBeenCalled()
  })

  it("keeps shared storage when deleting one attachment record", async () => {
    const { deleteAttachmentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    await mockDeletableDocumentAttachment([
      { _id: "attachment_1_db", storageId: "storage_1" },
      { _id: "attachment_2_db", storageId: "storage_1" },
    ])

    await deleteAttachmentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      attachmentId: "attachment_1",
    })

    expect(ctx.storage.delete).not.toHaveBeenCalled()
    expect(ctx.db.delete).toHaveBeenCalledWith("attachment_1_db")
  })

  it("deletes storage when deleting the last attachment record", async () => {
    const { deleteAttachmentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    await mockDeletableDocumentAttachment([
      { _id: "attachment_1_db", storageId: "storage_1" },
    ])

    await deleteAttachmentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      attachmentId: "attachment_1",
    })

    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_1")
    expect(ctx.db.delete).toHaveBeenCalledWith("attachment_1_db")
  })

  it("updates document title and content while preserving mention notification caps", async () => {
    const { updateDocumentHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()

    getDocumentDocMock.mockResolvedValue(documentRecord)
    requireEditableDocumentAccessMock.mockResolvedValue("admin")

    await expect(
      updateDocumentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
      })
    ).resolves.toBeUndefined()
    expect(ctx.db.patch).not.toHaveBeenCalled()

    await expect(
      updateDocumentHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
        expectedUpdatedAt: "2026-04-17T20:24:45.000Z",
        title: "Updated title",
        content:
          '<p><span data-type="mention" data-id="user_2">@sam</span></p>',
      })
    ).resolves.toEqual({
      updatedAt: "2026-04-17T20:24:45.000Z",
    })

    expect(assertServerTokenMock).toHaveBeenCalledWith("server_token")
    expect(requireEditableDocumentAccessMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ id: "document_1" }),
      "user_1"
    )
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "document_1_db",
      expect.objectContaining({
        content:
          '<p><span data-type="mention" data-id="user_2">@sam</span></p>',
        title: "Updated title",
        updatedBy: "user_1",
      })
    )
  })
})

describe("document presence handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getDocumentDocMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    listDocumentPresenceViewersMock.mockReset()

    getDocumentDocMock.mockResolvedValue({
      _id: "document_1_db",
      id: "document_1",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      teamId: null,
      createdBy: "user_1",
      updatedBy: "user_1",
    })
    requireReadableDocumentAccessMock.mockResolvedValue(undefined)
    listDocumentPresenceViewersMock.mockResolvedValue([
      {
        userId: "workos_2",
        name: "Sam",
        avatarUrl: "https://example.com/sam.png",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-17T20:24:45.000Z",
      },
    ])
  })

  it("inserts document presence for a new session and returns other active viewers", async () => {
    const { heartbeatDocumentPresenceHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    mockEmptyQueryCollect(ctx)

    const result = await heartbeatDocumentPresenceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      documentId: "document_1",
      workosUserId: "workos_1",
      email: "alex@example.com",
      name: "Alex",
      avatarUrl: "https://example.com/alex.png",
      avatarImageUrl: "https://example.com/alex-photo.png",
      sessionId: "session_12345",
    })

    expect(requireReadableDocumentAccessMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        id: "document_1",
      }),
      "user_1"
    )
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "documentPresence",
      expect.objectContaining({
        documentId: "document_1",
        userId: "user_1",
        workosUserId: "workos_1",
        sessionId: "session_12345",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "https://example.com/alex.png",
        avatarImageUrl: "https://example.com/alex-photo.png",
        createdAt: "2026-04-17T20:24:45.000Z",
        lastSeenAt: "2026-04-17T20:24:45.000Z",
      })
    )
    expect(listDocumentPresenceViewersMock).toHaveBeenCalledWith(
      ctx,
      "document_1",
      "user_1",
      "workos_1"
    )
    expect(result).toEqual([
      {
        userId: "workos_2",
        name: "Sam",
        avatarUrl: "https://example.com/sam.png",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-17T20:24:45.000Z",
      },
    ])
  })

  it("updates an existing session entry, removes duplicates, and moves presence to the latest document", async () => {
    const { heartbeatDocumentPresenceHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([
          {
            _id: "presence_newest",
            documentId: "document_old",
            userId: "user_1",
            workosUserId: "workos_1",
            sessionId: "session_12345",
            lastSeenAt: "2026-04-17T20:20:00.000Z",
          },
          {
            _id: "presence_duplicate",
            documentId: "document_old",
            userId: "user_1",
            workosUserId: "workos_1",
            sessionId: "session_12345",
            lastSeenAt: "2026-04-17T20:10:00.000Z",
          },
        ]),
      })),
    })

    await heartbeatDocumentPresenceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      documentId: "document_1",
      workosUserId: "workos_1",
      email: "alex@example.com",
      name: "Alex",
      avatarUrl: "https://example.com/alex.png",
      avatarImageUrl: "https://example.com/alex-photo.png",
      sessionId: "session_12345",
    })

    expect(ctx.db.patch).toHaveBeenCalledWith("presence_newest", {
      avatarUrl: "https://example.com/alex.png",
      avatarImageUrl: "https://example.com/alex-photo.png",
      activeBlockId: null,
      documentId: "document_1",
      editing: false,
      email: "alex@example.com",
      lastSeenAt: "2026-04-17T20:24:45.000Z",
      name: "Alex",
      userId: "user_1",
      workosUserId: "workos_1",
    })
    expect(ctx.db.delete).toHaveBeenCalledWith("presence_duplicate")
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("clears presence only for the requested document when a session spans multiple documents", async () => {
    const { clearDocumentPresenceHandler } =
      await import("@/convex/app/document_handlers")
    const ctx = createCtx()
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([
          {
            _id: "presence_doc_1",
            documentId: "document_1",
            userId: "user_1",
            workosUserId: "workos_1",
            sessionId: "session_12345",
          },
          {
            _id: "presence_doc_2",
            documentId: "document_2",
            userId: "user_1",
            workosUserId: "workos_1",
            sessionId: "session_12345",
          },
        ]),
      })),
    })

    const result = await clearDocumentPresenceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      documentId: "document_1",
      workosUserId: "workos_1",
      sessionId: "session_12345",
    })

    expect(ctx.db.delete).toHaveBeenCalledTimes(1)
    expect(ctx.db.delete).toHaveBeenCalledWith("presence_doc_1")
    expect(result).toEqual({
      ok: true,
    })
  })

  it("reuses a caller-provided id when creating documents", async () => {
    const { createDocumentHandler } =
      await import("@/convex/app/document_handlers")
    const core = await import("@/convex/app/core")
    const access = await import("@/convex/app/access")
    const data = await import("@/convex/app/data")
    const ctx = createCtx()

    vi.mocked(core.createId).mockReturnValue("document_generated")
    vi.mocked(access.requireEditableWorkspaceAccess).mockResolvedValue(
      undefined
    )
    vi.mocked(data.getTeamDoc).mockResolvedValue(null)

    const result = await createDocumentHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      id: "document_custom",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      title: "Launch doc",
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        id: "document_custom",
        workspaceId: "workspace_1",
        title: "Launch doc",
      })
    )
    expect(core.createId).not.toHaveBeenCalled()
    expect(result).toEqual({
      documentId: "document_custom",
      workspaceId: "workspace_1",
    })

    vi.mocked(access.requireEditableWorkspaceAccess).mockReset()
    vi.mocked(data.getTeamDoc).mockReset()
    vi.mocked(core.createId).mockReset()
  })
})
