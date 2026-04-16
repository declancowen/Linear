import {
  getWorkspaceSearchIndex,
  searchWorkspace,
} from "@/lib/domain/selectors"

import { createLargeWorkspaceSearchFixture } from "./workspace-search-fixtures"

describe("workspace search performance budget", () => {
  it("builds and queries the search read model within a bounded budget", () => {
    const data = createLargeWorkspaceSearchFixture()

    const buildStartedAt = performance.now()
    const index = getWorkspaceSearchIndex(data)
    const buildDurationMs = performance.now() - buildStartedAt

    const queryStartedAt = performance.now()
    const results = searchWorkspace(data, "needle search item", {
      kind: "item",
      limit: 20,
    })
    const queryDurationMs = performance.now() - queryStartedAt

    expect(index.results.length).toBeGreaterThan(1600)
    expect(results.map((result) => result.id)).toContain("item-item_team_12_18")
    expect(buildDurationMs).toBeLessThan(400)
    expect(queryDurationMs).toBeLessThan(40)
  })
})
