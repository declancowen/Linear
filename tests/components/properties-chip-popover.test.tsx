import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PropertiesChipPopover } from "@/components/app/screens/work-surface-controls"
import { createDefaultViewFilters, type ViewDefinition } from "@/lib/domain/types"

function createView(displayProps: ViewDefinition["displayProps"]): ViewDefinition {
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
    displayProps,
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

describe("PropertiesChipPopover", () => {
  it("lets visible properties be removed again with a click", () => {
    const onToggleDisplayProperty = vi.fn()

    render(
      <PropertiesChipPopover
        view={createView(["dueDate"])}
        onToggleDisplayProperty={onToggleDisplayProperty}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /properties/i }))
    fireEvent.click(screen.getByRole("button", { name: "Due date" }))

    expect(onToggleDisplayProperty).toHaveBeenCalledWith("dueDate")
  })
})
