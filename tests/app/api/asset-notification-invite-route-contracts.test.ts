import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  createJsonRouteRequest,
  createProviderErrorsMockModule,
  createRouteParams,
} from "@/tests/lib/fixtures/api-routes"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const requireConvexUserMock = vi.fn()
const generateAttachmentUploadUrlServerMock = vi.fn()
const createAttachmentServerMock = vi.fn()
const deleteAttachmentServerMock = vi.fn()
const createLabelServerMock = vi.fn()
const createInviteServerMock = vi.fn()
const cancelInviteServerMock = vi.fn()
const getInviteByTokenServerMock = vi.fn()
const acceptInviteServerMock = vi.fn()
const declineInviteServerMock = vi.fn()
const updateNotificationsServerMock = vi.fn()
const markNotificationReadServerMock = vi.fn()
const toggleNotificationReadServerMock = vi.fn()
const deleteNotificationServerMock = vi.fn()
const createDocumentServerMock = vi.fn()
const enqueueEmailJobsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()
const reconcileAuthenticatedAppContextMock = vi.fn()
const bumpDocumentIndexReadModelScopesServerMock = vi.fn()
const bumpPrivateDocumentIndexReadModelScopesServerMock = vi.fn()
const bumpPrivateSearchSeedReadModelScopesServerMock = vi.fn()
const bumpSearchSeedReadModelScopesServerMock = vi.fn()
const bumpWorkspaceMembershipReadModelScopesServerMock = vi.fn()

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
  cancelInviteServer: cancelInviteServerMock,
  getInviteByTokenServer: getInviteByTokenServerMock,
  acceptInviteServer: acceptInviteServerMock,
  declineInviteServer: declineInviteServerMock,
  updateNotificationsServer: updateNotificationsServerMock,
  markNotificationReadServer: markNotificationReadServerMock,
  toggleNotificationReadServer: toggleNotificationReadServerMock,
  deleteNotificationServer: deleteNotificationServerMock,
  createDocumentServer: createDocumentServerMock,
  enqueueEmailJobsServer: enqueueEmailJobsServerMock,
}))

