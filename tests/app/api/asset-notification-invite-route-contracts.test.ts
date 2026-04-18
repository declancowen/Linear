import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const requireConvexUserMock = vi.fn()
const generateAttachmentUploadUrlServerMock = vi.fn()
const createAttachmentServerMock = vi.fn()
const deleteAttachmentServerMock = vi.fn()
const createLabelServerMock = vi.fn()
const createInviteServerMock = vi.fn()
const getInviteByTokenServerMock = vi.fn()
const acceptInviteServerMock = vi.fn()
const declineInviteServerMock = vi.fn()
const archiveNotificationServerMock = vi.fn()
const unarchiveNotificationServerMock = vi.fn()
const markNotificationReadServerMock = vi.fn()
const toggleNotificationReadServerMock = vi.fn()
const deleteNotificationServerMock = vi.fn()
const createDocumentServerMock = vi.fn()
const enqueueEmailJobsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: requireConvexUserMock,
}))

vi.mock("@/lib/server/convex", () => ({
  generateAttachmentUploadUrlServer: generateAttachmentUploadUrlServerMock,
  createAttachmentServer: createAttachmentServerMock,
  deleteAttachmentServer: deleteAttachmentServerMock,
  createLabelServer: createLabelServerMock,
  createInviteServer: createInviteServerMock,
  getInviteByTokenServer: getInviteByTokenServerMock,
  acceptInviteServer: acceptInviteServerMock,
  declineInviteServer: declineInviteServerMock,
  archiveNotificationServer: archiveNotificationServerMock,
  unarchiveNotificationServer: unarchiveNotificationServerMock,
  markNotificationReadServer: markNotificationReadServerMock,
  toggleNotificationReadServer: toggleNotificationReadServerMock,
  deleteNotificationServer: deleteNotificationServerMock,
  createDocumentServer: createDocumentServerMock,
  enqueueEmailJobsServer: enqueueEmailJobsServerMock,
}))

