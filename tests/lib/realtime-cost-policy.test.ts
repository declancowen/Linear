import { describe, expect, it } from "vitest"

import {
  REALTIME_STREAM_DEFAULT_POLL_INTERVAL_MS,
  REALTIME_STREAM_MIN_POLL_INTERVAL_MS,
  SCOPED_DEGRADED_REFRESH_INTERVAL_MS,
  SCOPED_FOREGROUND_REFRESH_STALE_MS,
  isForegroundScopedRefreshStale,
  resolveRealtimeStreamPollIntervalMs,
} from "@/lib/realtime/cost-policy"

describe("realtime cost policy", () => {
  it("uses production-safe scoped stream and degraded refresh defaults", () => {
    expect(REALTIME_STREAM_DEFAULT_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(
      15000
    )
    expect(REALTIME_STREAM_MIN_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(15000)
    expect(SCOPED_DEGRADED_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(30000)
    expect(SCOPED_FOREGROUND_REFRESH_STALE_MS).toBeGreaterThanOrEqual(30000)
  })

  it("clamps configured stream polling below the approved minimum", () => {
    expect(
      resolveRealtimeStreamPollIntervalMs({
        REALTIME_STREAM_POLL_INTERVAL_MS: "1000",
      })
    ).toBe(REALTIME_STREAM_MIN_POLL_INTERVAL_MS)
  })

  it("treats foreground refresh events as stale only after the policy window", () => {
    expect(
      isForegroundScopedRefreshStale({
        lastRefreshRequestedAt: 1000,
        now: 1000 + SCOPED_FOREGROUND_REFRESH_STALE_MS - 1,
      })
    ).toBe(false)
    expect(
      isForegroundScopedRefreshStale({
        lastRefreshRequestedAt: 1000,
        now: 1000 + SCOPED_FOREGROUND_REFRESH_STALE_MS,
      })
    ).toBe(true)
  })
})
