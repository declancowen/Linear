import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  getDocumentPreview,
  getPatchForField,
  MissingState,
  PropertySelect,
  WorkItemTypeIcon,
} from "@/components/app/screens/shared"
import { createEmptyState } from "@/lib/domain/empty-state"
import { createTestWorkItem } from "@/tests/lib/fixtures/app-data"

describe("PropertySelect", () => {
  it("opens a property menu and applies the selected value", async () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Status"
        value="todo"
        options={[
          { value: "todo", label: "To do" },
          { value: "in-progress", label: "In progress" },
          { value: "done", label: "Done" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Status" }))
    fireEvent.click(await screen.findByRole("option", { name: "Done" }))

    expect(onValueChange).toHaveBeenCalledWith("done")
  })

  it("does not open when disabled", () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Status"
        value="todo"
        disabled
        options={[
          { value: "todo", label: "To do" },
          { value: "done", label: "Done" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Status" }))

    expect(screen.queryByRole("button", { name: "Done" })).toBeNull()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("supports listbox semantics and keyboard selection", async () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Assignee"
        value="alex"
        options={[
          { value: "alex", label: "Alex" },
          { value: "jamie", label: "Jamie" },
          { value: "sam", label: "Sam" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Assignee" }))

    const listbox = await screen.findByRole("listbox", { name: "Assignee" })
    expect(screen.getByRole("option", { name: "Alex" })).toHaveAttribute(
      "aria-selected",
      "true"
    )

    fireEvent.keyDown(listbox, { key: "ArrowDown" })
    fireEvent.keyDown(listbox, { key: "ArrowDown" })
    fireEvent.keyDown(listbox, { key: "Enter" })

    expect(onValueChange).toHaveBeenCalledWith("sam")
  })

  it("supports boundary keys and typeahead navigation", async () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Project"
        value="alpha"
        options={[
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
          { value: "gamma", label: "Gamma" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Project" }))

    const listbox = await screen.findByRole("listbox", { name: "Project" })

    fireEvent.keyDown(listbox, { key: "End" })
    fireEvent.keyDown(listbox, { key: "Enter" })
    expect(onValueChange).toHaveBeenCalledWith("gamma")

    fireEvent.click(screen.getByRole("button", { name: "Project" }))
    fireEvent.keyDown(await screen.findByRole("listbox", { name: "Project" }), {
      key: "b",
    })
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Project" }), {
      key: "Enter",
    })

    expect(onValueChange).toHaveBeenLastCalledWith("beta")
  })

  it("renders item and missing-state variants", () => {
    const EmptyIcon = ({ className }: { className?: string }) => (
      <svg className={className} data-testid="empty-icon" />
    )

    const { rerender } = render(<WorkItemTypeIcon itemType="task" />)
    expect(document.querySelector("svg")).toBeTruthy()

    rerender(<WorkItemTypeIcon itemType="issue" />)
    expect(document.querySelector("svg")).toBeTruthy()

    rerender(<WorkItemTypeIcon itemType="epic" />)
    expect(document.querySelector("svg")).toBeTruthy()

    rerender(<MissingState title="No items" />)
    expect(screen.getByText("No items")).toBeInTheDocument()

    rerender(
      <MissingState
        icon={EmptyIcon}
        title="No docs"
        subtitle="Create the first doc"
      />
    )
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument()
    expect(screen.getByText("Create the first doc")).toBeInTheDocument()
  })

  it("builds document previews and hierarchy patches", () => {
    expect(
      getDocumentPreview({
        title: "Spec",
        content: "<p>Spec</p><p>Launch plan&nbsp;ready</p>",
        previewText: "",
      })
    ).toBe("Launch plan ready")
    expect(
      getDocumentPreview({
        title: "Spec",
        content: "<p>Ignored</p>",
        previewText: "  Stored preview  ",
      })
    ).toBe("Stored preview")

    const data = {
      ...createEmptyState(),
      workItems: [
        createTestWorkItem("epic_1", {
          key: "LIN-1",
          teamId: "team_1",
          type: "epic" as const,
          title: "Platform",
          status: "todo",
          parentId: null,
        }),
        createTestWorkItem("story_1", {
          key: "LIN-2",
          teamId: "team_1",
          type: "feature" as const,
          title: "Build",
          status: "todo",
          parentId: null,
        }),
      ],
    }

    expect(
      getPatchForField(
        data,
        data.workItems[1] ?? null,
        "epic",
        "LIN-1 · Platform"
      )
    ).toEqual({
      parentId: "epic_1",
    })
    expect(getPatchForField(data, data.workItems[1] ?? null, "epic", "No epic"))
      .toEqual({})
    expect(getPatchForField(data, null, "epic", "LIN-1 · Platform")).toEqual({})
  })
})
