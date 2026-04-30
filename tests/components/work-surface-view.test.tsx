import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  ScrollBar: () => null,
}))

vi.mock("@/components/app/screens/work-item-menus", () => ({
  IssueActionMenu: () => null,
  IssueContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  stopMenuEvent: (event: {
    preventDefault?: () => void
    stopPropagation?: () => void
  }) => {
    event.preventDefault?.()
    event.stopPropagation?.()
  },
  stopDragPropagation: (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.()
  },
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  WorkItemAssigneeAvatar: () => <span>Assignee</span>,
}))

vi.mock("@/components/ui/template-primitives", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/components/ui/template-primitives")
  >()

  return {
    ...actual,
    StatusRing: ({ status }: { status: string }) => <span>{status}</span>,
  }
})

vi.mock("@/lib/browser/dialog-transitions", () => ({
  openManagedCreateDialog: vi.fn(),
}))

import { BoardView, ListView } from "@/components/app/screens/work-surface-view"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  createDefaultViewFilters,
  type AppData,
  type DisplayProperty,
  type Team,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"

function createTeam(overrides?: Partial<Team>): Team {
  const baseSettings: Team["settings"] = {
    joinCode: "JOIN1234",
    summary: "",
    guestProjectIds: [],
    guestDocumentIds: [],
    guestWorkItemIds: [],
    experience: "software-development",
    features: createDefaultTeamFeatureSettings("software-development"),
    workflow: createDefaultTeamWorkflowSettings("software-development"),
  }

  return {
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "platform",
    name: "Platform",
    icon: "rocket",
    ...overrides,
    settings: {
      ...baseSettings,
      ...overrides?.settings,
    },
  }
}

function createView(
  layout: ViewDefinition["layout"] = "list",
  displayProps: DisplayProperty[] = [],
  overrides?: Partial<ViewDefinition>
): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout,
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
    ...overrides,
  }
}

function createWorkItem(): WorkItem {
  return {
    id: "item_1",
    key: "TES-1",
    teamId: "team_1",
    type: "issue",
    title: "Ship it",
    descriptionDocId: "",
    status: "done",
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
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z",
  }
}

function createData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [createWorkItem()],
  }
}

function createEditableData(): AppData {
  return {
    ...createData(),
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
    ],
  }
}

function createOrderedPropertyData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    users: [
      {
        id: "user_1",
        name: "Alex Morgan",
        email: "alex@example.com",
        title: "",
        handle: "alex",
        avatarUrl: "",
        avatarImageUrl: null,
        workosUserId: null,
        status: "offline",
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      },
    ],
    projects: [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "project-management",
        name: "Roadmap",
        summary: "",
        description: "",
        status: "backlog",
        health: "no-update",
        priority: "medium",
        leadId: "user_1",
        memberIds: ["user_1"],
        targetDate: null,
        startDate: null,
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:00:00.000Z",
      },
    ],
    workItems: [
      {
        ...createWorkItem(),
        assigneeId: "user_1",
        primaryProjectId: "project_1",
        dueDate: "2026-04-25T12:00:00.000Z",
      },
    ],
  }
}

function createProgressData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "parent",
        key: "TES-10",
        type: "epic",
        title: "Parent item",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "child-done",
        key: "TES-11",
        parentId: "parent",
        type: "feature",
        title: "Child done",
        status: "done",
      },
      {
        ...createWorkItem(),
        id: "child-open",
        key: "TES-12",
        parentId: "parent",
        type: "feature",
        title: "Child open",
        status: "in-progress",
      },
    ],
  }
}

function createAssignedHierarchyData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent",
        key: "TES-20",
        type: "epic",
        title: "Epic parent",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-parent",
        key: "TES-21",
        type: "feature",
        title: "Feature parent",
        status: "todo",
        parentId: "epic-parent",
      },
      {
        ...createWorkItem(),
        id: "requirement-middle",
        key: "TES-22",
        type: "requirement",
        title: "Requirement middle",
        status: "todo",
        parentId: "feature-parent",
      },
      {
        ...createWorkItem(),
        id: "story-child",
        key: "TES-23",
        type: "story",
        title: "Story child",
        status: "in-progress",
        assigneeId: "user_1",
        parentId: "requirement-middle",
      },
    ],
  }
}

function createAssignedHierarchyWithoutVisibleDescendantsData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent-empty",
        key: "EPIC",
        type: "epic",
        title: "Epic parent empty",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-parent-empty",
        key: "FEATURE",
        type: "feature",
        title: "Feature parent empty",
        status: "todo",
        parentId: "epic-parent-empty",
      },
      {
        ...createWorkItem(),
        id: "story-child-empty",
        key: "STORY",
        type: "story",
        title: "Story child empty",
        status: "in-progress",
        assigneeId: "user_2",
        parentId: "feature-parent-empty",
      },
    ],
  }
}

