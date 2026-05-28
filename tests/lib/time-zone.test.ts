import { afterEach, describe, expect, it, vi } from "vitest"

import { getSupportedTimeZones } from "@/lib/time-zone"

describe("time zone utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("keeps UTC available when the runtime supported timezone list omits it", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"))
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([
      "Europe/London",
      "Asia/Kolkata",
    ])

    expect(getSupportedTimeZones()).toEqual([
      "UTC",
      "Europe/London",
      "Asia/Kolkata",
    ])
  })

  it("orders supported time zones by current UTC offset", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"))
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([
      "Europe/London",
      "Asia/Kolkata",
      "America/Los_Angeles",
      "America/New_York",
      "Pacific/Kiritimati",
    ])

    expect(getSupportedTimeZones()).toEqual([
      "America/Los_Angeles",
      "America/New_York",
      "UTC",
      "Europe/London",
      "Asia/Kolkata",
      "Pacific/Kiritimati",
    ])
  })
})
