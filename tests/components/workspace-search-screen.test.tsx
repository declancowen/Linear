import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { searchResultIcon } from "@/components/app/workspace-search-icon"

describe("workspace search result icons", () => {
  it("returns an icon for each search result kind", () => {
    const kinds = ["navigation", "team", "project", "document", "item"] as const

    for (const kind of kinds) {
      const { container, unmount } = render(searchResultIcon(kind))

      expect(container.querySelector("svg")).toBeTruthy()
      unmount()
    }
  })
})
