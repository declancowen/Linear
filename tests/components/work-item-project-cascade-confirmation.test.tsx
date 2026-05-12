import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import { useWorkItemProjectCascadeConfirmation } from "@/components/app/screens/use-work-item-project-cascade-confirmation"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestUser,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

const { syncUpdateWorkItemMock } = vi.hoisted(() => ({
  syncUpdateWorkItemMock: vi.fn(),
}))

vi.mock("@/lib/convex/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/convex/client")>()

  return {
    ...actual,
    syncUpdateWorkItem: syncUpdateWorkItemMock,
  }
})

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
  }) =>
    open ? (
      <div>
        <p>{title}</p>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}))

function TestHarness() {
  const { requestUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()

  return (
    <>
      <button
        type="button"
        onClick={() =>
          requestUpdate("feature-parent", {
            primaryProjectId: "project_1",
          })
        }
      >
        Move project
      </button>
      <button
        type="button"
        onClick={() =>
          requestUpdate("requirement-middle", {
            parentId: "new-feature",
          })
        }
      >
        Move parent
      </button>
      {confirmationDialog}
    </>
  )
}

describe("useWorkItemProjectCascadeConfirmation", () => {
  beforeEach(() => {
    syncUpdateWorkItemMock.mockReset()
    syncUpdateWorkItemMock.mockResolvedValue({ ok: true })
    useAppStore.setState({
      ...createTestAppData({
        users: [createTestUser({ title: "Founder" })],
        teams: [
          createTestTeam({
            settings: {
              experience: "project-management",
            },
          }),
        ],
        projects: [
          createTestProject({
            id: "project_1",
            templateType: "software-delivery",
            name: "Platform roadmap",
            status: "backlog",
          }),
        ],
        documents: [
          createTestDocument({
            id: "doc_parent",
            kind: "item-description",
            title: "Parent description",
            content: "<p>Parent</p>",
            linkedWorkItemIds: ["parent"],
          }),
          createTestDocument({
            id: "doc_child",
            kind: "item-description",
            title: "Child description",
            content: "<p>Child</p>",
            linkedWorkItemIds: ["child"],
          }),
        ],
      }),
      workItems: [
        createTestWorkItem("feature-parent", {
          id: "feature-parent",
          key: "PLA-1",
          type: "feature",
          title: "Feature",
          descriptionDocId: "doc_parent",
          subscriberIds: [],
        }),
        createTestWorkItem("requirement-middle", {
          id: "requirement-middle",
          key: "PLA-2",
          type: "requirement",
          title: "Requirement",
          descriptionDocId: "doc_child",
          parentId: "feature-parent",
          subscriberIds: [],
        }),
        createTestWorkItem("story-child", {
          id: "story-child",
          key: "PLA-3",
          type: "story",
          title: "Story",
          descriptionDocId: "doc_child",
          parentId: "requirement-middle",
          subscriberIds: [],
        }),
        createTestWorkItem("new-feature", {
          id: "new-feature",
          key: "PLA-4",
          type: "feature",
          title: "New feature",
          descriptionDocId: "doc_parent",
          primaryProjectId: "project_1",
          subscriberIds: [],
        }),
      ],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  function confirmHierarchyProjectUpdate() {
    fireEvent.click(screen.getByRole("button", { name: "Update" }))
  }

  function expectHierarchyProjectIds(projectIds: Array<string | null>) {
    expect(
      useAppStore.getState().workItems.map((item) => item.primaryProjectId)
    ).toEqual(projectIds)
  }

  function expectPendingHierarchyConfirmation() {
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(screen.getByText("Update project for hierarchy")).toBeInTheDocument()
  }

  function expectWorkItemParentId(workItemId: string, parentId: string) {
    expect(
      useAppStore.getState().workItems.find((item) => item.id === workItemId)
        ?.parentId
    ).toBe(parentId)
  }

  it("defers hierarchy-wide project changes until the user confirms them", () => {
    render(<TestHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Move project" }))

    expectHierarchyProjectIds([null, null, null, "project_1"])
    expectPendingHierarchyConfirmation()

    confirmHierarchyProjectUpdate()

    expectHierarchyProjectIds([
      "project_1",
      "project_1",
      "project_1",
      "project_1",
    ])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "feature-parent", {
      primaryProjectId: "project_1",
    })
  })

  it("defers hierarchy reparenting when it would move the subtree onto a different project", () => {
    render(<TestHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Move parent" }))

    expectWorkItemParentId("requirement-middle", "feature-parent")
    expectHierarchyProjectIds([null, null, null, "project_1"])
    expectPendingHierarchyConfirmation()

    confirmHierarchyProjectUpdate()

    expectWorkItemParentId("requirement-middle", "new-feature")
    expectHierarchyProjectIds([null, "project_1", "project_1", "project_1"])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith(
      "user_1",
      "requirement-middle",
      {
        parentId: "new-feature",
      }
    )
  })
})
