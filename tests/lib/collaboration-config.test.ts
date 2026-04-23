import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveCollaborationServiceUrl,
  resolveCollaborationTokenSecret,
} from "@/lib/collaboration/config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("collaboration config helpers", () => {
  it("prefers the canonical public PartyKit URL when present", () => {
    const env = {
      NEXT_PUBLIC_PARTYKIT_URL: "https://collab.example.com",
      COLLABORATION_TOKEN_SECRET: "token-secret",
    }

    expect(resolveCollaborationServiceUrl(env)).toBe(
      "https://collab.example.com"
    )
    expect(resolveCollaborationTokenSecret(env)).toBe("token-secret")
  })

  it("keeps reading deprecated service URL aliases for compatibility", () => {
    expect(
      resolveCollaborationServiceUrl({
        COLLABORATION_SERVICE_URL: "https://legacy-collab.example.com",
      })
    ).toBe("https://legacy-collab.example.com")
  })

  it("does not fall back to localhost defaults anymore", () => {
    expect(resolveCollaborationServiceUrl({})).toBeNull()
    expect(resolveCollaborationTokenSecret({})).toBeNull()
  })
})
