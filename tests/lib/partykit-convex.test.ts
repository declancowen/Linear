import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.hoisted(() => vi.fn())
const mutationMock = vi.hoisted(() => vi.fn())
const convexHttpClientMock = vi.hoisted(() =>
  vi.fn(
    class MockConvexHttpClient {
      query = queryMock
      mutation = mutationMock
    }
  )
)

vi.mock("convex/browser", () => ({
  ConvexHttpClient: convexHttpClientMock,
}))

describe("partykit convex helpers", () => {
  beforeEach(() => {
    queryMock.mockReset()
    mutationMock.mockReset()
    convexHttpClientMock.mockClear()
  })

  it("queries collaboration documents through Convex with the server token", async () => {
    queryMock.mockResolvedValue({
      documentId: "doc_1",
      kind: "team-document",
    })

    const { getCollaborationDocumentFromConvex } = await import(
      "@/lib/collaboration/partykit-convex"
    )

    await getCollaborationDocumentFromConvex(
      {
        CONVEX_URL: "https://convex-dev.example",
        CONVEX_SERVER_TOKEN: "server-token",
      },
      {
        currentUserId: "user_1",
        documentId: "doc_1",
      }
    )

    expect(convexHttpClientMock).toHaveBeenCalledWith(
      "https://convex-dev.example"
    )
    expect(queryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentUserId: "user_1",
        documentId: "doc_1",
        serverToken: "server-token",
      })
    )
  })

  it("fails fast when the hosted worker is missing its Convex configuration", async () => {
    const { bumpScopedReadModelsFromConvex } = await import(
      "@/lib/collaboration/partykit-convex"
    )

    await expect(
      bumpScopedReadModelsFromConvex(
        {
          CONVEX_SERVER_TOKEN: "server-token",
        },
        {
          scopeKeys: ["document-detail:doc_1"],
        }
      )
    ).rejects.toThrow("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")

    expect(mutationMock).not.toHaveBeenCalled()
  })
})
