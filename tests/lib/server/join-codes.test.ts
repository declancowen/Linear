import { describe, expect, it } from "vitest"

import { isJoinCodeConflict, withGeneratedJoinCode } from "@/lib/server/join-codes"

describe("join code helpers", () => {
  it("recognizes both legacy and current join-code conflict messages", () => {
    expect(isJoinCodeConflict(new Error("Join code already exists"))).toBe(true)
    expect(isJoinCodeConflict(new Error("join code is already in use"))).toBe(
      true
    )
    expect(isJoinCodeConflict(new Error("Team not found"))).toBe(false)
  })

  it("retries generated join codes when the current conflict message is returned", async () => {
    let attempts = 0

    const result = await withGeneratedJoinCode(async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error("Join code already exists")
      }

      return "ok"
    })

    expect(result).toBe("ok")
    expect(attempts).toBe(2)
  })
})
