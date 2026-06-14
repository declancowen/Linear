import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    confirmLabel,
    onConfirm,
    open,
    title,
  }: {
    confirmLabel: string
    onConfirm: () => void
    open: boolean
    title: string
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}))

vi.mock("@/components/app/entity-icons", () => ({
  ProjectIconGlyph: () => <span>Project icon</span>,
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  WorkItemAssigneeAvatar: () => <span>Avatar</span>,
}))

vi.mock("@/components/ui/dropdown-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSelectableMenuStubModule("DropdownMenu")
)

vi.mock("@/components/ui/context-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSelectableMenuStubModule("ContextMenu")
)

vi.mock("@phosphor-icons/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phosphor-icons/react")>()

  return {
    ...actual,
    DotsThree: () => null,
    Trash: () => null,
  }
})

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppData,
  type DisplayProperty,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  IssueActionMenu,
  IssueContextMenu,
} from "@/components/app/screens/work-item-menus"

function createMenuData(): { data: AppData; item: WorkItem } {
  const item: WorkItem = {
    id: "item_1",
    key: "TES-1",
    teamId: "team_1",
    type: "feature",
    title: "Feature item",
    descriptionDocId: "doc_1",
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
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  }

  return {
    item,
    data: {
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
          title: "Engineer",
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
        {
          id: "user_2",
          name: "Morgan",
          handle: "morgan",
          email: "morgan@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Engineer",
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
          icon: "rocket",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
        {
          teamId: "team_1",
          userId: "user_2",
          role: "member",
        },
      ],
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Roadmap",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: [],
          health: "on-track",
          priority: "medium",
          status: "backlog",
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      workItems: [item],
    },
  }
}

