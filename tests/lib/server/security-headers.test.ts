import { describe, expect, it } from "vitest"

import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/server/security-headers"

describe("content security policy helpers", () => {
  it("builds a nonce-based production CSP without inline scripts", () => {
    const policy = buildContentSecurityPolicy({
      isProduction: true,
      nonce: "test-nonce",
    })
    const scriptDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("script-src"))

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'")
    expect(scriptDirective).toBe("script-src 'self' 'nonce-test-nonce'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain("style-src 'self' 'unsafe-inline'")
    expect(policy).toContain("upgrade-insecure-requests")
  })

  it("allows unsafe-eval only in development", () => {
    const policy = buildContentSecurityPolicy({
      isProduction: false,
      nonce: "test-nonce",
    })

    expect(policy).toContain("'unsafe-eval'")
    expect(policy).not.toContain("upgrade-insecure-requests")
  })

  it("generates browser-valid nonce values", () => {
    const nonce = generateCspNonce()

    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(nonce.length).toBeGreaterThan(10)
  })
})
