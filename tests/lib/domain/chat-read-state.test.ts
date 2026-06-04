import { describe, expect, it } from "vitest"

import {
  getReadableChatMessageReceiptIds,
  getSeenChatMessageIds,
  supportsChatMessageReadReceipts,
} from "@/lib/domain/chat-read-state"

describe("chat read state domain helpers", () => {
  it("derives seen ids only from other participant reads of current-user messages", () => {
    const seenMessageIds = getSeenChatMessageIds({
      conversationId: "conversation_1",
      currentUserId: "user_1",
      participantIds: ["user_1", "user_2"],
      messages: [
        {
          id: "message_sent",
          conversationId: "conversation_1",
          createdBy: "user_1",
          deletedAt: null,
        },
        {
          id: "message_deleted",
          conversationId: "conversation_1",
          createdBy: "user_1",
          deletedAt: "2026-04-22T00:04:00.000Z",
        },
        {
          id: "message_received",
          conversationId: "conversation_1",
          createdBy: "user_2",
          deletedAt: null,
        },
        {
          id: "message_other_conversation",
          conversationId: "conversation_2",
          createdBy: "user_1",
          deletedAt: null,
        },
      ],
      readStates: [
        {
          userId: "user_1",
          conversationId: "conversation_1",
          messageReadAtById: {
            message_sent: "2026-04-22T00:01:00.000Z",
            message_deleted: "2026-04-22T00:01:00.000Z",
            message_received: "2026-04-22T00:01:00.000Z",
            message_other_conversation: "2026-04-22T00:01:00.000Z",
          },
        },
        {
          userId: "user_2",
          conversationId: "conversation_1",
          messageReadAtById: {
            message_sent: "2026-04-22T00:02:00.000Z",
            message_deleted: "2026-04-22T00:02:00.000Z",
            message_received: "2026-04-22T00:02:00.000Z",
            message_other_conversation: "2026-04-22T00:02:00.000Z",
          },
        },
        {
          userId: "user_3",
          conversationId: "conversation_1",
          messageReadAtById: {
            message_sent: "2026-04-22T00:03:00.000Z",
          },
        },
        {
          userId: "user_2",
          conversationId: "conversation_2",
          messageReadAtById: {
            message_other_conversation: "2026-04-22T00:03:00.000Z",
          },
        },
      ],
    })

    expect([...seenMessageIds].sort()).toEqual(["message_sent"])
  })

  it("keeps read receipt writes scoped to non-deleted messages from other users", () => {
    expect(
      getReadableChatMessageReceiptIds({
        conversationId: "conversation_1",
        currentUserId: "user_1",
        messageIds: [
          "message_sent",
          "message_received",
          "message_deleted_received",
          "message_other_conversation",
        ],
        messages: [
          {
            id: "message_sent",
            conversationId: "conversation_1",
            createdBy: "user_1",
            deletedAt: null,
          },
          {
            id: "message_received",
            conversationId: "conversation_1",
            createdBy: "user_2",
            deletedAt: null,
          },
          {
            id: "message_deleted_received",
            conversationId: "conversation_1",
            createdBy: "user_2",
            deletedAt: "2026-04-22T00:03:00.000Z",
          },
          {
            id: "message_other_conversation",
            conversationId: "conversation_2",
            createdBy: "user_2",
            deletedAt: null,
          },
        ],
      })
    ).toEqual(["message_received"])
  })

  it("enables per-message read receipts only for workspace direct and group chats", () => {
    expect(
      supportsChatMessageReadReceipts({
        kind: "chat",
        scopeType: "workspace",
        variant: "direct",
      })
    ).toBe(true)
    expect(
      supportsChatMessageReadReceipts({
        kind: "chat",
        scopeType: "workspace",
        variant: "group",
      })
    ).toBe(true)
    expect(
      supportsChatMessageReadReceipts({
        kind: "chat",
        scopeType: "team",
        variant: "team",
      })
    ).toBe(false)
    expect(
      supportsChatMessageReadReceipts({
        kind: "channel",
        scopeType: "team",
        variant: "team",
      })
    ).toBe(false)
  })
})
