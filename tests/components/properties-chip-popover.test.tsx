import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PROJECT_DISPLAY_PROPERTY_OPTIONS,
  PROJECT_GROUP_OPTIONS,
  PropertiesChipPopover,
} from "@/components/app/screens/work-surface-controls"
import {
  getProjectStatusIconStatus,
  getReorderedDisplayPropertiesAfterDrag,
} from "@/components/app/screens/work-surface-control-state"
import {
  createDefaultViewFilters,
  type DisplayProperty,
  type ViewDefinition,
} from "@/lib/domain/types"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import { createTestAppData } from "@/tests/lib/fixtures/app-data"

function createView(
  displayProps: ViewDefinition["displayProps"]
): ViewDefinition {
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

function createPrivateTaskView(
  displayProps: ViewDefinition["displayProps"]
): ViewDefinition {
  return {
    ...createView(displayProps),
    scopeType: "personal",
    scopeId: "user_1",
    filters: {
      ...createDefaultViewFilters(),
      visibility: ["private"],
    },
  }
}

describe("PropertiesChipPopover", () => {
  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("keeps project dropdown options free of ID and status metadata", () => {
    expect(PROJECT_DISPLAY_PROPERTY_OPTIONS).toEqual([
      "team",
      "assignee",
      "priority",
      "type",
      "dueDate",
      "created",
      "updated",
    ])
    expect(PROJECT_DISPLAY_PROPERTY_OPTIONS).not.toContain("id")
    expect(PROJECT_DISPLAY_PROPERTY_OPTIONS).not.toContain("status")
    expect(PROJECT_GROUP_OPTIONS).not.toContain("id")
  })

  it("maps project statuses to status-ring display buckets", () => {
    expect(getProjectStatusIconStatus("in-progress")).toBe("in-progress")
    expect(getProjectStatusIconStatus("completed")).toBe("completed")
    expect(getProjectStatusIconStatus("cancelled")).toBe("cancelled")
    expect(getProjectStatusIconStatus("backlog")).toBe("backlog")
    expect(getProjectStatusIconStatus("planned")).toBe("todo")
  })

  it("computes display-property drag reorders only for valid targets", () => {
    const visibleProperties = ["id", "status", "priority"] as const

    expect(
      getReorderedDisplayPropertiesAfterDrag({
        activeId: "priority",
        overId: "id",
        visibleProperties: [...visibleProperties],
      })
    ).toEqual(["priority", "id", "status"])
    expect(
      getReorderedDisplayPropertiesAfterDrag({
        activeId: "priority",
        overId: "priority",
        visibleProperties: [...visibleProperties],
      })
    ).toBeNull()
    expect(
      getReorderedDisplayPropertiesAfterDrag({
        activeId: "assignee",
        overId: "id",
        visibleProperties: [...visibleProperties],
      })
    ).toBeNull()
  })

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

  it("does not expose assignee or project as private task display properties", () => {
    render(
      <PropertiesChipPopover
        view={createPrivateTaskView(["assignee", "project"])}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /properties/i }))

    expect(screen.queryByText("Assignee")).not.toBeInTheDocument()
    expect(screen.queryByText("Project")).not.toBeInTheDocument()
    expect(screen.getByText("Visible · 0")).toBeInTheDocument()
  })

  it("does not expose document custom properties in work item property menus", () => {
    useAppStore.setState(
      createTestAppData({
        customPropertyDefinitions: [
          {
            id: "property_work_item",
            workspaceId: "workspace_1",
            teamId: "team_1",
            scopeType: "team",
            ownerId: null,
            targetType: "workItem",
            name: "Work effort",
            icon: "Hash",
            type: "text",
            options: [],
            isArchived: false,
            createdBy: "user_1",
            createdAt: "2026-05-12T10:00:00.000Z",
            updatedAt: "2026-05-12T10:00:00.000Z",
          },
          {
            id: "property_document",
            workspaceId: "workspace_1",
            teamId: "team_1",
            scopeType: "team",
            ownerId: null,
            targetType: "document",
            name: "Document sensitivity",
            icon: "Tag",
            type: "text",
            options: [],
            isArchived: false,
            createdBy: "user_1",
            createdAt: "2026-05-12T10:00:00.000Z",
            updatedAt: "2026-05-12T10:00:00.000Z",
          },
        ],
      })
    )

    render(
      <PropertiesChipPopover
        view={createView(["custom:property_document" as DisplayProperty])}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /properties/i }))

    expect(screen.getByRole("button", { name: "Work effort" })).toBeVisible()
    expect(screen.queryByText("Document sensitivity")).not.toBeInTheDocument()
    expect(screen.getByText("Visible · 0")).toBeInTheDocument()
  })
})
