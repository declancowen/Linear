import { beforeEach, describe, expect, it, vi } from "vitest"

const listUsersByIdsMock = vi.fn()

vi.mock("@/convex/app/data", () => ({
  listUsersByIds: listUsersByIdsMock,
}))

describe("document presence normalization", () => {
  beforeEach(() => {
    listUsersByIdsMock.mockReset()
  })

  it("prefers the stored Convex user avatar over the transient presence payload", async () => {
    const { listDocumentPresenceViewers } = await import(
      "@/convex/app/normalization"
    )

    listUsersByIdsMock.mockResolvedValue([
      {
        id: "user_2",
        name: "Sam Stored",
        avatarUrl: "SS",
        avatarImageStorageId: "storage_1",
        workosUserId: "workos_2",
        status: "active",
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      },
    ])

    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn().mockResolvedValue([
              {
                userId: "user_2",
                workosUserId: "workos_2",
                name: "Sam Presence",
                avatarUrl: "https://example.com/google-photo.png",
                lastSeenAt: new Date().toISOString(),
              },
            ]),
          })),
        })),
      },
      storage: {
        getUrl: vi.fn().mockResolvedValue("https://example.com/convex-photo.png"),
      },
    }

    await expect(
      listDocumentPresenceViewers(
        ctx as never,
        "document_1",
        "user_1",
        "workos_1"
      )
    ).resolves.toEqual([
      {
        userId: "workos_2",
        name: "Sam Stored",
        avatarUrl: "SS",
        avatarImageUrl: "https://example.com/convex-photo.png",
        lastSeenAt: expect.any(String),
      },
    ])
  })
})
