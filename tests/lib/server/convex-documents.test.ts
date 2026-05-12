import { beforeEach, describe, expect, it, vi } from "vitest"

import { createConvexServerCoreMock } from "@/tests/lib/fixtures/convex-server"

const mutationMock = vi.fn()

vi.mock("@/lib/server/convex/core", () =>
  createConvexServerCoreMock(mutationMock)
)

describe("convex document server wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
  })

  it("sanitizes document and item-description rich text before persistence", async () => {
    const {
      addCommentServer,
      updateDocumentContentServer,
      updateItemDescriptionServer,
    } = await import("@/lib/server/convex/documents")

    mutationMock.mockResolvedValue({})

    await updateDocumentContentServer({
      currentUserId: "user_1",
      documentId: "document_1",
      content:
        '<p><a href="/api/calls/join?callId=call_1" target="_blank">Join</a><script>alert(1)</script></p>',
    })
    await updateItemDescriptionServer({
      currentUserId: "user_1",
      itemId: "item_1",
      content:
        '<p><img src="https://cdn.example.com/file.png" onerror="evil()" class="editor-image" /></p>',
    })
    await addCommentServer({
      currentUserId: "user_1",
      targetType: "workItem",
      targetId: "item_1",
      content:
        '<p><a href="javascript:alert(1)">Bad</a><a href="/safe" target="_blank">Safe</a></p>',
    })

    expect(mutationMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        content:
          '<p><a href="/api/calls/join?callId=call_1" target="_blank" rel="noopener noreferrer">Join</a></p>',
      })
    )
    expect(mutationMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        content:
          '<p><img src="https://cdn.example.com/file.png" class="editor-image" /></p>',
      })
    )
    expect(mutationMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        content:
          '<p><a>Bad</a><a href="/safe" target="_blank" rel="noopener noreferrer">Safe</a></p>',
      })
    )
  })

  it("updates documents through the consolidated mutation contract", async () => {
    const { updateDocumentServer } =
      await import("@/lib/server/convex/documents")

    mutationMock.mockResolvedValue({
      updatedAt: "2026-04-18T10:00:00.000Z",
    })

    await expect(
      updateDocumentServer({
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Launch plan",
        content:
          '<p><a href="/api/calls/join?callId=call_1" target="_blank">Join</a><script>alert(1)</script></p>',
        expectedUpdatedAt: "2026-04-17T10:00:00.000Z",
      })
    ).resolves.toEqual({
      updatedAt: "2026-04-18T10:00:00.000Z",
    })

    expect(mutationMock).toHaveBeenCalledTimes(1)
    expect(mutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Launch plan",
        expectedUpdatedAt: "2026-04-17T10:00:00.000Z",
        content:
          '<p><a href="/api/calls/join?callId=call_1" target="_blank" rel="noopener noreferrer">Join</a></p>',
      })
    )
  })

  it("maps document and item-description edit conflicts to application errors", async () => {
    const { updateDocumentServer, updateItemDescriptionServer } =
      await import("@/lib/server/convex/documents")

    mutationMock
      .mockRejectedValueOnce(new Error("Document changed while you were editing"))
      .mockRejectedValueOnce(
        new Error("Work item description changed while you were editing")
      )

    await expect(
      updateDocumentServer({
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Launch plan",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "DOCUMENT_EDIT_CONFLICT",
    })

    await expect(
      updateItemDescriptionServer({
        currentUserId: "user_1",
        itemId: "item_1",
        content: "<p>Updated</p>",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "ITEM_DESCRIPTION_EDIT_CONFLICT",
    })
  })

  it("maps document and comment domain failures to application errors", async () => {
    const {
      addCommentServer,
      deleteDocumentServer,
      sendDocumentMentionNotificationsServer,
      sendItemDescriptionMentionNotificationsServer,
      toggleCommentReactionServer,
      updateItemDescriptionServer,
    } = await import("@/lib/server/convex/documents")

    mutationMock
      .mockRejectedValueOnce(new Error("Parent comment not found"))
      .mockRejectedValueOnce(
        new Error("Work item description documents can't be deleted directly")
      )
      .mockRejectedValueOnce(new Error("Comment not found"))
      .mockRejectedValueOnce(new Error("Work item not found"))
      .mockRejectedValueOnce(
        new Error("One or more mentioned users are not present in the document")
      )
      .mockRejectedValueOnce(
        new Error(
          "One or more mentioned users were already notified for this document"
        )
      )
      .mockRejectedValueOnce(
        new Error(
          "One or more mentioned users are not present in this work item"
        )
      )
      .mockRejectedValueOnce(
        new Error(
          "One or more mentioned users were already notified for this work item"
        )
      )

    await expect(
      addCommentServer({
        currentUserId: "user_1",
        targetType: "workItem",
        targetId: "item_1",
        content: "hello",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "COMMENT_PARENT_NOT_FOUND",
    })

    await expect(
      deleteDocumentServer({
        currentUserId: "user_1",
        documentId: "document_1",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 400,
      code: "DOCUMENT_DELETE_INVALID_KIND",
    })

    await expect(
      toggleCommentReactionServer({
        currentUserId: "user_1",
        commentId: "comment_1",
        emoji: "👍",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "COMMENT_NOT_FOUND",
    })

    await expect(
      updateItemDescriptionServer({
        currentUserId: "user_1",
        itemId: "item_1",
        content: "<p>Updated</p>",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "WORK_ITEM_NOT_FOUND",
    })

    await expect(
      sendDocumentMentionNotificationsServer({
        currentUserId: "user_1",
        documentId: "document_1",
        mentions: [
          {
            userId: "user_2",
            count: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "DOCUMENT_MENTION_STATE_STALE",
    })

    await expect(
      sendDocumentMentionNotificationsServer({
        currentUserId: "user_1",
        documentId: "document_1",
        mentions: [
          {
            userId: "user_2",
            count: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "DOCUMENT_MENTION_ALREADY_SENT",
    })

    await expect(
      sendItemDescriptionMentionNotificationsServer({
        currentUserId: "user_1",
        itemId: "item_1",
        mentions: [
          {
            userId: "user_2",
            count: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "ITEM_DESCRIPTION_MENTION_STATE_STALE",
    })

    await expect(
      sendItemDescriptionMentionNotificationsServer({
        currentUserId: "user_1",
        itemId: "item_1",
        mentions: [
          {
            userId: "user_2",
            count: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "ITEM_DESCRIPTION_MENTION_ALREADY_SENT",
    })
  })

  it("maps document presence failures to application errors", async () => {
    const { clearDocumentPresenceServer, heartbeatDocumentPresenceServer } =
      await import("@/lib/server/convex/documents")

    mutationMock
      .mockRejectedValueOnce(
        new Error("Document presence session is already in use")
      )
      .mockRejectedValueOnce(new Error("Document not found"))

    await expect(
      heartbeatDocumentPresenceServer({
        currentUserId: "user_1",
        documentId: "document_1",
        workosUserId: "workos_1",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "https://example.com/avatar.png",
        avatarImageUrl: "https://example.com/avatar-photo.png",
        sessionId: "session_12345",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "DOCUMENT_PRESENCE_SESSION_CONFLICT",
    })

    await expect(
      clearDocumentPresenceServer({
        currentUserId: "user_1",
        documentId: "document_1",
        workosUserId: "workos_1",
        sessionId: "session_12345",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("maps wrapped document failures to application errors", async () => {
    const { updateDocumentServer } =
      await import("@/lib/server/convex/documents")

    mutationMock.mockRejectedValueOnce(
      new Error("[Request ID: abc123] Server Error", {
        cause: new Error("Document not found"),
      })
    )

    await expect(
      updateDocumentServer({
        currentUserId: "user_1",
        documentId: "document_1",
        title: "Updated title",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("maps attachment and document-creation failures to application errors", async () => {
    const {
      createAttachmentServer,
      createDocumentServer,
      deleteAttachmentServer,
      generateAttachmentUploadUrlServer,
    } = await import("@/lib/server/convex/documents")

    mutationMock
      .mockRejectedValueOnce(
        new Error("Attachments are only available on team documents")
      )
      .mockRejectedValueOnce(new Error("Uploaded file not found"))
      .mockRejectedValueOnce(new Error("Attachment not found"))
      .mockRejectedValueOnce(new Error("Docs are disabled for this team"))

    await expect(
      generateAttachmentUploadUrlServer({
        currentUserId: "user_1",
        targetType: "document",
        targetId: "document_1",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "ATTACHMENT_TARGET_INVALID",
    })

    await expect(
      createAttachmentServer({
        currentUserId: "user_1",
        targetType: "document",
        targetId: "document_1",
        storageId: "storage_1",
        fileName: "demo.png",
        contentType: "image/png",
        size: 123,
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "ATTACHMENT_UPLOAD_NOT_FOUND",
    })

    await expect(
      deleteAttachmentServer({
        currentUserId: "user_1",
        attachmentId: "attachment_1",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "ATTACHMENT_NOT_FOUND",
    })

    await expect(
      createDocumentServer({
        currentUserId: "user_1",
        kind: "team-document",
        teamId: "team_1",
        title: "Launch doc",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "TEAM_DOCS_DISABLED",
    })
  })

  it("passes caller-provided document ids through creation", async () => {
    const { createDocumentServer } =
      await import("@/lib/server/convex/documents")

    mutationMock.mockResolvedValue({
      documentId: "document_custom",
    })

    await expect(
      createDocumentServer({
        currentUserId: "user_1",
        id: "document_custom",
        kind: "workspace-document",
        workspaceId: "workspace_1",
        title: "Launch doc",
      })
    ).resolves.toEqual({
      documentId: "document_custom",
    })

    expect(mutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentUserId: "user_1",
        id: "document_custom",
        kind: "workspace-document",
        workspaceId: "workspace_1",
        title: "Launch doc",
      })
    )
  })
})
