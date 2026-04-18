import { describe, expect, it } from "vitest"

import { isPersistedViewFilterKey } from "@/components/app/screens/helpers"

describe("screen helpers", () => {
  it("treats all persisted view filter keys as persistable", () => {
    expect(isPersistedViewFilterKey("status")).toBe(true)
    expect(isPersistedViewFilterKey("priority")).toBe(true)
    expect(isPersistedViewFilterKey("assigneeIds")).toBe(true)
    expect(isPersistedViewFilterKey("creatorIds")).toBe(true)
    expect(isPersistedViewFilterKey("leadIds")).toBe(true)
    expect(isPersistedViewFilterKey("health")).toBe(true)
    expect(isPersistedViewFilterKey("milestoneIds")).toBe(true)
    expect(isPersistedViewFilterKey("relationTypes")).toBe(true)
    expect(isPersistedViewFilterKey("projectIds")).toBe(true)
    expect(isPersistedViewFilterKey("itemTypes")).toBe(true)
    expect(isPersistedViewFilterKey("labelIds")).toBe(true)
    expect(isPersistedViewFilterKey("teamIds")).toBe(true)
  })
})
