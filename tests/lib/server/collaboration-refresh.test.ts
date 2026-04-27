import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("collaboration refresh notifications", () => {
  beforeEach(() => {
    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
    process.env.NEXT_PUBLIC_PARTYKIT_URL = "https://partykit.example.com"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("returns success when PartyKit accepts the refresh notification", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { notifyCollaborationDocumentChangedServer } =
      await import("@/lib/server/collaboration-refresh")

    await expect(
      notifyCollaborationDocumentChangedServer({
        documentId: "doc_1",
        kind: "canonical-updated",
        reason: "test",
      })
    ).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining(
          "/parties/main/doc%3Adoc_1?action=refresh"
        ),
      }),
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    )
  })

  it("aborts refresh notifications after the configured timeout", async () => {
    vi.useFakeTimers()
    vi.stubEnv("COLLABORATION_REFRESH_TIMEOUT_MS", "25")
    const fetchMock = vi.fn(
      (_url: URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"))
          })
        })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { notifyCollaborationDocumentChangedServer } =
      await import("@/lib/server/collaboration-refresh")

    const resultPromise = notifyCollaborationDocumentChangedServer({
      documentId: "doc_1",
      kind: "canonical-updated",
      reason: "test",
    })

    await vi.advanceTimersByTimeAsync(25)

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: "Collaboration refresh notification timed out after 25ms",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal?.aborted
    ).toBe(true)
  })
})
