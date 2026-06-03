import { act, render, renderHook, waitFor } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mergeReadModelDataMock = vi.fn()
const openScopedInvalidationStreamMock = vi.fn()
const isScopedSyncEnabledMock = vi.fn()
const redirectToExpiredSessionLoginMock = vi.fn()
const reportFirstUsefulRenderDiagnosticMock = vi.fn()

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportFirstUsefulRenderDiagnostic: reportFirstUsefulRenderDiagnosticMock,
  reportScopedReadModelDiagnostic: vi.fn(),
  reportScopedStreamReconnectDiagnostic: vi.fn(),
}))

vi.mock("@/lib/browser/session-redirect", () => ({
  redirectToExpiredSessionLogin: redirectToExpiredSessionLoginMock,
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  isScopedSyncEnabled: isScopedSyncEnabledMock,
}))

vi.mock("@/lib/scoped-sync/client", () => ({
  openScopedInvalidationStream: openScopedInvalidationStreamMock,
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: (
    selector: (state: {
      mergeReadModelData: typeof mergeReadModelDataMock
    }) => unknown
  ) =>
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

function createTwoStepFetchMock() {
  const firstFetch = createDeferred<Record<string, never>>()
  const secondFetch = createDeferred<Record<string, never>>()
  const fetchLatestMock = vi
    .fn()
    .mockImplementationOnce(() => firstFetch.promise)
    .mockImplementationOnce(() => secondFetch.promise)

  return {
    fetchLatestMock,
    firstFetch,
    secondFetch,
  }
}

type ScopedStreamHandlers = {
  onReady?: (envelope?: {
    versions: Array<{
      scopeKey: string
      version: number
    }>
  }) => void
  onInvalidate?: (envelope?: {
    versions: Array<{
      scopeKey: string
      version: number
    }>
  }) => void
  onUnavailable?: () => void
}

function captureScopedStreamHandlers() {
  let handlers: ScopedStreamHandlers | undefined

  openScopedInvalidationStreamMock.mockImplementation((input) => {
    handlers = input
    return vi.fn()
  })

  return () => handlers
}

async function renderDefaultScopedRefresh(
  fetchLatestMock = vi.fn().mockResolvedValue({})
) {
  const { useScopedReadModelRefresh } =
    await import("@/hooks/use-scoped-read-model-refresh")

  renderHook(() =>
    useScopedReadModelRefresh({
      enabled: true,
      scopeKeys: ["scope:a"],
      fetchLatest: fetchLatestMock,
    })
  )

  return fetchLatestMock
}

async function flushScopedRefreshEvent(callback?: () => void) {
  await act(async () => {
    callback?.()
    await Promise.resolve()
  })
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
    redirectToExpiredSessionLoginMock.mockReset()
    reportFirstUsefulRenderDiagnosticMock.mockReset()
    isScopedSyncEnabledMock.mockReturnValue(true)
    openScopedInvalidationStreamMock.mockReturnValue(vi.fn())
  })

  it("does not refresh when reconnect ready reports unchanged scoped versions", async () => {
    const getHandlers = captureScopedStreamHandlers()
    const fetchLatestMock = await renderDefaultScopedRefresh()

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)
  })

  it("refreshes when reconnect ready reports changed scoped versions", async () => {
    const getHandlers = captureScopedStreamHandlers()
    const fetchLatestMock = await renderDefaultScopedRefresh()

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 2,
          },
        ],
      })
    )

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(2)
    })
  })

  it("retries a failed scoped refresh on the next ready event", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    const getHandlers = captureScopedStreamHandlers()
    const fetchLatestMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValue({})
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

    const { result } = renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
      })
    )

    await waitFor(() => {
      expect(result.current.error).toBe("Network failed")
    })

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(2)
    })
    consoleErrorSpy.mockRestore()
  })

  it("falls back to periodic refresh when the scoped stream is unavailable", async () => {
    const getHandlers = captureScopedStreamHandlers()
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

    const fetchLatestMock = await renderDefaultScopedRefresh()

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    await flushScopedRefreshEvent(getHandlers()?.onUnavailable)

    expect(fetchLatestMock).toHaveBeenCalledTimes(2)

    await flushScopedRefreshEvent(degradedRefreshCallback ?? undefined)

    expect(fetchLatestMock).toHaveBeenCalledTimes(3)

    await flushScopedRefreshEvent(() =>
      getHandlers()?.onReady?.({
        versions: [
          {
            scopeKey: "scope:a",
            version: 1,
          },
        ],
      })
    )

    expect(fetchLatestMock).toHaveBeenCalledTimes(3)
    expect(degradedRefreshCallback).not.toBeNull()
    expect(setIntervalSpy).toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it("gates focus and online refreshes by visibility and staleness", async () => {
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-06-03T10:00:00.000Z").getTime())
    const visibilityStateSpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible")
    const fetchLatestMock = await renderDefaultScopedRefresh()

    await waitFor(() => {
      expect(fetchLatestMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      window.dispatchEvent(new Event("online"))
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    dateNowSpy.mockReturnValue(new Date("2026-06-03T10:00:31.000Z").getTime())
    visibilityStateSpy.mockReturnValue("hidden")

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(1)

    visibilityStateSpy.mockReturnValue("visible")

    await act(async () => {
      window.dispatchEvent(new Event("online"))
      await Promise.resolve()
    })

    expect(fetchLatestMock).toHaveBeenCalledTimes(2)
  })

  it("treats scoped refresh as loaded when scoped sync is disabled", async () => {
    isScopedSyncEnabledMock.mockReturnValue(false)

    const fetchLatestMock = vi.fn().mockResolvedValue({})
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

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
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

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

  it("redirects to login instead of surfacing a 401 scoped refresh error", async () => {
    const { RouteMutationError } = await import("@/lib/convex/client/shared")
    const fetchLatestMock = vi
      .fn()
      .mockRejectedValue(new RouteMutationError("Unauthorized", 401))
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

    const { result } = renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
      })
    )

    await waitFor(() => {
      expect(redirectToExpiredSessionLoginMock).toHaveBeenCalledTimes(1)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.hasLoadedOnce).toBe(false)
  })

  it("does not clear the active in-flight guard when a stale generation settles", async () => {
    const { fetchLatestMock, firstFetch, secondFetch } =
      createTwoStepFetchMock()
    fetchLatestMock.mockResolvedValue({})
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

    const { rerender } = renderHook(
      ({ scopeKeys }: { scopeKeys: string[] }) =>
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
    const { fetchLatestMock, firstFetch, secondFetch } =
      createTwoStepFetchMock()
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")
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

  it("reports first useful render from retained data before a scoped refresh resolves", async () => {
    const fetchState = createDeferred<Record<string, never>>()
    const fetchLatestMock = vi.fn(() => fetchState.promise)
    const { useScopedReadModelRefresh } =
      await import("@/hooks/use-scoped-read-model-refresh")

    renderHook(() =>
      useScopedReadModelRefresh({
        enabled: true,
        scopeKeys: ["scope:a"],
        fetchLatest: fetchLatestMock,
        diagnostics: {
          retainedData: true,
          surface: "work-item/detail",
        },
      })
    )

    await waitFor(() => {
      expect(reportFirstUsefulRenderDiagnosticMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readModelLoaded: false,
          retainedData: true,
          scopeKeys: ["scope:a"],
          surface: "work-item/detail",
        })
      )
    })

    await act(async () => {
      fetchState.resolve({})
      await Promise.resolve()
    })

    expect(reportFirstUsefulRenderDiagnosticMock).toHaveBeenCalledTimes(1)
  })
})
