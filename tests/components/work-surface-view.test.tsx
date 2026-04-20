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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock("@/components/app/screens/work-item-menus", () => ({
  IssueActionMenu: () => null,
  IssueContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  stopMenuEvent: (event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
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

vi.mock("@/components/ui/template-primitives", () => ({
  StatusRing: ({ status }: { status: string }) => <span>{status}</span>,
}))

import { BoardView, ListView } from "@/components/app/screens/work-surface-view"
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

function createTeam(): Team {
  return {
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "platform",
    name: "Platform",
    icon: "rocket",
    settings: {
      joinCode: "JOIN1234",
      summary: "",
      guestProjectIds: [],
      guestDocumentIds: [],
      guestWorkItemIds: [],
      experience: "software-development",
      features: createDefaultTeamFeatureSettings("software-development"),
      workflow: createDefaultTeamWorkflowSettings("software-development"),
    },
  }
}

function createView(
  layout: ViewDefinition["layout"] = "list",
  displayProps: DisplayProperty[] = []
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

describe("ListView", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("does not expand empty groups into placeholder space", () => {
    render(
      <ListView
        data={createData()}
        items={createData().workItems}
        view={createView()}
        editable={false}
      />
    )

    const backlogHeader = screen.getByRole("button", { name: /backlog/i })

    expect(screen.queryByText("No items")).not.toBeInTheDocument()

    fireEvent.click(backlogHeader)

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
    const topLevelItems = data.workItems.filter((item) => item.parentId === null)

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

    expect(screen.queryByLabelText("Child progress 50%")).not.toBeInTheDocument()
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
    const dueDate = screen.getByText("Apr 25")

    expect(
      assignee.compareDocumentPosition(roadmap) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      roadmap.compareDocumentPosition(dueDate) & Node.DOCUMENT_POSITION_FOLLOWING
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
    const dueDate = screen.getByText("Apr 25")
    const assignee = screen.getByText("Assignee")

    expect(
      roadmap.compareDocumentPosition(dueDate) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      dueDate.compareDocumentPosition(assignee) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("keeps drag affordances on dedicated handles instead of the whole item body", () => {
    const data = createData()
    const { rerender } = render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list")}
        editable
      />
    )

    expect(screen.getByLabelText("Drag Ship it")).toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board")}
        editable
      />
    )

    expect(screen.getByLabelText("Drag Ship it")).toBeInTheDocument()
  })
})
