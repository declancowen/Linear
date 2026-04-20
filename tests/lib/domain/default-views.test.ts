import { describe, expect, it } from "vitest"

import { isSystemView } from "@/lib/domain/default-views"

describe("isSystemView", () => {
  it("treats canonical built-in ids as system views", () => {
    expect(
      isSystemView({
        id: "view_team_1_all_items",
        entityKind: "items",
      })
    ).toBe(true)

    expect(
      isSystemView({
        id: "view_workspace_1_all_projects",
        entityKind: "projects",
      })
    ).toBe(true)
  })

  it("does not classify custom views by label alone", () => {
    expect(
      isSystemView({
        id: "view_custom_1",
        entityKind: "items",
      })
    ).toBe(false)

    expect(
      isSystemView({
        id: "view_custom_2",
        entityKind: "projects",
      })
    ).toBe(false)
  })
})