function createEpicGroupedCreateData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
    ],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-child",
        key: "TES-31",
        type: "feature",
        title: "Grouped feature",
        status: "in-progress",
        parentId: "epic-parent",
      },
    ],
  }
}

function createCrossTeamEpicGroupedCreateData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [
      createTeam(),
      createTeam({
        id: "team_2",
        slug: "ops",
        name: "Ops",
      }),
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
      {
        teamId: "team_2",
        userId: "user_1",
        role: "admin",
      },
    ],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent-team-2",
        teamId: "team_2",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "epic-parent-team-1",
        teamId: "team_1",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-child-team-1",
        teamId: "team_1",
        key: "TES-31",
        type: "feature",
        title: "Grouped feature",
        status: "in-progress",
        parentId: "epic-parent-team-1",
      },
    ],
  }
}

describe("ListView", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("does not render empty read-only groups without item rows", () => {
    const data = createData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView()}
        editable={false}
      />
    )

    expect(
      screen.queryByRole("button", { name: /backlog/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()
  })

  it("keeps add item available for empty unfiltered editable groups", () => {
    const data = {
      ...createEditableData(),
      workItems: [],
    }

    render(
      <ListView
        data={data}
        items={[]}
        view={createView("list", [], { grouping: "status" })}
        editable
        createContext={{
          defaultTeamId: "team_1",
          defaultProjectId: "project_1",
        }}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0])

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultProjectId: "project_1",
        defaultValues: expect.objectContaining({
          status: "backlog",
        }),
      })
    )
  })

  it("does not synthesize create-context groups for read-only empty surfaces", () => {
    const data = {
      ...createEditableData(),
      workItems: [],
    }
    const view = createView("list", [], { grouping: "status" })
    const createContext = {
      defaultTeamId: "team_1",
      defaultProjectId: "project_1",
    }

    const { rerender } = render(
      <ListView
        data={data}
        items={[]}
        scopedItems={[]}
        view={view}
        editable={false}
        createContext={createContext}
      />
    )

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={[]}
        scopedItems={[]}
        view={{ ...view, layout: "board" }}
        editable={false}
        createContext={createContext}
      />
    )

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()
  })

  it("does not render completion meters in list group headers", () => {
    const data = createProgressData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.parentId === null)}
        view={createView("list")}
        editable={false}
      />
    )

    expect(screen.queryByLabelText("Completion")).not.toBeInTheDocument()
  })

  it("renders child rollup progress on list rows when the progress property is enabled", () => {
    const data = createProgressData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.parentId === null)}
        view={createView("list", ["progress"])}
        editable={false}
      />
    )

    expect(screen.getByLabelText("Child progress 50%")).toBeInTheDocument()
  })

  it("renders child rollup progress on board cards only when the progress property is enabled", () => {
    const data = createProgressData()
    const topLevelItems = data.workItems.filter(
      (item) => item.parentId === null
    )

    const { rerender } = render(
      <BoardView
        data={data}
        items={topLevelItems}
        view={createView("board", ["progress"])}
        editable={false}
      />
    )

    expect(screen.getByLabelText("Child progress 50%")).toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={topLevelItems}
        view={createView("board")}
        editable={false}
      />
    )

    expect(
      screen.queryByLabelText("Child progress 50%")
    ).not.toBeInTheDocument()
  })

  it("renders list-row properties in the same order as visible properties", () => {
    const data = createOrderedPropertyData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["assignee", "project", "dueDate"])}
        editable={false}
      />
    )

    const assignee = screen.getByText("Assignee")
    const roadmap = screen.getByText("Roadmap")
    const dueDate = screen.getByText("Due 25 April")

    expect(
      assignee.compareDocumentPosition(roadmap) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      roadmap.compareDocumentPosition(dueDate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("renders board-card properties in the same order as visible properties", () => {
    const data = createOrderedPropertyData()

    render(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["project", "dueDate", "assignee"])}
        editable={false}
      />
    )

    const roadmap = screen.getByText("Roadmap")
    const dueDate = screen.getByText("Due 25 April")
    const assignee = screen.getByText("Assignee")

    expect(
      roadmap.compareDocumentPosition(dueDate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      dueDate.compareDocumentPosition(assignee) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("hides empty assignee and project pills on editable list rows and board cards", () => {
    const data = createEditableData()

    const { rerender } = render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["assignee", "project"])}
        editable
      />
    )

    expect(
      screen.queryByRole("button", { name: "Assignee" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Project" })
    ).not.toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["assignee", "project"])}
        editable
      />
    )

    expect(
      screen.queryByRole("button", { name: "Assignee" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Project" })
    ).not.toBeInTheDocument()
  })

  it("removes dedicated list drag handles and makes board cards draggable from the full card surface", () => {
    const data = createData()
    const { rerender } = render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list")}
        editable
      />
    )

    expect(screen.queryByLabelText("Drag Ship it")).not.toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board")}
        editable
      />
    )

    expect(screen.queryByLabelText("Drag Ship it")).not.toBeInTheDocument()
    expect(
      screen
        .getByText("Ship it")
        .closest('[aria-roledescription="draggable"]')
    ).toBeTruthy()
  })

  it("opens inline property pickers from both board cards and list rows", async () => {
    const data = createEditableData()
    const { rerender } = render(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["priority"])}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Medium" }))
    expect(await screen.findByText("Urgent")).toBeInTheDocument()

    rerender(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["priority"])}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Medium" }))
    expect(await screen.findByText("Urgent")).toBeInTheDocument()
  })

  it("preserves grouped parent defaults when adding an item from epic lanes", () => {
    const data = createEpicGroupedCreateData()
    const groupedItems = data.workItems.filter((item) => item.id === "feature-child")
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })
    const { rerender } = render(
      <BoardView
        data={data}
        items={groupedItems}
        view={view}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "feature",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent",
        }),
      })
    )

    vi.mocked(openManagedCreateDialog).mockClear()

    rerender(
      <ListView
        data={data}
        items={groupedItems}
        view={{ ...view, layout: "list" }}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "feature",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent",
        }),
      })
    )
  })

  it("derives parent defaults from the epic lane even when only the parent row is visible", () => {
    const data = createEpicGroupedCreateData()
    const laneItems = data.workItems.filter((item) => item.id === "epic-parent")
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })
    const { rerender } = render(
      <BoardView
        data={data}
        items={laneItems}
        view={view}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "feature",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent",
        }),
      })
    )

    vi.mocked(openManagedCreateDialog).mockClear()

    rerender(
      <ListView
        data={data}
        items={laneItems}
        view={{ ...view, layout: "list" }}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "feature",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent",
        }),
      })
    )
  })

  it("prefers the more specific parent subgroup when opening create from nested parent lanes", () => {
    const data = createEpicGroupedCreateData()
    const view = createView("board", [], {
      grouping: "epic",
      subGrouping: "feature",
      hiddenState: {
        groups: ["No epic"],
        subgroups: ["No feature"],
      },
    })
    const { rerender } = render(
      <BoardView
        data={data}
        items={data.workItems}
        view={view}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "requirement",
        defaultValues: expect.objectContaining({
          parentId: "feature-child",
        }),
      })
    )

    vi.mocked(openManagedCreateDialog).mockClear()

    rerender(
      <ListView
        data={data}
        items={data.workItems}
        view={{ ...view, layout: "list" }}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        initialType: "requirement",
        defaultValues: expect.objectContaining({
          parentId: "feature-child",
        }),
      })
    )
  })

  it("scopes parent lane defaults to the active team when duplicate parent labels exist", () => {
    const data = createCrossTeamEpicGroupedCreateData()
    const groupedItems = data.workItems.filter(
      (item) => item.id === "feature-child-team-1"
    )
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })
    const { rerender } = render(
      <BoardView
        data={data}
        items={groupedItems}
        view={view}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent-team-1",
        }),
      })
    )

    vi.mocked(openManagedCreateDialog).mockClear()

    rerender(
      <ListView
        data={data}
        items={groupedItems}
        view={{ ...view, layout: "list" }}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultValues: expect.objectContaining({
          parentId: "epic-parent-team-1",
        }),
      })
    )
  })

  it("renders the lowest assigned descendant under the selected parent level in list mode", () => {
    const data = createAssignedHierarchyData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.id === "epic-parent")}
        scopedItems={data.workItems}
        view={createView("list", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    fireEvent.click(screen.getByLabelText("Expand sub-issues"))

    expect(screen.getByText("Story child")).toBeInTheDocument()
    expect(screen.queryByText("Feature parent")).not.toBeInTheDocument()
  })

  it("labels compressed board children using the visible assigned descendant type", () => {
    const data = createAssignedHierarchyData()

    render(
      <BoardView
        data={data}
        items={data.workItems.filter((item) => item.id === "epic-parent")}
        scopedItems={data.workItems}
        view={createView("board", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    const childDisclosure = screen.getByRole("button", { name: "1 story" })
    expect(childDisclosure).toBeInTheDocument()

    fireEvent.click(childDisclosure)

    expect(screen.getByText("Story child")).toBeInTheDocument()
  })

  it("does not show fallback child counts when assigned-descendant containers have no visible descendants", () => {
    const data = createAssignedHierarchyWithoutVisibleDescendantsData()
    const items = data.workItems.filter((item) => item.id === "epic-parent-empty")

    const { rerender } = render(
      <ListView
        data={data}
        items={items}
        scopedItems={data.workItems}
        view={createView("list", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    expect(screen.queryByLabelText("Expand sub-issues")).not.toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(1)

    rerender(
      <BoardView
        data={data}
        items={items}
        scopedItems={data.workItems}
        view={createView("board", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    expect(screen.queryByLabelText("1 story")).not.toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(1)
  })
})
