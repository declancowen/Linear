import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  ViewsDirectoryFilterPopover,
  ViewsDirectoryGroupChipPopover,
  ViewsDirectoryPropertiesChipPopover,
} from "@/components/app/screens/directory-controls"

describe("views directory controls", () => {
  it("labels saved-view entity grouping as type and scope grouping as team", () => {
    render(
      <ViewsDirectoryGroupChipPopover
        grouping="entity"
        subGrouping="none"
        onGroupingChange={vi.fn()}
        onSubGroupingChange={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", { name: /Group.*Type/ })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Group.*Type/ }))

    expect(screen.getAllByRole("button", { name: "Type" }).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Project" }).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Team" }).length).toBe(2)
    expect(screen.queryByRole("button", { name: "Entity" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Scope" })).toBeNull()
  })

  it("uses matching type and team labels in filters and properties", () => {
    render(
      <>
        <ViewsDirectoryFilterPopover
          filters={{ entityKinds: [], scopes: [] }}
          availableEntityKinds={["items", "projects"]}
          availableScopes={["workspace", "team"]}
          onToggleEntityKind={vi.fn()}
          onToggleScope={vi.fn()}
          onClearFilters={vi.fn()}
        />
        <ViewsDirectoryPropertiesChipPopover
          properties={["scope"]}
          onToggleProperty={vi.fn()}
          onClearProperties={vi.fn()}
        />
      </>
    )

    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    expect(screen.getByText("Type")).toBeInTheDocument()
    expect(screen.getAllByText("Team").length).toBeGreaterThan(0)
    expect(screen.queryByText("Entity")).not.toBeInTheDocument()
    expect(screen.queryByText("Scope")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Properties/ }))
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Scope labels" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Config badges" })).toBeNull()
  })
})
