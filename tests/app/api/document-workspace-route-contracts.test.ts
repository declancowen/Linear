import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const addCommentServerMock = vi.fn()
const toggleCommentReactionServerMock = vi.fn()
const updateDocumentServerMock = vi.fn()
const sendDocumentMentionNotificationsServerMock = vi.fn()
const updateItemDescriptionServerMock = vi.fn()
const sendItemDescriptionMentionNotificationsServerMock = vi.fn()
const leaveWorkspaceServerMock = vi.fn()
const removeWorkspaceUserServerMock = vi.fn()
const validateCurrentAccountDeletionServerMock = vi.fn()
const prepareCurrentAccountDeletionServerMock = vi.fn()
const deleteCurrentAccountServerMock = vi.fn()
const cancelCurrentAccountDeletionServerMock = vi.fn()
const enqueueEmailJobsServerMock = vi.fn()
const enqueueMentionEmailJobsServerMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const reconcileProviderMembershipCleanupMock = vi.fn()
const reconcileDeletedAccountProviderCleanupMock = vi.fn()
const logProviderErrorMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()
const resolveDocumentReadModelScopeKeysServerMock = vi.fn()
const resolveWorkItemReadModelScopeKeysServerMock = vi.fn()
const bumpDocumentIndexReadModelScopesServerMock = vi.fn()
const bumpWorkspaceMembershipReadModelScopesServerMock = vi.fn()
const notifyCollaborationDocumentChangedServerMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  addCommentServer: addCommentServerMock,
  toggleCommentReactionServer: toggleCommentReactionServerMock,
  updateDocumentServer: updateDocumentServerMock,
  sendDocumentMentionNotificationsServer:
    sendDocumentMentionNotificationsServerMock,
  updateItemDescriptionServer: updateItemDescriptionServerMock,
  sendItemDescriptionMentionNotificationsServer:
    sendItemDescriptionMentionNotificationsServerMock,
  leaveWorkspaceServer: leaveWorkspaceServerMock,
  removeWorkspaceUserServer: removeWorkspaceUserServerMock,
  validateCurrentAccountDeletionServer:
    validateCurrentAccountDeletionServerMock,
  prepareCurrentAccountDeletionServer: prepareCurrentAccountDeletionServerMock,
  deleteCurrentAccountServer: deleteCurrentAccountServerMock,
  cancelCurrentAccountDeletionServer: cancelCurrentAccountDeletionServerMock,
  enqueueEmailJobsServer: enqueueEmailJobsServerMock,
  enqueueMentionEmailJobsServer: enqueueMentionEmailJobsServerMock,
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
}))

vi.mock("@/lib/server/email", () => ({
  buildAccessChangeEmailJobs: vi.fn(() => []),
  buildMentionEmailJobs: vi.fn(() => []),
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/lifecycle", () => ({
  reconcileProviderMembershipCleanup: reconcileProviderMembershipCleanupMock,
  reconcileDeletedAccountProviderCleanup:
    reconcileDeletedAccountProviderCleanupMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  getWorkOSErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  resolveDocumentReadModelScopeKeysServer:
    resolveDocumentReadModelScopeKeysServerMock,
  bumpDocumentIndexReadModelScopesServer:
    bumpDocumentIndexReadModelScopesServerMock,
  bumpWorkspaceMembershipReadModelScopesServer:
    bumpWorkspaceMembershipReadModelScopesServerMock,
  resolveWorkItemReadModelScopeKeysServer:
    resolveWorkItemReadModelScopeKeysServerMock,
}))

vi.mock("@/lib/server/collaboration-refresh", () => ({
  notifyCollaborationDocumentChangedServer:
    notifyCollaborationDocumentChangedServerMock,
}))

