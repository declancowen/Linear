import { describe, expect, it } from "vitest"

describe("normalizeResendFrom", () => {
  it("returns the raw email when no display name is provided", async () => {
    const { normalizeResendFrom } = await import("../../scripts/resend-from.mjs")

    expect(normalizeResendFrom("noreply@example.com")).toBe(
      "noreply@example.com"
    )
  })

  it("formats an explicit display name with a raw email", async () => {
    const { normalizeResendFrom } = await import("../../scripts/resend-from.mjs")

    expect(
      normalizeResendFrom("noreply@example.com", "Recipe Room")
    ).toBe("Recipe Room <noreply@example.com>")
  })

  it("preserves an already formatted sender string", async () => {
    const { normalizeResendFrom } = await import("../../scripts/resend-from.mjs")

    expect(
      normalizeResendFrom(
        "Recipe Room <noreply@example.com>",
        "Ignored Name"
      )
    ).toBe("Recipe Room <noreply@example.com>")
  })
})
