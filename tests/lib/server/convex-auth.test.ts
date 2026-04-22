import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.fn()
const mutationMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    query: queryMock,
    mutation: mutationMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
  runConvexRequestWithRetry: async (
    _label: string,
    request: () => Promise<unknown>
  ) => request(),
}))

describe("convex auth server wrappers", () => {
  beforeEach(() => {
    queryMock.mockReset()
    mutationMock.mockReset()
    mutationMock.mockResolvedValue({ scheduled: true })
  })

  it("maps snapshot lookup failures to typed application errors", async () => {
    const {
      getScopedReadModelVersionsServer,
      getSnapshotServer,
      getSnapshotVersionServer,
    } = await import(
      "@/lib/server/convex/auth"
    )

    queryMock
      .mockRejectedValueOnce(new Error("Authenticated user not found"))
      .mockRejectedValueOnce(new Error("Authenticated user not found"))
      .mockResolvedValueOnce({
        versions: [
          {
            scopeKey: "document-detail:doc_1",
            version: 3,
          },
        ],
      })

    await expect(
      getSnapshotServer({
        workosUserId: "workos_1",
        email: "alex@example.com",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "SNAPSHOT_USER_NOT_FOUND",
    })

    await expect(
      getSnapshotVersionServer({
        workosUserId: "workos_1",
        email: "alex@example.com",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "SNAPSHOT_USER_NOT_FOUND",
    })

    await expect(
      getScopedReadModelVersionsServer({
        scopeKeys: ["document-detail:doc_1"],
      })
    ).resolves.toEqual({
      versions: [
        {
          scopeKey: "document-detail:doc_1",
          version: 3,
        },
      ],
    })

    expect(mutationMock).toHaveBeenCalled()
  })

  it("falls back when scoped read model functions are unavailable", async () => {
    const {
      bumpScopedReadModelVersionsServer,
      getScopedReadModelVersionsServer,
    } = await import(
      "@/lib/server/convex/auth"
    )

    queryMock.mockRejectedValue(
      new Error(
        "Could not find public function for 'app:getScopedReadModelVersions'. Did you forget to run `npx convex dev`?"
      )
    )
    mutationMock.mockRejectedValue(
      new Error(
        "Could not find public function for 'app:bumpScopedReadModelVersions'. Did you forget to run `npx convex dev`?"
      )
    )

    await expect(
      getScopedReadModelVersionsServer({
        scopeKeys: ["document-detail:doc_1", "document-detail:doc_1"],
      })
    ).resolves.toEqual({
      versions: [
        {
          scopeKey: "document-detail:doc_1",
          version: 0,
        },
      ],
    })

    await expect(
      bumpScopedReadModelVersionsServer({
        scopeKeys: ["document-detail:doc_1"],
      })
    ).resolves.toEqual({
      versions: [
        {
          scopeKey: "document-detail:doc_1",
          version: 0,
        },
      ],
    })
  })
})
