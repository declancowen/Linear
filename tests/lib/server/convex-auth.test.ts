import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    query: queryMock,
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
  })

  it("maps snapshot lookup failures to typed application errors", async () => {
    const { getSnapshotServer, getSnapshotVersionServer } = await import(
      "@/lib/server/convex/auth"
    )

    queryMock
      .mockRejectedValueOnce(new Error("Authenticated user not found"))
      .mockRejectedValueOnce(new Error("Authenticated user not found"))

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
  })
})
