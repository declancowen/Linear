import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

describe("useScopedReadModelRefresh", () => {
  beforeEach(() => {
    vi.resetModules()
    mergeReadModelDataMock.mockReset()
    openScopedInvalidationStreamMock.mockReset()
    isScopedSyncEnabledMock.mockReset()
    isScopedSyncEnabledMock.mockReturnValue(true)
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
})
