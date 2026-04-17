import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getNowMock = vi.fn()
const listPendingDigestNotificationsMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const getNotificationDocMock = vi.fn()
const normalizeUserMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  getNow: getNowMock,
}))

vi.mock("@/convex/app/data", () => ({
  listPendingDigestNotifications: listPendingDigestNotificationsMock,
  listUsersByIds: listUsersByIdsMock,
  getNotificationDoc: getNotificationDocMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeUser: normalizeUserMock,
}))

function createNotification(input: Partial<Record<string, unknown>> & {
  id: string
  userId: string
}) {
  const { id, userId, ...rest } = input

  return {
    id,
    _id: `${id}_doc`,
    userId,
    actorId: "actor_1",
    message: `${input.id} message`,
    entityType: "workItem",
    entityId: "entity_1",
    type: "mention",
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    digestClaimId: null,
    digestClaimedAt: null,
    createdAt: "2026-04-17T09:00:00.000Z",
    ...rest,
  }
}

describe("notification digest claims", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getNowMock.mockReset()
    listPendingDigestNotificationsMock.mockReset()
    listUsersByIdsMock.mockReset()
    getNotificationDocMock.mockReset()
    normalizeUserMock.mockReset()

    getNowMock.mockReturnValue("2026-04-17T10:00:00.000Z")
    normalizeUserMock.mockImplementation((user) => user)
  })

  it("claims only unclaimed or stale notifications for digest delivery", async () => {
    const pendingNotifications = [
      createNotification({
        id: "notification_1",
        userId: "user_1",
      }),
      createNotification({
        id: "notification_2",
        userId: "user_1",
        digestClaimId: "other-claim",
        digestClaimedAt: "2026-04-17T09:55:00.000Z",
      }),
      createNotification({
        id: "notification_3",
        userId: "user_1",
        digestClaimId: "stale-claim",
        digestClaimedAt: "2026-04-17T09:00:00.000Z",
      }),
      createNotification({
        id: "notification_4",
        userId: "user_2",
      }),
    ]

    listPendingDigestNotificationsMock.mockResolvedValue(pendingNotifications)
    listUsersByIdsMock.mockResolvedValue([
      {
        id: "user_1",
        email: "alex@example.com",
        name: "Alex",
        preferences: {
          emailDigest: true,
        },
      },
      {
        id: "user_2",
        email: "jamie@example.com",
        name: "Jamie",
        preferences: {
          emailDigest: false,
        },
      },
    ])
    getNotificationDocMock.mockImplementation(
      async (_ctx, notificationId: string) =>
        pendingNotifications.find((notification) => notification.id === notificationId) ?? null
    )

    const patchMock = vi.fn()
    const { claimPendingNotificationDigestsHandler } = await import(
      "@/convex/app/notification_handlers"
    )

    const result = await claimPendingNotificationDigestsHandler(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
      }
    )

    expect(result).toEqual([
      {
        user: {
          id: "user_1",
          email: "alex@example.com",
          name: "Alex",
        },
        notifications: [
          expect.objectContaining({
            id: "notification_1",
          }),
          expect.objectContaining({
            id: "notification_3",
          }),
        ],
      },
    ])
    expect(patchMock).toHaveBeenCalledTimes(2)
    expect(patchMock).toHaveBeenCalledWith("notification_1_doc", {
      digestClaimId: "claim_1",
      digestClaimedAt: "2026-04-17T10:00:00.000Z",
    })
    expect(patchMock).toHaveBeenCalledWith("notification_3_doc", {
      digestClaimId: "claim_1",
      digestClaimedAt: "2026-04-17T10:00:00.000Z",
    })
  })

  it("marks only matching claimed notifications as emailed and clears claims", async () => {
    const notificationsById = new Map(
      [
        createNotification({
          id: "notification_1",
          userId: "user_1",
          digestClaimId: "claim_1",
          digestClaimedAt: "2026-04-17T10:00:00.000Z",
        }),
        createNotification({
          id: "notification_2",
          userId: "user_1",
          digestClaimId: "other-claim",
          digestClaimedAt: "2026-04-17T10:00:00.000Z",
        }),
      ].map((notification) => [notification.id, notification])
    )

    getNotificationDocMock.mockImplementation(
      async (_ctx, notificationId: string) =>
        notificationsById.get(notificationId) ?? null
    )

    const patchMock = vi.fn()
    const { markNotificationsEmailedHandler } = await import(
      "@/convex/app/notification_handlers"
    )

    await markNotificationsEmailedHandler(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
        notificationIds: ["notification_1", "notification_2"],
      }
    )

    expect(patchMock).toHaveBeenCalledTimes(1)
    expect(patchMock).toHaveBeenCalledWith("notification_1_doc", {
      digestClaimId: null,
      digestClaimedAt: null,
      emailedAt: "2026-04-17T10:00:00.000Z",
    })
  })

  it("releases only matching unemailed claims", async () => {
    const notificationsById = new Map(
      [
        createNotification({
          id: "notification_1",
          userId: "user_1",
          digestClaimId: "claim_1",
          digestClaimedAt: "2026-04-17T10:00:00.000Z",
        }),
        createNotification({
          id: "notification_2",
          userId: "user_1",
          digestClaimId: "other-claim",
          digestClaimedAt: "2026-04-17T10:00:00.000Z",
        }),
        createNotification({
          id: "notification_3",
          userId: "user_1",
          digestClaimId: "claim_1",
          digestClaimedAt: "2026-04-17T10:00:00.000Z",
          emailedAt: "2026-04-17T10:01:00.000Z",
        }),
      ].map((notification) => [notification.id, notification])
    )

    getNotificationDocMock.mockImplementation(
      async (_ctx, notificationId: string) =>
        notificationsById.get(notificationId) ?? null
    )

    const patchMock = vi.fn()
    const { releaseNotificationDigestClaimHandler } = await import(
      "@/convex/app/notification_handlers"
    )

    await releaseNotificationDigestClaimHandler(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
        notificationIds: [
          "notification_1",
          "notification_2",
          "notification_3",
        ],
      }
    )

    expect(patchMock).toHaveBeenCalledTimes(1)
    expect(patchMock).toHaveBeenCalledWith("notification_1_doc", {
      digestClaimId: null,
      digestClaimedAt: null,
    })
  })
})
