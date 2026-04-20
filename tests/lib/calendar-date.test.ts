import { afterEach, describe, expect, it, vi } from "vitest"

const originalTimeZone = process.env.TZ

afterEach(() => {
  process.env.TZ = originalTimeZone
  vi.useRealTimers()
  vi.resetModules()
})

describe("calendar date helpers", () => {
  it("formats local calendar dates without UTC rollover", async () => {
    process.env.TZ = "America/Los_Angeles"
    vi.resetModules()

    const { formatLocalCalendarDate } = await import("@/lib/calendar-date")

    expect(formatLocalCalendarDate(new Date(2026, 3, 20, 23, 30))).toBe(
      "2026-04-20"
    )
  })

  it("adds calendar days from the local date boundary", async () => {
    process.env.TZ = "America/Los_Angeles"
    vi.resetModules()

    const { addLocalCalendarDays } = await import("@/lib/calendar-date")

    expect(addLocalCalendarDays(7, new Date(2026, 3, 20, 23, 30))).toBe(
      "2026-04-27"
    )
    expect(addLocalCalendarDays(10, new Date(2026, 3, 20, 23, 30))).toBe(
      "2026-04-30"
    )
  })
})
