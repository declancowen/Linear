import { act, render, renderHook, waitFor } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mergeReadModelDataMock = vi.fn()
const openScopedInvalidationStreamMock = vi.fn()
const isScopedSyncEnabledMock = vi.fn()

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportScopedReadModelDiagnostic: vi.fn(),
  reportScopedStreamReconnectDiagnostic: vi.fn(),
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  isScopedSyncEnabled: isScopedSyncEnabledMock,
}))

vi.mock("@/lib/scoped-sync/client", () => ({
  openScopedInvalidationStream: openScopedInvalidationStreamMock,
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: (selector: (state: { mergeReadModelData: typeof mergeReadModelDataMock }) => unknown) =>
    selector({
      mergeReadModelData: mergeReadModelDataMock,
    }),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}

describe("useScopedReadModelRefresh", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    mergeReadModelDataMock.mockReset()
    openScopedInvalidationStreamMock.mockReset()
    isScopedSyncEnabledMock.mockReset()
    isScopedSyncEnabledMock.mockReturnValue(true)
    openScopedInvalidationStreamMock.mockReturnValue(vi.fn())
  })

  it("refreshes when the scoped stream reports ready after the initial handshake", async () => {
    let handlers:
      | {
          onReady?: () => void
          onInvalidate?: () => void
        }
      | undefined

    openScopedInvalidationStreamMock.mockImplementation((input) => {
      handlers = input
      return vi.fn()
    })

    const fetchLatestMock = vi.fn().mockResolvedValue({})
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )

    renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
      })
    )

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      handlers?.onReady?.()
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      handlers?.onReady?.()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(2)
    })
  })

  it("falls back to periodic refresh when the scoped stream is unavailable", async () => {
    let handlers:
      | {
          onReady?: () => void
          onUnavailable?: () => void
        }
      | undefined
    let degradedRefreshCallback: (() => void) | null = null

    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation((callback) => {
        degradedRefreshCallback = callback as () => void
        return 1 as unknown as ReturnType<typeof setInterval>
      })
    const clearIntervalSpy = vi
      .spyOn(window, "clearInterval")
      .mockImplementation(() => {})

    openScopedInvalidationStreamMock.mockImplementation((input) => {
      handlers = input
      return vi.fn()
    })

    const fetchLatestMock = vi.fn().mockResolvedValue({})
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )

    renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
      })
    )

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      handlers?.onUnavailable?.()
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      degradedRefreshCallback?.()
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(3)

    await act(async () => {
      handlers?.onReady?.()
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(3)
    expect(degradedRefreshCallback).not.toBeNull()
    expect(setIntervalSpy).toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it("treats scoped refresh as loaded when scoped sync is disabled", async () => {
    isScopedSyncEnabledMock.mockReturnValue(false)

    const fetchLatestMock = vi.fn().mockResolvedValue({})
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )

    const { result } = renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
      })
    )

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true)
    })

    expect(result.current.refreshing).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchLatestMock).not.toHaveBeenCalled()
    expect(openScopedInvalidationStreamMock).not.toHaveBeenCalled()
  })

  it("prunes stale scoped detail state when the fetch returns 404", async () => {
    const { RouteMutationError } = await import("@/lib/convex/client/shared")
    const fetchLatestMock = vi
      .fn()
      .mockRejectedValue(new RouteMutationError("Not found", 404))
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )

    const { result } = renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:detail"],
        fetchLatest: fetchLatestMock,
        notFoundResult: {
          data: {
            documents: [],
            comments: [],
            users: [],
            attachments: [],
          },
          replace: [
            {
              kind: "document-detail",
              documentId: "doc_1",
            },
          ],
        },
      })
    )

    await waitFor(() => {
      expect(result.current.hasLoadedOnce).toBe(true)
    })

    expect(result.current.error).toBeNull()
    expect(mergeReadModelDataMock).toHaveBeenCalledWith(
      {
        documents: [],
        comments: [],
        users: [],
        attachments: [],
      },
      {
        replace: [
          {
            kind: "document-detail",
            documentId: "doc_1",
          },
        ],
      }
    )
  })

  it("does not clear the active in-flight guard when a stale generation settles", async () => {
    const firstFetch = createDeferred<Record<string, never>>()
    const secondFetch = createDeferred<Record<string, never>>()
    const fetchLatestMock = vi
      .fn()
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementationOnce(() => secondFetch.promise)
      .mockResolvedValue({})
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )

    const { rerender } = renderHook(
      ({
        scopeKeys,
      }: {
        scopeKeys: string[]
      }) =>
        useScopedReadModelRefresh({
          enabled: true,
          scopeKeys,
          fetchLatest: fetchLatestMock,
        }),
      {
        initialProps: {
          scopeKeys: ["scope:a"],
        },
      }
    )

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    rerender({
      scopeKeys: ["scope:b"],
    })

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      firstFetch.resolve({})
      await Promise.resolve()
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      secondFetch.resolve({})
      await Promise.resolve()
    })
  })

  it("does not report a new scope as loaded before that scope finishes its first refresh", async () => {
    const firstFetch = createDeferred<Record<string, never>>()
    const secondFetch = createDeferred<Record<string, never>>()
    const fetchLatestMock = vi
      .fn()
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementationOnce(() => secondFetch.promise)
    const { useScopedReadModelRefresh } = await import(
      "@/hooks/use-scoped-read-model-refresh"
    )
    const committedStates: string[] = []

    function Probe({ scopeKey }: { scopeKey: string }) {
      const { hasLoadedOnce } = useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: [scopeKey],
        fetchLatest: fetchLatestMock,
      })

      useLayoutEffect(() => {
        committedStates.push(
          `${scopeKey}:${hasLoadedOnce ? "loaded" : "loading"}`
        )
      })

      return null
    }

    const { rerender } = render(<Probe scopeKey="scope:a" />)

    await act(async () => {
      firstFetch.resolve({})
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(committedStates).toContain("scope:a:loaded")
    })

    committedStates.length = 0

    rerender(<Probe scopeKey="scope:b" />)

    expect(committedStates[0]).toBe("scope:b:loading")
    expect(committedStates).not.toContain("scope:b:loaded")

    await act(async () => {
      secondFetch.resolve({})
      await Promise.resolve()
    })
  })
})