describe("document and workspace route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    addCommentServerMock.mockReset()
    toggleCommentReactionServerMock.mockReset()
    updateDocumentServerMock.mockReset()
    sendDocumentMentionNotificationsServerMock.mockReset()
    updateItemDescriptionServerMock.mockReset()
    sendItemDescriptionMentionNotificationsServerMock.mockReset()
    leaveWorkspaceServerMock.mockReset()
    removeWorkspaceUserServerMock.mockReset()
    validateCurrentAccountDeletionServerMock.mockReset()
    prepareCurrentAccountDeletionServerMock.mockReset()
    deleteCurrentAccountServerMock.mockReset()
    cancelCurrentAccountDeletionServerMock.mockReset()
    enqueueEmailJobsServerMock.mockReset()
    enqueueMentionEmailJobsServerMock.mockReset()
    reconcileAuthenticatedAppContextMock.mockReset()
    reconcileProviderMembershipCleanupMock.mockReset()
    reconcileDeletedAccountProviderCleanupMock.mockReset()
    logProviderErrorMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    resolveDocumentReadModelScopeKeysServerMock.mockReset()
    resolveWorkItemReadModelScopeKeysServerMock.mockReset()
    bumpDocumentIndexReadModelScopesServerMock.mockReset()
    bumpWorkspaceMembershipReadModelScopesServerMock.mockReset()
    notifyCollaborationDocumentChangedServerMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
      authenticatedUser: {
        workosUserId: "workos_1",
      },
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
        isWorkspaceOwner: true,
      },
    })
    enqueueEmailJobsServerMock.mockResolvedValue({
      queued: 0,
    })
    reconcileAuthenticatedAppContextMock.mockResolvedValue(undefined)
    reconcileProviderMembershipCleanupMock.mockResolvedValue(undefined)
    reconcileDeletedAccountProviderCleanupMock.mockResolvedValue(undefined)
    bumpScopedReadModelVersionsServerMock.mockResolvedValue(undefined)
    resolveDocumentReadModelScopeKeysServerMock.mockResolvedValue([
      "document-detail:document_1",
    ])
    resolveWorkItemReadModelScopeKeysServerMock.mockResolvedValue([
      "work-item-detail:item_1",
      "work-index:team_team_1",
    ])
    bumpDocumentIndexReadModelScopesServerMock.mockResolvedValue(undefined)
    bumpWorkspaceMembershipReadModelScopesServerMock.mockResolvedValue(
      undefined
    )
    notifyCollaborationDocumentChangedServerMock.mockResolvedValue({
      ok: true,
    })
  })

  it("maps comment creation domain failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/comments/route")

    addCommentServerMock.mockRejectedValue(
      new ApplicationError("Parent comment not found", 404, {
        code: "COMMENT_PARENT_NOT_FOUND",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "workItem",
          targetId: "item_1",
          content: "Hello world",
        }),
      }) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Parent comment not found",
      message: "Parent comment not found",
      code: "COMMENT_PARENT_NOT_FOUND",
    })
  })

  it("maps comment reaction domain failures to typed error responses", async () => {
    const { POST } =
      await import("@/app/api/comments/[commentId]/reactions/route")

    toggleCommentReactionServerMock.mockRejectedValue(
      new ApplicationError("Comment not found", 404, {
        code: "COMMENT_NOT_FOUND",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/comments/comment_1/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emoji: "👍",
        }),
      }) as never,
      {
        params: Promise.resolve({
          commentId: "comment_1",
        }),
      }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Comment not found",
      message: "Comment not found",
      code: "COMMENT_NOT_FOUND",
    })
  })

  it("maps document update domain failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/documents/[documentId]/route")

    updateDocumentServerMock.mockRejectedValue(
      new ApplicationError("Document not found", 404, {
        code: "DOCUMENT_NOT_FOUND",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/documents/document_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated title",
        }),
      }) as never,
      {
        params: Promise.resolve({
          documentId: "document_1",
        }),
      }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Document not found",
      message: "Document not found",
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("does not refresh active collaboration rooms for document title-only updates", async () => {
    const { PATCH } = await import("@/app/api/documents/[documentId]/route")

    updateDocumentServerMock.mockResolvedValue({
      updatedAt: "2026-04-22T00:00:00.000Z",
    })

    const response = await PATCH(
      new Request("http://localhost/api/documents/document_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated title",
        }),
      }) as never,
      {
        params: Promise.resolve({
          documentId: "document_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    expect(updateDocumentServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: undefined,
        documentId: "document_1",
        title: "Updated title",
      })
    )
    expect(notifyCollaborationDocumentChangedServerMock).not.toHaveBeenCalled()
  })

  it("refreshes active collaboration rooms after document body updates", async () => {
    const { PATCH } = await import("@/app/api/documents/[documentId]/route")

    updateDocumentServerMock.mockResolvedValue({
      updatedAt: "2026-04-22T00:00:00.000Z",
    })

    const response = await PATCH(
      new Request("http://localhost/api/documents/document_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "<p>Updated body</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          documentId: "document_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    expect(notifyCollaborationDocumentChangedServerMock).toHaveBeenCalledWith({
      documentId: "document_1",
      kind: "canonical-updated",
      reason: "document-route-patch-content",
    })
  })

  it("maps document mention notification failures to typed error responses", async () => {
    const { POST } =
      await import("@/app/api/documents/[documentId]/mentions/route")

    sendDocumentMentionNotificationsServerMock.mockRejectedValue(
      new ApplicationError(
        "One or more mentioned users are invalid for this document",
        400,
        {
          code: "DOCUMENT_MENTION_USERS_INVALID",
        }
      )
    )

    const response = await POST(
      new Request("http://localhost/api/documents/document_1/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mentions: [
            {
              userId: "user_2",
              count: 2,
            },
          ],
        }),
      }) as never,
      {
        params: Promise.resolve({
          documentId: "document_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "One or more mentioned users are invalid for this document",
      message: "One or more mentioned users are invalid for this document",
      code: "DOCUMENT_MENTION_USERS_INVALID",
    })
  })

  it("maps item-description domain failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/items/[itemId]/description/route")

    updateItemDescriptionServerMock.mockRejectedValue(
      new ApplicationError("Work item not found", 404, {
        code: "WORK_ITEM_NOT_FOUND",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/items/item_1/description", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "<p>Updated description</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Work item not found",
      message: "Work item not found",
      code: "WORK_ITEM_NOT_FOUND",
    })
  })

  it("bumps scoped read model versions after item-description updates", async () => {
    const { PATCH } = await import("@/app/api/items/[itemId]/description/route")

    updateItemDescriptionServerMock.mockResolvedValue({
      updatedAt: "2026-04-22T00:00:00.000Z",
    })

    const response = await PATCH(
      new Request("http://localhost/api/items/item_1/description", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "<p>Updated description</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    expect(resolveWorkItemReadModelScopeKeysServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          id: "workos_1",
        }),
      }),
      "item_1"
    )
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: ["work-item-detail:item_1", "work-index:team_team_1"],
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      updatedAt: "2026-04-22T00:00:00.000Z",
    })
  })

  it("maps item-description mention failures to typed error responses", async () => {
    const { POST } =
      await import("@/app/api/items/[itemId]/description/mentions/route")

    sendItemDescriptionMentionNotificationsServerMock.mockRejectedValue(
      new ApplicationError(
        "One or more mentioned users are invalid for this work item",
        400,
        {
          code: "ITEM_DESCRIPTION_MENTION_USERS_INVALID",
        }
      )
    )

    const response = await POST(
      new Request("http://localhost/api/items/item_1/description/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mentions: [
            {
              userId: "user_2",
              count: 2,
            },
          ],
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "One or more mentioned users are invalid for this work item",
      message: "One or more mentioned users are invalid for this work item",
      code: "ITEM_DESCRIPTION_MENTION_USERS_INVALID",
    })
  })

  it("maps workspace leave domain failures to typed error responses", async () => {
    const { DELETE } = await import("@/app/api/workspace/current/leave/route")

    leaveWorkspaceServerMock.mockRejectedValue(
      new ApplicationError("Workspace admins can't leave the workspace", 409, {
        code: "WORKSPACE_LEAVE_ADMIN_FORBIDDEN",
      })
    )

    const response = await DELETE()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Workspace admins can't leave the workspace",
      message: "Workspace admins can't leave the workspace",
      code: "WORKSPACE_LEAVE_ADMIN_FORBIDDEN",
    })
  })

  it("maps workspace-user removal failures to typed error responses", async () => {
    const { DELETE } =
      await import("@/app/api/workspace/current/users/[userId]/route")

    removeWorkspaceUserServerMock.mockRejectedValue(
      new ApplicationError(
        "Workspace admins can't be removed from the workspace",
        409,
        {
          code: "WORKSPACE_USER_REMOVE_ADMIN_FORBIDDEN",
        }
      )
    )

    const response = await DELETE(
      new Request("http://localhost/api/workspace/current/users/user_2", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          userId: "user_2",
        }),
      }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Workspace admins can't be removed from the workspace",
      message: "Workspace admins can't be removed from the workspace",
      code: "WORKSPACE_USER_REMOVE_ADMIN_FORBIDDEN",
    })
  })

  it("maps account deletion lifecycle blockers to typed error responses", async () => {
    const { DELETE } = await import("@/app/api/account/route")

    validateCurrentAccountDeletionServerMock.mockRejectedValue(
      new ApplicationError(
        "Transfer or delete your owned workspace before deleting your account",
        409,
        {
          code: "ACCOUNT_DELETE_WORKSPACE_TRANSFER_REQUIRED",
        }
      )
    )

    const response = await DELETE()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error:
        "Transfer or delete your owned workspace before deleting your account",
      message:
        "Transfer or delete your owned workspace before deleting your account",
      code: "ACCOUNT_DELETE_WORKSPACE_TRANSFER_REQUIRED",
    })
    expect(prepareCurrentAccountDeletionServerMock).not.toHaveBeenCalled()
    expect(deleteCurrentAccountServerMock).not.toHaveBeenCalled()
    expect(reconcileDeletedAccountProviderCleanupMock).not.toHaveBeenCalled()
  })

  it("finalizes account deletion before provider cleanup reconciliation", async () => {
    const { DELETE } = await import("@/app/api/account/route")

    deleteCurrentAccountServerMock.mockResolvedValue({
      emailJobs: [],
      providerMemberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })

    const response = await DELETE()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      logoutRequired: true,
      notice: "Your account has been deleted.",
    })
    expect(deleteCurrentAccountServerMock).toHaveBeenCalledTimes(1)
    expect(reconcileDeletedAccountProviderCleanupMock).toHaveBeenCalledWith({
      workosUserId: "workos_1",
      memberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })
    expect(cancelCurrentAccountDeletionServerMock).not.toHaveBeenCalled()
    expect(
      deleteCurrentAccountServerMock.mock.invocationCallOrder[0]
    ).toBeLessThan(
      reconcileDeletedAccountProviderCleanupMock.mock.invocationCallOrder[0]
    )
  })

  it("returns an accurate message when account deletion finalization fails", async () => {
    const { DELETE } = await import("@/app/api/account/route")

    deleteCurrentAccountServerMock.mockRejectedValue(new Error("boom"))

    const response = await DELETE()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error:
        "We couldn't finish deleting your account. Please try again or contact support.",
      message:
        "We couldn't finish deleting your account. Please try again or contact support.",
      code: "ACCOUNT_DELETE_FINALIZE_FAILED",
    })
    expect(cancelCurrentAccountDeletionServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
    })
    expect(reconcileDeletedAccountProviderCleanupMock).not.toHaveBeenCalled()
  })

  it("reconciles provider memberships after workspace removal commits", async () => {
    const { DELETE } =
      await import("@/app/api/workspace/current/users/[userId]/route")

    removeWorkspaceUserServerMock.mockResolvedValue({
      workspaceId: "workspace_1",
      userId: "user_2",
      emailJobs: [],
      providerMemberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_2",
        },
      ],
    })

    const response = await DELETE(
      new Request("http://localhost/api/workspace/current/users/user_2", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          userId: "user_2",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      workspaceId: "workspace_1",
      userId: "user_2",
    })
    expect(reconcileProviderMembershipCleanupMock).toHaveBeenCalledWith({
      label: "Failed to deactivate WorkOS membership after workspace removal",
      memberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_2",
        },
      ],
    })
  })
})