vi.mock("@/lib/server/email", () => ({
  buildTeamInviteEmailJobs: vi.fn(() => []),
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(logProviderErrorMock)
)

vi.mock("@/lib/server/authenticated-app", () => ({
  reconcileAuthenticatedAppContext: reconcileAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  bumpDocumentIndexReadModelScopesServer:
    bumpDocumentIndexReadModelScopesServerMock,
  bumpPrivateDocumentIndexReadModelScopesServer:
    bumpPrivateDocumentIndexReadModelScopesServerMock,
  bumpPrivateSearchSeedReadModelScopesServer:
    bumpPrivateSearchSeedReadModelScopesServerMock,
  bumpSearchSeedReadModelScopesServer:
    bumpSearchSeedReadModelScopesServerMock,
  bumpWorkspaceMembershipReadModelScopesServer:
    bumpWorkspaceMembershipReadModelScopesServerMock,
}))

function createInviteTokenRequest(action: "accept" | "decline") {
  return createJsonRouteRequest(`http://localhost/api/invites/${action}`, "POST", {
    token: "token_1",
  })
}

function createCancelInviteRouteInput() {
  return {
    request: new Request("http://localhost/api/invites/invite_1", {
      method: "DELETE",
    }) as never,
    context: createRouteParams({
      inviteId: "invite_1",
    }),
  }
}

function createDocumentRouteRequest(body: Record<string, unknown>) {
  return createJsonRouteRequest("http://localhost/api/documents", "POST", body)
}

async function expectDocumentCreationResponse(response: Response) {
  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({
    ok: true,
    documentId: "document_new",
  })
}

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
    cancelInviteServerMock.mockReset()
    getInviteByTokenServerMock.mockReset()
    acceptInviteServerMock.mockReset()
    declineInviteServerMock.mockReset()
    updateNotificationsServerMock.mockReset()
    markNotificationReadServerMock.mockReset()
    toggleNotificationReadServerMock.mockReset()
    deleteNotificationServerMock.mockReset()
    createDocumentServerMock.mockReset()
    enqueueEmailJobsServerMock.mockReset()
    logProviderErrorMock.mockReset()
    reconcileAuthenticatedAppContextMock.mockReset()
    bumpDocumentIndexReadModelScopesServerMock.mockReset()
    bumpPrivateDocumentIndexReadModelScopesServerMock.mockReset()
    bumpPrivateSearchSeedReadModelScopesServerMock.mockReset()
    bumpSearchSeedReadModelScopesServerMock.mockReset()
    bumpWorkspaceMembershipReadModelScopesServerMock.mockReset()

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
    bumpDocumentIndexReadModelScopesServerMock.mockResolvedValue(undefined)
    bumpPrivateDocumentIndexReadModelScopesServerMock.mockResolvedValue(undefined)
    bumpPrivateSearchSeedReadModelScopesServerMock.mockResolvedValue(undefined)
    bumpSearchSeedReadModelScopesServerMock.mockResolvedValue(undefined)
    bumpWorkspaceMembershipReadModelScopesServerMock.mockResolvedValue(undefined)
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
    const cancelRoute = await import("@/app/api/invites/[inviteId]/route")
    const acceptRoute = await import("@/app/api/invites/accept/route")
    const declineRoute = await import("@/app/api/invites/decline/route")

    createInviteServerMock.mockRejectedValue(
      new ApplicationError("Team not found", 404, {
        code: "TEAM_NOT_FOUND",
      })
    )
    cancelInviteServerMock.mockRejectedValue(
      new ApplicationError("Only team admins can cancel invites", 403, {
        code: "INVITE_CANCEL_FORBIDDEN",
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

    const cancelInput = createCancelInviteRouteInput()
    const cancelResponse = await cancelRoute.DELETE(
      cancelInput.request,
      cancelInput.context
    )
    expect(cancelResponse.status).toBe(403)

    const acceptResponse = await acceptRoute.POST(
      createInviteTokenRequest("accept")
    )
    expect(acceptResponse.status).toBe(409)
    await expect(cancelResponse.json()).resolves.toEqual({
      error: "Only team admins can cancel invites",
      message: "Only team admins can cancel invites",
      code: "INVITE_CANCEL_FORBIDDEN",
    })

    const declineResponse = await declineRoute.POST(
      createInviteTokenRequest("decline")
    )
    expect(declineResponse.status).toBe(409)
    await expect(declineResponse.json()).resolves.toEqual({
      error: "Invite has already been accepted",
      message: "Invite has already been accepted",
      code: "INVITE_ALREADY_ACCEPTED",
    })
  })

  it("preserves logical invite batch contracts across invite routes", async () => {
    const inviteRoute = await import("@/app/api/invites/route")
    const cancelRoute = await import("@/app/api/invites/[inviteId]/route")
    const acceptRoute = await import("@/app/api/invites/accept/route")
    const declineRoute = await import("@/app/api/invites/decline/route")

    createInviteServerMock.mockResolvedValue({
      inviteIds: ["invite_1", "invite_2"],
      batchId: "invite_batch_1",
      token: "token_1",
      workspaceId: "workspace_1",
      invites: [
        {
          id: "invite_1",
          batchId: "invite_batch_1",
          teamId: "team_1",
          token: "token_1",
        },
        {
          id: "invite_2",
          batchId: "invite_batch_1",
          teamId: "team_2",
          token: "token_1",
        },
      ],
    })
    cancelInviteServerMock.mockResolvedValue({
      inviteId: "invite_1",
      cancelledInviteIds: ["invite_1", "invite_2"],
      workspaceId: "workspace_1",
      teamName: "Core",
      workspaceName: "Recipe Room",
    })
    getInviteByTokenServerMock.mockResolvedValue({
      invite: {
        id: "invite_1",
        token: "token_1",
        email: "alex@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        acceptedAt: null,
        declinedAt: null,
      },
      teamNames: ["Core", "Design"],
      workspace: {
        id: "workspace_1",
        slug: "recipe-room",
        name: "Recipe Room",
        logoUrl: "",
      },
    })
    acceptInviteServerMock.mockResolvedValue({
      teamSlug: null,
    })
    declineInviteServerMock.mockResolvedValue({
      inviteId: "invite_1",
      declinedAt: "2026-04-21T12:00:00.000Z",
    })

    const inviteResponse = await inviteRoute.POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamIds: ["team_1", "team_2"],
          email: "alex@example.com",
          role: "member",
        }),
      }) as never
    )

    expect(inviteResponse.status).toBe(200)
    await expect(inviteResponse.json()).resolves.toEqual({
      ok: true,
      inviteIds: ["invite_1", "invite_2"],
      batchId: "invite_batch_1",
      token: "token_1",
      invites: [
        {
          id: "invite_1",
          batchId: "invite_batch_1",
          teamId: "team_1",
          token: "token_1",
        },
        {
          id: "invite_2",
          batchId: "invite_batch_1",
          teamId: "team_2",
          token: "token_1",
        },
      ],
    })
    expect(createInviteServerMock).toHaveBeenCalledTimes(1)
    expect(createInviteServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      teamIds: ["team_1", "team_2"],
      email: "alex@example.com",
      role: "member",
    })
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenCalledWith(
      "workspace_1"
    )

    const cancelInput = createCancelInviteRouteInput()
    const cancelResponse = await cancelRoute.DELETE(
      cancelInput.request,
      cancelInput.context
    )

    expect(cancelResponse.status).toBe(200)
    await expect(cancelResponse.json()).resolves.toEqual({
      ok: true,
      inviteId: "invite_1",
      cancelledInviteIds: ["invite_1", "invite_2"],
      teamName: "Core",
      workspaceName: "Recipe Room",
    })
    expect(cancelInviteServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      inviteId: "invite_1",
    })
    expect(bumpWorkspaceMembershipReadModelScopesServerMock).toHaveBeenCalledWith(
      "workspace_1"
    )

    const acceptResponse = await acceptRoute.POST(
      createInviteTokenRequest("accept")
    )

    expect(acceptResponse.status).toBe(200)
    await expect(acceptResponse.json()).resolves.toEqual({
      ok: true,
      teamSlug: null,
    })
    expect(acceptInviteServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      token: "token_1",
    })
    expect(reconcileAuthenticatedAppContextMock).toHaveBeenCalledWith(
      {
        id: "workos_1",
        email: "alex@example.com",
      },
      "org_1"
    )

    const declineResponse = await declineRoute.POST(
      createInviteTokenRequest("decline")
    )

    expect(declineResponse.status).toBe(200)
    await expect(declineResponse.json()).resolves.toEqual({
      ok: true,
    })
    expect(declineInviteServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      token: "token_1",
    })
  })

  it("invalidates invite refresh scopes using the target workspace id", async () => {
    const inviteRoute = await import("@/app/api/invites/route")
    const cancelRoute = await import("@/app/api/invites/[inviteId]/route")

    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
      authContext: {
        currentWorkspace: {
          id: "workspace_current",
        },
      },
    })
    createInviteServerMock.mockResolvedValue({
      inviteIds: ["invite_1"],
      batchId: "invite_batch_1",
      token: "token_1",
      workspaceId: "workspace_target",
      invites: [
        {
          id: "invite_1",
          batchId: "invite_batch_1",
          teamId: "team_1",
          token: "token_1",
        },
      ],
    })
    cancelInviteServerMock.mockResolvedValue({
      inviteId: "invite_1",
      cancelledInviteIds: ["invite_1"],
      workspaceId: "workspace_target",
      teamName: "Core",
      workspaceName: "Recipe Room",
    })

    await inviteRoute.POST(
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

    await cancelRoute.DELETE(
      new Request("http://localhost/api/invites/invite_1", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          inviteId: "invite_1",
        }),
      }
    )

    expect(
      bumpWorkspaceMembershipReadModelScopesServerMock.mock.calls
    ).toEqual([["workspace_target"], ["workspace_target"]])
  })

  it("maps notification failures to typed error responses", async () => {
    const notificationsRoute = await import("@/app/api/notifications/route")
    const notificationRoute =
      await import("@/app/api/notifications/[notificationId]/route")

    updateNotificationsServerMock.mockRejectedValue(
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
      workspaceId: "workspace_1",
    })

    const response = await POST(
      createDocumentRouteRequest({
          id: "document_new",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          title: "Launch doc",
        }
      )
    )

    await expectDocumentCreationResponse(response)
    expect(createDocumentServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      id: "document_new",
      kind: "workspace-document",
      workspaceId: "workspace_1",
      title: "Launch doc",
    })
    expect(bumpDocumentIndexReadModelScopesServerMock).toHaveBeenCalledWith(
      "workspace",
      "workspace_1"
    )
    expect(
      bumpPrivateDocumentIndexReadModelScopesServerMock
    ).not.toHaveBeenCalled()
    expect(bumpSearchSeedReadModelScopesServerMock).toHaveBeenCalledWith(
      "workspace_1"
    )
    expect(
      bumpPrivateSearchSeedReadModelScopesServerMock
    ).not.toHaveBeenCalled()
  })

  it("uses the created team document workspace for search invalidation", async () => {
    const { POST } = await import("@/app/api/documents/route")

    createDocumentServerMock.mockResolvedValue({
      documentId: "document_new",
      workspaceId: "workspace_2",
    })

    const response = await POST(
      createDocumentRouteRequest({
          id: "document_new",
          kind: "team-document",
          teamId: "team_2",
          title: "Launch doc",
        }
      )
    )

    await expectDocumentCreationResponse(response)
    expect(createDocumentServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      id: "document_new",
      kind: "team-document",
      teamId: "team_2",
      title: "Launch doc",
    })
    expect(bumpDocumentIndexReadModelScopesServerMock).toHaveBeenCalledWith(
      "team",
      "team_2"
    )
    expect(
      bumpPrivateDocumentIndexReadModelScopesServerMock
    ).not.toHaveBeenCalled()
    expect(bumpSearchSeedReadModelScopesServerMock).toHaveBeenCalledWith(
      "workspace_2"
    )
    expect(
      bumpPrivateSearchSeedReadModelScopesServerMock
    ).not.toHaveBeenCalled()
  })

  it("scopes private document invalidations to the owner", async () => {
    const { POST } = await import("@/app/api/documents/route")

    createDocumentServerMock.mockResolvedValue({
      documentId: "document_private",
      workspaceId: "workspace_1",
    })

    const response = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "document_private",
          kind: "private-document",
          workspaceId: "workspace_1",
          title: "Private notes",
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      documentId: "document_private",
    })
    expect(createDocumentServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      id: "document_private",
      kind: "private-document",
      workspaceId: "workspace_1",
      title: "Private notes",
    })
    expect(
      bumpPrivateDocumentIndexReadModelScopesServerMock
    ).toHaveBeenCalledWith("workspace_1", "user_1")
    expect(bumpDocumentIndexReadModelScopesServerMock).not.toHaveBeenCalled()
    expect(
      bumpPrivateSearchSeedReadModelScopesServerMock
    ).toHaveBeenCalledWith("workspace_1", "user_1")
    expect(bumpSearchSeedReadModelScopesServerMock).not.toHaveBeenCalled()
  })
})
