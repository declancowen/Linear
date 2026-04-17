import { describe, expect, it } from "vitest"

describe("next config governance", () => {
  it("applies standalone output and baseline static security headers", async () => {
    const { default: nextConfig } = await import("../next.config.mjs")

    expect(nextConfig.output).toBe("standalone")
    expect(typeof nextConfig.headers).toBe("function")

    const headersFn = nextConfig.headers

    if (!headersFn) {
      throw new Error("Expected nextConfig.headers to be defined")
    }

    const routes = await headersFn()
    const globalRoute = routes.find((entry) => entry.source === "/:path*")

    expect(globalRoute).toBeDefined()

    const headers = new Map(
      globalRoute?.headers.map((header) => [header.key, header.value]) ?? []
    )

    expect(headers.has("Content-Security-Policy")).toBe(false)
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    )
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
    expect(headers.get("Permissions-Policy")).toBe(
      "geolocation=(), payment=(), usb=()"
    )
    expect(headers.has("Strict-Transport-Security")).toBe(false)
  })
})
