import { describe, expect, it, vi } from "vitest"

import { insertMentionNotifications } from "@/convex/app/collaboration_utils"

describe("collaboration notification utilities", () => {
  it("creates mention notifications and email payloads without duplicate recipients", async () => {
    const insert = vi.fn()
    const notifiedUserIds = new Set(["user_3"])

    const result = await insertMentionNotifications({
      actorId: "user_1",
      actorName: "Alex",
      commentText: "Heads up",
      ctx: {
        db: {
          insert,
        },
      } as never,
      entityId: "doc_1",
      entityLabel: "document",
      entityPath: "/workspace/docs/doc_1",
      entityTitle: "Launch notes",
      entityType: "document",
      mentionUserIds: ["user_1", "user_2", "user_3", "user_2"],
      notifiedUserIds,
      usersById: new Map([
        [
          "user_2",
          {
            email: "sam@example.com",
            name: "Sam",
            preferences: {
              emailMentions: true,
            },
          },
        ],
      ]),
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({
        userId: "user_2",
        actorId: "user_1",
        entityType: "document",
        entityId: "doc_1",
        type: "mention",
      })
    )
    expect(result.notifiedUserIds).toEqual(new Set(["user_3", "user_2"]))
    expect(result.mentionEmails).toEqual([
      expect.objectContaining({
        email: "sam@example.com",
        entityPath: "/workspace/docs/doc_1",
        commentText: "Heads up",
      }),
    ])
  })
})
