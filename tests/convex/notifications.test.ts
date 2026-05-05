import { describe, expect, it, vi } from "vitest"

const { getTeamDocMock } = vi.hoisted(() => ({
  getTeamDocMock: vi.fn(),
}))

vi.mock("@/convex/app/data", () => ({
  getConversationDoc: vi.fn(),
  getNotificationDoc: vi.fn(),
  getTeamDoc: getTeamDocMock,
}))

import {
  archiveInviteNotifications,
  getChannelConversationPath,
  getChatConversationPath,
} from "@/convex/app/notifications"

function createQuery(notifications: Array<Record<string, unknown>>) {
  return {
    withIndex: vi.fn((_indexName, callback) => {
      callback({
        eq: vi.fn(() => ({})),
      })

      return {
        collect: vi.fn().mockResolvedValue(notifications),
      }
    }),
  }
}

describe("notification helpers", () => {
  it("archives only invite notifications owned by the user", async () => {
    const patch = vi.fn()
    const notifications = [
      {
        _id: "notification_doc_1",
        entityType: "invite",
        entityId: "invite_1",
        readAt: null,
      },
      {
        _id: "notification_doc_2",
        entityType: "invite",
        entityId: "invite_2",
        readAt: "2026-04-18T09:00:00.000Z",
      },
      {
        _id: "notification_doc_3",
        entityType: "chat",
        entityId: "invite_1",
        readAt: null,
      },
    ]

    await archiveInviteNotifications(
      {
        db: {
          patch,
          query: vi.fn(() => createQuery(notifications)),
        },
      } as never,
      {
        userId: "user_1",
        inviteIds: ["invite_1", "invite_2"],
      }
    )

    expect(patch).toHaveBeenCalledTimes(2)
    expect(patch).toHaveBeenCalledWith(
      "notification_doc_1",
      expect.objectContaining({
        readAt: expect.any(String),
        archivedAt: expect.any(String),
      })
    )
    expect(patch).toHaveBeenCalledWith(
      "notification_doc_2",
      expect.objectContaining({
        readAt: "2026-04-18T09:00:00.000Z",
        archivedAt: expect.any(String),
      })
    )
  })

  it("skips archive lookups when no invite ids are provided", async () => {
    const query = vi.fn()

    await archiveInviteNotifications(
      {
        db: {
          query,
        },
      } as never,
      {
        userId: "user_1",
        inviteIds: [],
      }
    )

    expect(query).not.toHaveBeenCalled()
  })

  it("resolves channel and chat paths for workspace, team, and fallback scopes", async () => {
    const ctx = {
      db: {},
    } as never
    const teamCtx = {
      db: {},
    } as never

    getTeamDocMock.mockResolvedValueOnce({
      slug: "platform",
    } as never)
    await expect(
      getChannelConversationPath(
        teamCtx,
        {
          kind: "channel",
          scopeType: "team",
          scopeId: "team_1",
        } as never,
        "post_1"
      )
    ).resolves.toBe("/team/platform/channel#post_1")
    expect(
      await getChannelConversationPath(
        ctx,
        {
          kind: "channel",
          scopeType: "workspace",
        } as never,
        "post_2"
      )
    ).toBe("/workspace/channel#post_2")
    expect(await getChannelConversationPath(ctx, null, "post_3")).toBe(
      "/inbox#post_3"
    )

    getTeamDocMock.mockResolvedValueOnce(null)
    await expect(
      getChatConversationPath(
        teamCtx,
        {
          id: "conversation_1",
          kind: "chat",
          scopeType: "team",
          scopeId: "team_1",
        } as never
      )
    ).resolves.toBe("/chats")
    expect(
      await getChatConversationPath(ctx, {
        id: "conversation_2",
        kind: "chat",
        scopeType: "workspace",
      } as never)
    ).toBe("/chats?chatId=conversation_2")
    expect(await getChatConversationPath(ctx, null)).toBe("/chats")
  })
})
