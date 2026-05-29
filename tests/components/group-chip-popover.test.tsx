import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  FilterPopover,
  getAvailableGroupOptions,
  GroupChipPopover,
  LevelChipPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  createDefaultViewFilters,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestTeam,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

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

afterEach(() => {
  useAppStore.setState(createEmptyState())
})

describe("GroupChipPopover", () => {
  it("renders a group icon in the trigger", () => {
    render(<GroupChipPopover view={createView()} />)

    const trigger = screen.getByRole("button", { name: /^group$/i })
    expect(trigger.querySelector("svg")).not.toBeNull()
    expect(trigger).toHaveClass("work-view-chip")
    expect(trigger).toHaveClass("shrink-0")
    expect(trigger.querySelector(".work-view-chip-value")).toBeNull()
  })

  it("opens and updates grouping from the shared chip trigger", () => {
    const onUpdateView = vi.fn()

    render(<GroupChipPopover view={createView()} onUpdateView={onUpdateView} />)

    fireEvent.click(screen.getByRole("button", { name: /^group$/i }))
    fireEvent.click(screen.getAllByRole("button", { name: "Priority" })[0])

    expect(onUpdateView).toHaveBeenCalledWith({ grouping: "priority" })
  })

  it("offers parent in both group-by and subgroup options", () => {
    render(
      <GroupChipPopover
        view={createView()}
        groupOptions={getAvailableGroupOptions("project-management")}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^group$/i }))

    expect(screen.getAllByRole("button", { name: "Parent" })).toHaveLength(2)
  })

  it("labels parent grouping from the issue hierarchy", () => {
    useAppStore.setState({
      ...createEmptyState(),
      teams: [
        createTestTeam({
          settings: {
            experience: "issue-analysis",
          },
        }),
      ],
    })

    render(
      <GroupChipPopover
        view={createView({ itemLevel: "sub-issue" })}
        groupOptions={getAvailableGroupOptions("bug-tracking")}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^group$/i }))

    expect(screen.getAllByRole("button", { name: "Issue" })).toHaveLength(2)
  })
})

describe("LevelChipPopover", () => {
  it("opens from the shared chip trigger", () => {
    render(<LevelChipPopover view={createView({ itemLevel: "task" })} />)

    const trigger = screen.getByRole("button", { name: /^level$/i })

    expect(trigger).toHaveClass("work-view-chip")
    expect(trigger).toHaveClass("shrink-0")
    expect(trigger.querySelector(".work-view-chip-value")).toBeNull()

    fireEvent.click(trigger)

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

    const trigger = screen.getByRole("button", { name: "Filter" })
    expect(trigger).toHaveClass("shrink-0")

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "Todo" }))

    expect(onToggleFilterValue).toHaveBeenCalledWith("status", "todo")
  })

  it("shows parent filter values and keeps the filter list scrollable", () => {
    const issue = createTestWorkItem("issue_1", {
      key: "BUG-1",
      type: "issue",
      title: "Login issue",
    })
    const subIssue = createTestWorkItem("sub_issue_1", {
      type: "sub-issue",
      parentId: issue.id,
    })

    useAppStore.setState({
      ...createEmptyState(),
      workItems: [issue, subIssue],
    })

    render(
      <FilterPopover
        view={createView({
          itemLevel: "issue",
          showChildItems: true,
        })}
        items={[issue, subIssue]}
        variant="chip"
        groupingExperience="issue-analysis"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Filter" }))

    expect(screen.getByRole("dialog")).toHaveClass("flex", "flex-col")
    expect(screen.getByRole("dialog")).toHaveClass(
      "h-[min(520px,calc(100vh-11rem))]"
    )
    expect(screen.getAllByText("Issue")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "BUG-1 · Login issue" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("work-filter-sections")).toHaveClass(
      "overflow-y-auto"
    )
  })
})
