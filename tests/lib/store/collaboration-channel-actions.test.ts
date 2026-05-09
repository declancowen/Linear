import { describe, expect, it } from "vitest"

import { addChannelFollowerNotifications } from "@/lib/store/app-store-internal/slices/collaboration-channel-notifications"

describe("collaboration channel notification helpers", () => {
  it("notifies eligible followers once for channel comments", () => {
    const notifications = [] as Array<{
      actorId: string
      entityId: string
      entityType: string
      title: string
      type: string
      userId: string
    }>
    const notifiedUserIds = new Set(["user_already"])

    addChannelFollowerNotifications(notifications as never, {
      actorName: "Alex",
      audienceUserIds: ["user_2", "user_already"],
      currentUserId: "user_1",
      entityId: "post_1",
      entityTitle: "the roadmap thread",
      followerIds: ["", "user_outside", "user_1", "user_already", "user_2"],
      notifiedUserIds,
    })

    expect(notifications).toEqual([
      expect.objectContaining({
        actorId: "user_1",
        entityId: "post_1",
        entityType: "channelPost",
        message: "Alex commented on the roadmap thread",
        type: "comment",
        userId: "user_2",
      }),
    ])
    expect([...notifiedUserIds].sort()).toEqual(["user_2", "user_already"])
  })
})
