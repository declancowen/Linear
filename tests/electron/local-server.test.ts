import { afterEach, describe, expect, it, vi } from "vitest"

const { waitForUrl } = await import("../../electron/local-server.cjs")

describe("electron local server helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("waits for a reachable URL and treats non-5xx responses as ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    await expect(waitForUrl("http://localhost:3000")).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000", {
      method: "HEAD",
    })
  })

  it("times out when the URL keeps failing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))

    await expect(waitForUrl("http://localhost:3000", 1)).rejects.toThrow(
      "Timed out waiting for http://localhost:3000"
    )
  })
})