vi.mock("@/lib/server/email", () => ({
  buildTeamInviteEmailJobs: vi.fn(() => []),
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

describe("asset, notification, invite, and document route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    requireConvexUserMock.mockReset()
    generateAttachmentUploadUrlServerMock.mockReset()
    createAttachmentServerMock.mockReset()
    deleteAttachmentServerMock.mockReset()
    createLabelServerMock.mockReset()
    createInviteServerMock.mockReset()
    getInviteByTokenServerMock.mockReset()
    acceptInviteServerMock.mockReset()
    declineInviteServerMock.mockReset()
    archiveNotificationServerMock.mockReset()
    unarchiveNotificationServerMock.mockReset()
    markNotificationReadServerMock.mockReset()
    toggleNotificationReadServerMock.mockReset()
    deleteNotificationServerMock.mockReset()
    createDocumentServerMock.mockReset()
    enqueueEmailJobsServerMock.mockReset()
    logProviderErrorMock.mockReset()
    reconcileAuthenticatedAppContextMock.mockReset()

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
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
      },
    })
    requireConvexUserMock.mockResolvedValue({
      currentUser: {
        id: "user_1",
      },
    })
    enqueueEmailJobsServerMock.mockResolvedValue({
      queued: 0,
    })
    reconcileAuthenticatedAppContextMock.mockResolvedValue(undefined)
  })

  it("maps attachment and label failures to typed error responses", async () => {
    const uploadUrlRoute =
      await import("@/app/api/attachments/upload-url/route")
    const createAttachmentRoute = await import("@/app/api/attachments/route")
    const deleteAttachmentRoute =
      await import("@/app/api/attachments/[attachmentId]/route")
    const labelRoute = await import("@/app/api/labels/route")

    generateAttachmentUploadUrlServerMock.mockRejectedValue(
      new ApplicationError(
        "Attachments are only available on team documents",
        400,
        {
          code: "ATTACHMENT_TARGET_INVALID",
        }
      )
    )
    createAttachmentServerMock.mockRejectedValue(
      new ApplicationError("Uploaded file not found", 400, {
        code: "ATTACHMENT_UPLOAD_NOT_FOUND",
      })
    )
    deleteAttachmentServerMock.mockRejectedValue(
      new ApplicationError("Attachment not found", 404, {
        code: "ATTACHMENT_NOT_FOUND",
      })
    )
    createLabelServerMock.mockRejectedValue(
      new ApplicationError("User not found", 404, {
        code: "ACCOUNT_NOT_FOUND",
      })
    )

    const uploadResponse = await uploadUrlRoute.POST(
      new Request("http://localhost/api/attachments/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "document",
          targetId: "document_1",
        }),
      }) as never
    )
    expect(uploadResponse.status).toBe(400)

    const createResponse = await createAttachmentRoute.POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "document",
          targetId: "document_1",
          storageId: "storage_1",
          fileName: "demo.png",
          contentType: "image/png",
          size: 123,
        }),
      }) as never
    )
    expect(createResponse.status).toBe(400)

    const deleteResponse = await deleteAttachmentRoute.DELETE(
      new Request("http://localhost/api/attachments/attachment_1", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          attachmentId: "attachment_1",
        }),
      }
    )
    expect(deleteResponse.status).toBe(404)

    const labelResponse = await labelRoute.POST(
      new Request("http://localhost/api/labels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: "workspace_2",
          name: "Bug",
        }),
      }) as never
    )
    expect(labelResponse.status).toBe(404)
    expect(createLabelServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      workspaceId: "workspace_2",
      name: "Bug",
    })
    await expect(labelResponse.json()).resolves.toEqual({
      error: "User not found",
      message: "User not found",
      code: "ACCOUNT_NOT_FOUND",
    })
  })

  it("maps invite failures to typed error responses", async () => {
    const inviteRoute = await import("@/app/api/invites/route")
    const acceptRoute = await import("@/app/api/invites/accept/route")
    const declineRoute = await import("@/app/api/invites/decline/route")

    createInviteServerMock.mockRejectedValue(
      new ApplicationError("Team not found", 404, {
        code: "TEAM_NOT_FOUND",
      })
    )
    getInviteByTokenServerMock.mockResolvedValue({
      invite: {
        id: "invite_1",
        email: "alex@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    })
    acceptInviteServerMock.mockRejectedValue(
      new ApplicationError("Invite has been declined", 409, {
        code: "INVITE_DECLINED",
      })
    )
    declineInviteServerMock.mockRejectedValue(
      new ApplicationError("Invite has already been accepted", 409, {
        code: "INVITE_ALREADY_ACCEPTED",
      })
    )

    const inviteResponse = await inviteRoute.POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamIds: ["team_1"],
          email: "alex@example.com",
          role: "member",
        }),
      }) as never
    )
    expect(inviteResponse.status).toBe(404)

    const acceptResponse = await acceptRoute.POST(
      new Request("http://localhost/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "token_1",
        }),
      }) as never
    )
    expect(acceptResponse.status).toBe(409)

    const declineResponse = await declineRoute.POST(
      new Request("http://localhost/api/invites/decline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "token_1",
        }),
      }) as never
    )
    expect(declineResponse.status).toBe(409)
    await expect(declineResponse.json()).resolves.toEqual({
      error: "Invite has already been accepted",
      message: "Invite has already been accepted",
      code: "INVITE_ALREADY_ACCEPTED",
    })
  })

  it("maps notification failures to typed error responses", async () => {
    const notificationsRoute = await import("@/app/api/notifications/route")
    const notificationRoute =
      await import("@/app/api/notifications/[notificationId]/route")

    archiveNotificationServerMock.mockRejectedValue(
      new ApplicationError("Notification not found", 404, {
        code: "NOTIFICATION_NOT_FOUND",
      })
    )
    markNotificationReadServerMock.mockRejectedValue(
      new ApplicationError("You do not have access to this notification", 403, {
        code: "NOTIFICATION_ACCESS_DENIED",
      })
    )
    deleteNotificationServerMock.mockRejectedValue(
      new ApplicationError("Notification not found", 404, {
        code: "NOTIFICATION_NOT_FOUND",
      })
    )

    const bulkResponse = await notificationsRoute.PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "archive",
          notificationIds: ["notification_1"],
        }),
      }) as never
    )
    expect(bulkResponse.status).toBe(404)

    const patchResponse = await notificationRoute.PATCH(
      new Request("http://localhost/api/notifications/notification_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "markRead",
        }),
      }) as never,
      {
        params: Promise.resolve({
          notificationId: "notification_1",
        }),
      }
    )
    expect(patchResponse.status).toBe(403)

    const deleteResponse = await notificationRoute.DELETE(
      new Request("http://localhost/api/notifications/notification_1", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          notificationId: "notification_1",
        }),
      }
    )
    expect(deleteResponse.status).toBe(404)
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "Notification not found",
      message: "Notification not found",
      code: "NOTIFICATION_NOT_FOUND",
    })
  })

  it("maps document creation failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/documents/route")

    createDocumentServerMock.mockRejectedValue(
      new ApplicationError("Docs are disabled for this team", 400, {
        code: "TEAM_DOCS_DISABLED",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "team-document",
          teamId: "team_1",
          title: "Launch doc",
        }),
      }) as never
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Docs are disabled for this team",
      message: "Docs are disabled for this team",
      code: "TEAM_DOCS_DISABLED",
    })
  })

  it("returns the persisted document id from document creation", async () => {
    const { POST } = await import("@/app/api/documents/route")

    createDocumentServerMock.mockResolvedValue({
      documentId: "document_new",
    })

    const response = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "document_new",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          title: "Launch doc",
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      documentId: "document_new",
    })
    expect(createDocumentServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      id: "document_new",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      title: "Launch doc",
    })
  })
})
