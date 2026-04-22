import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveCollaborationAppOrigin,
  resolveCollaborationInternalSecret,
  resolveCollaborationServiceUrl,
  resolveCollaborationTokenSecret,
} from "@/lib/collaboration/config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("collaboration config helpers", () => {
  it("prefers explicit runtime configuration when present", () => {
    vi.stubEnv("NODE_ENV", "production")

    const env = {
      COLLABORATION_APP_ORIGIN: "https://app.example.com",
      COLLABORATION_INTERNAL_SECRET: "internal-secret",
      COLLABORATION_TOKEN_SECRET: "token-secret",
      NEXT_PUBLIC_PARTYKIT_URL: "https://collab.example.com",
    }

    expect(resolveCollaborationAppOrigin(env)).toBe(
      "https://app.example.com"
    )
    expect(resolveCollaborationInternalSecret(env)).toBe("internal-secret")
    expect(resolveCollaborationTokenSecret(env)).toBe("token-secret")
    expect(resolveCollaborationServiceUrl(env)).toBe(
      "https://collab.example.com"
    )
  })

  it("falls back to local collaboration defaults outside production", () => {
    vi.stubEnv("NODE_ENV", "development")

    expect(resolveCollaborationAppOrigin({})).toBe("http://127.0.0.1:3000")
    expect(resolveCollaborationInternalSecret({})).toBe(
      "linear-local-collaboration-internal-secret"
    )
    expect(resolveCollaborationTokenSecret({})).toBe(
      "linear-local-collaboration-token-secret"
    )
    expect(resolveCollaborationServiceUrl({})).toBe("http://127.0.0.1:1999")
  })
})
