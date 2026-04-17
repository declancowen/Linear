describe("document presence normalization", () => {
  it("returns the stored presence payload without additional user resolution", async () => {
    const { listDocumentPresenceViewers } = await import(
      "@/convex/app/normalization"
    )

    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn().mockResolvedValue([
              {
                userId: "user_2",
                workosUserId: "workos_2",
                name: "Sam Stored",
                avatarUrl: "SS",
                avatarImageUrl: "https://example.com/convex-photo.png",
                lastSeenAt: new Date().toISOString(),
              },
            ]),
          })),
        })),
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
