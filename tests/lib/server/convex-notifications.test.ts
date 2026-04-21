import { beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
  runConvexRequestWithRetry: async (
    _label: string,
    request: () => Promise<unknown>
  ) => request(),
}))

describe("convex notification and invite wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
  })

  it("maps invite mutation failures to typed application errors", async () => {
    const {
      acceptInviteServer,
      cancelInviteServer,
      createInviteServer,
      declineInviteServer,
    } = await import("@/lib/server/convex/notifications")

    mutationMock
      .mockRejectedValueOnce(new Error("Team not found"))
      .mockRejectedValueOnce(new Error("Only team admins can cancel invites"))
      .mockRejectedValueOnce(new Error("Invite has been declined"))
      .mockRejectedValueOnce(new Error("Invite has already been accepted"))

    await expect(
      createInviteServer({
        currentUserId: "user_1",
        teamIds: ["team_1"],
        email: "alex@example.com",
        role: "member",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "TEAM_NOT_FOUND",
    })

    await expect(
      cancelInviteServer({
        currentUserId: "user_1",
        inviteId: "invite_1",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "INVITE_CANCEL_FORBIDDEN",
    })

    await expect(
      acceptInviteServer({
        currentUserId: "user_1",
        token: "token_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "INVITE_DECLINED",
    })

    await expect(
      declineInviteServer({
        currentUserId: "user_1",
        token: "token_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "INVITE_ALREADY_ACCEPTED",
    })
  })

  it("maps notification mutation failures to typed application errors", async () => {
    const {
      archiveNotificationServer,
      deleteNotificationServer,
      markNotificationReadServer,
    } = await import("@/lib/server/convex/notifications")

    mutationMock
      .mockRejectedValueOnce(new Error("Notification not found"))
      .mockRejectedValueOnce(new Error("You do not have access to this notification"))
      .mockRejectedValueOnce(new Error("Notification not found"))

    await expect(
      markNotificationReadServer({
        currentUserId: "user_1",
        notificationId: "notification_1",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "NOTIFICATION_NOT_FOUND",
    })

    await expect(
      archiveNotificationServer({
        currentUserId: "user_1",
        notificationId: "notification_1",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "NOTIFICATION_ACCESS_DENIED",
    })

    await expect(
      deleteNotificationServer({
        currentUserId: "user_1",
        notificationId: "notification_1",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "NOTIFICATION_NOT_FOUND",
    })
  })
})
