import { beforeEach, describe, expect, it, vi } from "vitest"

const scopedSyncMocks = vi.hoisted(() => ({
  getReadModelVersionDoc: vi.fn(),
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: vi.fn(),
  getNow: () => "2026-04-21T09:00:00.000Z",
}))

vi.mock("@/convex/app/data", () => ({
  getReadModelVersionDoc: scopedSyncMocks.getReadModelVersionDoc,
}))

describe("scoped sync handlers", () => {
  beforeEach(() => {
    scopedSyncMocks.getReadModelVersionDoc.mockReset()
  })

  it("bumps unique non-empty scope versions with insert and patch paths", async () => {
    const { bumpScopedReadModelVersionsHandler } = await import(
      "@/convex/app/scoped_sync"
    )
    const ctx = {
      db: {
        insert: vi.fn(),
        patch: vi.fn(),
      },
    }

    scopedSyncMocks.getReadModelVersionDoc
      .mockResolvedValueOnce({
        _id: "version_doc_1",
        version: 4,
      })
      .mockResolvedValueOnce(null)

    await expect(
      bumpScopedReadModelVersionsHandler(ctx as never, {
        serverToken: "server_token",
        scopeKeys: [" workspace:1 ", "workspace:1", "", "team:1"],
      })
    ).resolves.toEqual({
      versions: [
        {
          scopeKey: "workspace:1",
          version: 5,
        },
        {
          scopeKey: "team:1",
          version: 1,
        },
      ],
    })
    expect(ctx.db.patch).toHaveBeenCalledWith("version_doc_1", {
      version: 5,
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
    expect(ctx.db.insert).toHaveBeenCalledWith("readModelVersions", {
      scopeKey: "team:1",
      version: 1,
      updatedAt: "2026-04-21T09:00:00.000Z",
    })
  })
})
