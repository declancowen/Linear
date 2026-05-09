"use client"

import { createNotification } from "../helpers"
import type { AppStore } from "../types"

type NotificationRecord = AppStore["notifications"][number]

export function addChannelFollowerNotifications(
  notifications: NotificationRecord[],
  input: {
    actorName: string
    audienceUserIds: string[]
    currentUserId: string
    entityId: string
    entityTitle: string
    followerIds: string[]
    notifiedUserIds: Set<string>
  }
) {
  for (const followerId of input.followerIds) {
    if (
      !followerId ||
      !input.audienceUserIds.includes(followerId) ||
      followerId === input.currentUserId ||
      input.notifiedUserIds.has(followerId)
    ) {
      continue
    }

    notifications.unshift(
      createNotification(
        followerId,
        input.currentUserId,
        `${input.actorName} commented on ${input.entityTitle}`,
        "channelPost",
        input.entityId,
        "comment"
      )
    )
    input.notifiedUserIds.add(followerId)
  }
}
