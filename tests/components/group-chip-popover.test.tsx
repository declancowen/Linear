import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  FilterPopover,
  GroupChipPopover,
  LevelChipPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  createDefaultViewFilters,
  type ViewDefinition,
} from "@/lib/domain/types"

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
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
    ...overrides,
  }
}

describe("GroupChipPopover", () => {
  it("renders a group icon in the trigger", () => {
    render(<GroupChipPopover view={createView()} />)

    const trigger = screen.getByRole("button", { name: /group.*status/i })
    expect(trigger.querySelector("svg")).not.toBeNull()
  })

  it("opens and updates grouping from the shared chip trigger", () => {
    const onUpdateView = vi.fn()

    render(<GroupChipPopover view={createView()} onUpdateView={onUpdateView} />)

    fireEvent.click(screen.getByRole("button", { name: /group.*status/i }))
    fireEvent.click(screen.getAllByRole("button", { name: "Priority" })[0])

    expect(onUpdateView).toHaveBeenCalledWith({ grouping: "priority" })
  })
})

describe("LevelChipPopover", () => {
  it("opens from the shared chip trigger", () => {
    render(<LevelChipPopover view={createView({ itemLevel: "task" })} />)

    fireEvent.click(screen.getByRole("button", { name: /level.*task/i }))

    expect(screen.getByText("Highest parent")).toBeInTheDocument()
  })
})

describe("FilterPopover", () => {
  it("opens and toggles a filter from the shared filter trigger", () => {
    const onToggleFilterValue = vi.fn()

    render(
      <FilterPopover
        view={createView()}
        items={[]}
        variant="chip"
        onToggleFilterValue={onToggleFilterValue}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.click(screen.getByRole("button", { name: "Todo" }))

    expect(onToggleFilterValue).toHaveBeenCalledWith("status", "todo")
  })
})
