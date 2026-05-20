import { afterEach, describe, expect, it, vi } from "vitest"

import { getSupportedTimeZones } from "@/lib/time-zone"

describe("time zone utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps UTC available when the runtime supported timezone list omits it", () => {
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
})
