import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"
import { useWorkItemProjectCascadeConfirmation } from "@/components/app/screens/use-work-item-project-cascade-confirmation"

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
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [
        {
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Founder",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "project-management",
            features: {
              issues: true,
              projects: true,
              views: true,
              docs: true,
              chat: true,
              channels: true,
            },
            workflow: {
              statusOrder: [
                "backlog",
                "todo",
                "in-progress",
                "done",
                "cancelled",
                "duplicate",
              ],
              templateDefaults: {
                "software-delivery": {
                  defaultPriority: "high",
                  targetWindowDays: 28,
                  defaultViewLayout: "board",
                  recommendedItemTypes: ["epic", "feature", "requirement", "story"],
                  summaryHint: "",
                },
                "bug-tracking": {
                  defaultPriority: "high",
                  targetWindowDays: 14,
                  defaultViewLayout: "list",
                  recommendedItemTypes: ["issue", "sub-issue"],
                  summaryHint: "",
                },
                "project-management": {
                  defaultPriority: "medium",
                  targetWindowDays: 35,
                  defaultViewLayout: "timeline",
                  recommendedItemTypes: ["task", "sub-task"],
                  summaryHint: "",
                },
              },
            },
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
      ],
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Platform roadmap",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: [],
          health: "on-track",
          priority: "medium",
          status: "backlog",
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      documents: [
        {
          id: "doc_parent",
          kind: "item-description",
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Parent description",
          content: "<p>Parent</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: ["parent"],
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
        {
          id: "doc_child",
          kind: "item-description",
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Child description",
          content: "<p>Child</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: ["child"],
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      workItems: [
        {
          id: "feature-parent",
          key: "PLA-1",
          teamId: "team_1",
          type: "feature",
          title: "Feature",
          descriptionDocId: "doc_parent",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
        {
          id: "requirement-middle",
          key: "PLA-2",
          teamId: "team_1",
          type: "requirement",
          title: "Requirement",
          descriptionDocId: "doc_child",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: "feature-parent",
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
        {
          id: "story-child",
          key: "PLA-3",
          teamId: "team_1",
          type: "story",
          title: "Story",
          descriptionDocId: "doc_child",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: "requirement-middle",
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
        {
          id: "new-feature",
          key: "PLA-4",
          teamId: "team_1",
          type: "feature",
          title: "New feature",
          descriptionDocId: "doc_parent",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_1",
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("defers hierarchy-wide project changes until the user confirms them", () => {
    render(<TestHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Move project" }))

    expect(
      useAppStore.getState().workItems.map((item) => item.primaryProjectId)
    ).toEqual([null, null, null, "project_1"])
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(
      screen.getByText("Update project for hierarchy")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Update" }))

    expect(
      useAppStore.getState().workItems.map((item) => item.primaryProjectId)
    ).toEqual(["project_1", "project_1", "project_1", "project_1"])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "feature-parent", {
      primaryProjectId: "project_1",
    })
  })

  it("defers hierarchy reparenting when it would move the subtree onto a different project", () => {
    render(<TestHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Move parent" }))

    expect(
      useAppStore.getState().workItems.find(
        (item) => item.id === "requirement-middle"
      )?.parentId
    ).toBe("feature-parent")
    expect(
      useAppStore.getState().workItems.map((item) => item.primaryProjectId)
    ).toEqual([null, null, null, "project_1"])
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(
      screen.getByText("Update project for hierarchy")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Update" }))

    expect(
      useAppStore.getState().workItems.find(
        (item) => item.id === "requirement-middle"
      )?.parentId
    ).toBe("new-feature")
    expect(
      useAppStore.getState().workItems.map((item) => item.primaryProjectId)
    ).toEqual([null, "project_1", "project_1", "project_1"])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith(
      "user_1",
      "requirement-middle",
      {
        parentId: "new-feature",
      }
    )
  })
})
