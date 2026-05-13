import { describe, expect, it } from "vitest"

import { AUTHKIT_PROXY_MATCHERS } from "@/lib/server/proxy-config"

describe("proxy config", () => {
  it("covers chat message reactions with the same auth boundary as channel reactions", () => {
    expect(AUTHKIT_PROXY_MATCHERS).toContain("/api/channel-posts/:path*")
    expect(AUTHKIT_PROXY_MATCHERS).toContain("/api/chat-messages/:path*")
  })
})
