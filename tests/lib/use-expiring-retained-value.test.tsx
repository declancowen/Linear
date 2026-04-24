import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useExpiringRetainedValue } from "@/hooks/use-expiring-retained-value"

type RetainedWorkspaceValue = {
  id: string
  name: string
}

type HookProps = {
  value: RetainedWorkspaceValue | null
  retentionKey: string | null
}

describe("useExpiringRetainedValue", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("retains the last live value briefly when the key stays the same", () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook<
      RetainedWorkspaceValue | null,
      HookProps
    >(
      ({ value, retentionKey }) =>
        useExpiringRetainedValue({
          value,
          retentionKey,
          gracePeriodMs: 1000,
        }),
      {
        initialProps: {
          value: { id: "workspace_1", name: "Acme" },
          retentionKey: "workspace_1",
        },
      }
    )

    expect(result.current?.name).toBe("Acme")

    rerender({
      value: null,
      retentionKey: "workspace_1",
    })

    expect(result.current?.name).toBe("Acme")

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBeNull()
  })

  it("clears the retained value immediately when the retention key changes", () => {
    const { result, rerender } = renderHook<
      RetainedWorkspaceValue | null,
      HookProps
    >(
      ({ value, retentionKey }) =>
        useExpiringRetainedValue({
          value,
          retentionKey,
          gracePeriodMs: 1000,
        }),
      {
        initialProps: {
          value: { id: "workspace_1", name: "Acme" },
          retentionKey: "workspace_1",
        },
      }
    )

    expect(result.current?.name).toBe("Acme")

    rerender({
      value: null,
      retentionKey: "workspace_2",
    })

    expect(result.current).toBeNull()
  })
})
