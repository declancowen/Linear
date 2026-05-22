import { describe, expect, it } from "vitest"

import {
  buildPublicApiUrl,
  normalizePublicApiBaseUrl,
} from "@/lib/api/public-url"

describe("public API URL helpers", () => {
  it("normalizes public API base URLs", () => {
    expect(normalizePublicApiBaseUrl(" https://teams.example.com/ ")).toBe(
      "https://teams.example.com"
    )
    expect(normalizePublicApiBaseUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    )
    expect(normalizePublicApiBaseUrl("")).toBeNull()
    expect(normalizePublicApiBaseUrl("/api")).toBeNull()
  })

  it("prefixes only relative API route paths", () => {
    expect(
      buildPublicApiUrl("/api/workspace/current", {
        baseUrl: "https://teams.example.com/",
      })
    ).toBe("https://teams.example.com/api/workspace/current")
    expect(
      buildPublicApiUrl("/api/events/scoped?scopeKey=shell-context", {
        baseUrl: "https://teams.example.com",
      })
    ).toBe(
      "https://teams.example.com/api/events/scoped?scopeKey=shell-context"
    )
    expect(
      buildPublicApiUrl("/workspace/projects", {
        baseUrl: "https://teams.example.com",
      })
    ).toBe("/workspace/projects")
    expect(
      buildPublicApiUrl("https://cdn.example.com/file.png", {
        baseUrl: "https://teams.example.com",
      })
    ).toBe("https://cdn.example.com/file.png")
  })
})
