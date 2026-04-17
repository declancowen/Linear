import { describe, expect, it } from "vitest"

import { canEditRole, mergeRole } from "@/lib/domain/roles"

describe("domain roles", () => {
  it("keeps the highest-priority role when merging", () => {
    expect(mergeRole(null, "viewer")).toBe("viewer")
    expect(mergeRole("viewer", "member")).toBe("member")
    expect(mergeRole("member", "viewer")).toBe("member")
    expect(mergeRole("member", "admin")).toBe("admin")
    expect(mergeRole("admin", "guest")).toBe("admin")
  })

  it("treats only admin and member as editable roles", () => {
    expect(canEditRole("admin")).toBe(true)
    expect(canEditRole("member")).toBe(true)
    expect(canEditRole("viewer")).toBe(false)
    expect(canEditRole("guest")).toBe(false)
    expect(canEditRole(null)).toBe(false)
  })
})
