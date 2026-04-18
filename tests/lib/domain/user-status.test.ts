import { describe, expect, it } from "vitest"

import { resolveUserStatus, userStatusMeta } from "@/lib/domain/types"

describe("user status defaults", () => {
  it("falls back to offline when no explicit status is stored", () => {
    expect(resolveUserStatus(undefined)).toBe("offline")
    expect(resolveUserStatus(null)).toBe("offline")
  })

  it("exposes offline metadata for status pickers and badges", () => {
    expect(userStatusMeta.offline).toMatchObject({
      label: "Offline",
      colorClassName: "bg-zinc-400",
    })
  })
})
