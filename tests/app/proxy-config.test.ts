import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("proxy config", () => {
  it("covers chat message reactions with the same auth boundary as channel reactions", () => {
    const proxySource = readFileSync(join(process.cwd(), "proxy.ts"), "utf8")

    expect(proxySource).toContain('"/api/channel-posts/:path*"')
    expect(proxySource).toContain('"/api/chat-messages/:path*"')
  })
})
