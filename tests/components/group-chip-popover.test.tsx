import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GroupChipPopover } from "@/components/app/screens/work-surface-controls"
import { createDefaultViewFilters, type ViewDefinition } from "@/lib/domain/types"

function createView(): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    containerType: null,
    containerId: null,
    itemLevel: null,
    showChildItems: false,
    layout: "list",
    filters: createDefaultViewFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps: [],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: true,
    route: "/team/platform/work",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
  }
}

describe("GroupChipPopover", () => {
  it("renders a group icon in the trigger", () => {
    render(<GroupChipPopover view={createView()} />)

    const trigger = screen.getByRole("button", { name: /group.*status/i })
    expect(trigger.querySelector("svg")).not.toBeNull()
  })
})