function createBulkMenuData(): {
  data: AppData
  item: WorkItem
  secondItem: WorkItem
} {
  const { data, item } = createMenuData()
  const secondItem: WorkItem = {
    ...item,
    id: "item_2",
    key: "TES-2",
    title: "Second item",
  }

  return {
    item,
    secondItem,
    data: {
      ...data,
      labels: [
        {
          id: "label_cx",
          workspaceId: "workspace_1",
          name: "CX",
          color: "blue",
        },
      ],
      customPropertyDefinitions: [
        {
          id: "property_1",
          workspaceId: "workspace_1",
          teamId: "team_1",
          targetType: "workItem",
          name: "Risk",
          icon: "Flag",
          type: "select",
          options: [{ id: "option_high", label: "High", color: "red" }],
          isArchived: false,
          createdBy: "user_1",
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      workItems: [item, secondItem],
    },
  }
}

function renderBulkContextMenu({
  displayProps,
}: {
  displayProps: DisplayProperty[]
}) {
  const { data, item, secondItem } = createBulkMenuData()

  render(
    <IssueContextMenu
      data={data}
      displayProps={displayProps}
      item={item}
      targetItems={[item, secondItem]}
    >
      <button type="button">Open menu</button>
    </IssueContextMenu>
  )

  return { data, item, secondItem }
}

describe("work item menus", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      updateWorkItem: vi.fn(() => ({
        status: "project-confirmation-required",
        cascadeItemCount: 3,
      })) as never,
      bulkUpdateWorkItems: vi.fn(async () => true) as never,
      setCustomPropertyValue: vi.fn() as never,
      deleteWorkItem: vi.fn(async () => true) as never,
      deleteWorkItems: vi.fn(async () => true) as never,
    })
    pushMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("keeps project confirmation mounted from the action menu", () => {
    const { data, item } = createMenuData()

    render(<IssueActionMenu data={data} item={item} />)

    fireEvent.click(screen.getByText("Roadmap"))

    expect(screen.getByText("Update project for hierarchy")).toBeInTheDocument()
  })

  it("keeps project confirmation mounted from the context menu", () => {
    const { data, item } = createMenuData()

    render(
      <IssueContextMenu data={data} item={item}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    fireEvent.click(screen.getByText("Roadmap"))

    expect(screen.getByText("Update project for hierarchy")).toBeInTheDocument()
  })

  it("opens item routes from the context menu", () => {
    const { data, item } = createMenuData()

    render(
      <IssueContextMenu data={data} item={item}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    fireEvent.click(screen.getByText("Open item"))

    expect(pushMock).toHaveBeenCalledWith("/items/item_1")
  })

  it("opens item editing from the context menu when an edit handler is provided", () => {
    const { data, item } = createMenuData()
    const onEditItem = vi.fn()

    render(
      <IssueContextMenu data={data} item={item} onEditItem={onEditItem}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    fireEvent.click(screen.getByText("Edit item"))

    expect(onEditItem).toHaveBeenCalledWith("item_1")
  })

  it("shows icons for open, edit, status, priority, assignee, and project actions", () => {
    const { data, item } = createMenuData()

    render(
      <IssueContextMenu data={data} item={item} onEditItem={vi.fn()}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    for (const label of [
      "Open item",
      "Edit item",
      "Status",
      "Priority",
      "Assignee",
      "Project",
    ]) {
      expect(screen.getByText(label).parentElement).toContainHTML("<svg")
    }
  })

  it("hides assignee and project actions for private tasks", () => {
    const { data, item } = createMenuData()
    const privateItem = {
      ...item,
      type: "task" as const,
      visibility: "private" as const,
    }

    render(
      <IssueContextMenu data={data} item={privateItem}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    expect(screen.queryByText("Assignee")).not.toBeInTheDocument()
    expect(screen.queryByText("Project")).not.toBeInTheDocument()
    expect(screen.queryByText("Roadmap")).not.toBeInTheDocument()
  })

  it("shows owner-private label actions for private tasks", () => {
    const { data, item } = createMenuData()
    const privateItem = {
      ...item,
      teamId: null,
      workspaceId: "workspace_1",
      type: "task" as const,
      visibility: "private" as const,
    }
    const privateData = {
      ...data,
      labels: [
        {
          id: "label_workspace",
          workspaceId: "workspace_1",
          scopeType: "workspace" as const,
          ownerId: null,
          name: "Workspace",
          color: "blue",
        },
        {
          id: "label_private",
          workspaceId: "workspace_1",
          scopeType: "private" as const,
          ownerId: "user_1",
          name: "Focus",
          color: "violet",
        },
      ],
    }

    render(
      <IssueActionMenu
        data={privateData}
        displayProps={["labels"]}
        item={privateItem}
      />
    )

    expect(screen.getByText("Labels")).toBeInTheDocument()
    expect(screen.getByText("Focus")).toBeInTheDocument()
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Focus"))

    expect(useAppStore.getState().updateWorkItem).toHaveBeenCalledWith(
      "item_1",
      { labelIds: ["label_private"] }
    )
  })

  it("adds assignees without replacing existing assignees from the menu", () => {
    const { data, item } = createMenuData()
    const assignedItem = {
      ...item,
      assigneeId: "user_1",
      assigneeIds: ["user_1"],
    }

    render(<IssueActionMenu data={data} item={assignedItem} />)

    fireEvent.click(screen.getByText("Morgan"))

    expect(useAppStore.getState().updateWorkItem).toHaveBeenCalledWith(
      "item_1",
      {
        assigneeId: "user_1",
        assigneeIds: ["user_1", "user_2"],
      }
    )
  })

  it("bulk-updates status only when status is visible in display properties", () => {
    renderBulkContextMenu({ displayProps: ["status"] })

    expect(screen.getByText("2 selected")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.queryByText("Priority")).not.toBeInTheDocument()
    expect(screen.queryByText("Open item")).not.toBeInTheDocument()
    expect(screen.getByText("Delete selected items")).toBeInTheDocument()

    fireEvent.click(screen.getByText("In Progress"))

    expect(useAppStore.getState().bulkUpdateWorkItems).toHaveBeenCalledWith([
      {
        itemId: "item_1",
        patch: {
          status: "in-progress",
          expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        },
      },
      {
        itemId: "item_2",
        patch: {
          status: "in-progress",
          expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        },
      },
    ])
  })

  it("bulk-updates labels when labels are visible in display properties", () => {
    renderBulkContextMenu({ displayProps: ["labels"] })

    expect(screen.getByText("Labels")).toBeInTheDocument()
    expect(screen.queryByText("Status")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("CX"))

    expect(useAppStore.getState().bulkUpdateWorkItems).toHaveBeenCalledWith([
      {
        itemId: "item_1",
        patch: {
          labelIds: ["label_cx"],
          expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        },
      },
      {
        itemId: "item_2",
        patch: {
          labelIds: ["label_cx"],
          expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        },
      },
    ])
  })

  it("does not show label actions on menus without visible display properties", () => {
    const { data, item } = createBulkMenuData()

    render(
      <IssueContextMenu data={data} item={item}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    expect(screen.queryByText("Labels")).not.toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
  })

  it("bulk-updates visible custom select properties", () => {
    renderBulkContextMenu({ displayProps: ["custom:property_1"] })

    expect(screen.getByText("Risk")).toBeInTheDocument()
    expect(screen.queryByText("Labels")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("High"))

    expect(useAppStore.getState().bulkUpdateWorkItems).toHaveBeenCalledWith([
      {
        expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        itemId: "item_1",
        customProperty: {
          propertyId: "property_1",
          value: "option_high",
        },
      },
      {
        expectedUpdatedAt: "2026-04-20T00:00:00.000Z",
        itemId: "item_2",
        customProperty: {
          propertyId: "property_1",
          value: "option_high",
        },
      },
    ])
  })

  it("keeps bulk project confirmation mounted after the context menu closes", () => {
    renderBulkContextMenu({ displayProps: ["project"] })

    fireEvent.click(screen.getByText("Roadmap"))

    expect(
      screen.getByText("Update project for selected items")
    ).toBeInTheDocument()
    expect(useAppStore.getState().updateWorkItem).not.toHaveBeenCalled()
  })

  it("bulk-deletes every selected work item after confirmation", async () => {
    renderBulkContextMenu({ displayProps: ["status"] })

    fireEvent.click(screen.getByText("Delete selected items"))

    expect(screen.getByText("Delete 2 selected items")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Delete"))

    await waitFor(() =>
      expect(useAppStore.getState().deleteWorkItems).toHaveBeenCalledWith([
        "item_1",
        "item_2",
      ])
    )
  })
})
