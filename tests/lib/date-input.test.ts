import { afterEach, describe, expect, it, vi } from "vitest"

const originalTimeZone = process.env.TZ

afterEach(() => {
  process.env.TZ = originalTimeZone
  vi.resetModules()
})

describe("date input helpers", () => {
  it("formats date-only values without timezone drift", async () => {
    process.env.TZ = "America/Los_Angeles"
    vi.resetModules()

    const { formatDateInputLabel } = await import("@/lib/date-input")

    expect(formatDateInputLabel("2026-04-20", "Start date")).toBe("Apr 20")
  })

  it("parses and validates date-only values", async () => {
    const { parseDateInputValue } = await import("@/lib/date-input")

    expect(parseDateInputValue("2026-04-20")).toEqual({
      year: 2026,
      month: 4,
      day: 20,
    })
    expect(parseDateInputValue("2026-02-31")).toBeNull()
    expect(parseDateInputValue("not-a-date")).toBeNull()
  })
})
