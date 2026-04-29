import { describe, expect, it } from "vitest"

import {
  appendPendingNotificationToastIds,
  isViewingNotificationTarget,
} from "@/components/app/notification-routing"
import type { Notification } from "@/lib/domain/types"

function notification(
  entityType: Notification["entityType"],
  entityId: string
): Notification {
  return {
    id: `notification_${entityId}`,
    userId: "user_1",
    type: entityType === "chat" ? "message" : "mention",
    entityType,
    entityId,
    actorId: "user_2",
    message: "New notification",
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt: "2026-04-29T15:40:00.000Z",
  }
}

describe("notification routing", () => {
  it("queues every unknown notification toast once in candidate order", () => {
    const knownIds = new Set(["notification_seen"])
    const pendingIds = ["notification_existing"]

    appendPendingNotificationToastIds({
      candidates: [
        { id: "notification_seen" },
        { id: "notification_first" },
        { id: "notification_second" },
      ],
      knownIds,
      pendingIds,
    })

    appendPendingNotificationToastIds({
      candidates: [{ id: "notification_first" }, { id: "notification_second" }],
      knownIds,
      pendingIds,
    })

    expect(pendingIds).toEqual([
      "notification_existing",
      "notification_first",
      "notification_second",
    ])
    expect([...knownIds]).toEqual([
      "notification_seen",
      "notification_first",
      "notification_second",
    ])
  })

  it("does not suppress workspace chat notifications for a different active chat", () => {
    expect(
      isViewingNotificationTarget({
        notification: notification("chat", "conversation_target"),
        href: "/chats?chatId=conversation_target",
        pathname: "/chats",
        searchParams: new URLSearchParams({
          chatId: "conversation_other",
        }),
      })
    ).toBe(false)
  })

  it("suppresses workspace chat notifications only when the chatId matches", () => {
    expect(
      isViewingNotificationTarget({
        notification: notification("chat", "conversation_target"),
        href: "/chats?chatId=conversation_target",
        pathname: "/chats",
        searchParams: new URLSearchParams({
          chatId: "conversation_target",
        }),
      })
    ).toBe(true)
  })

  it("suppresses team chat notifications by route when the target has no chatId", () => {
    expect(
      isViewingNotificationTarget({
        notification: notification("chat", "conversation_team"),
        href: "/team/platform/chat",
        pathname: "/team/platform/chat",
        searchParams: new URLSearchParams(),
      })
    ).toBe(true)
  })

  it("still suppresses non-chat notifications by target route", () => {
    expect(
      isViewingNotificationTarget({
        notification: notification("workItem", "item_1"),
        href: "/items/item_1",
        pathname: "/items/item_1",
        searchParams: new URLSearchParams(),
      })
    ).toBe(true)
  })
})
