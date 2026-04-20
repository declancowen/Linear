import type { ButtonHTMLAttributes, ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { createViewDefinition } from "@/lib/domain/default-views"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

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
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/lib/browser/dialog-transitions", () => ({
  openManagedCreateDialog: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      Sidebar
    </button>
  ),
}))

vi.mock("@/components/app/screens/shared", () => ({
  HeaderTitle: ({ title }: { title: string }) => <div>{title}</div>,
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock("@/components/app/screens/project-detail-ui", () => ({
  ProjectPropertiesSidebar: () => <div>Properties</div>,
}))

vi.mock("@/components/app/screens/work-surface-controls", () => ({
  FilterPopover: () => null,
  GroupChipPopover: () => null,
  LayoutTabs: () => null,
  LevelChipPopover: () => null,
  PropertiesChipPopover: () => null,
  SortChipPopover: () => null,
  getAvailableGroupOptions: () => [],
  ViewConfigPopover: ({
    onUpdateView,
  }: {
    onUpdateView?: (patch: { layout?: "list" | "board" | "timeline" }) => void
  }) => (
    <button
      type="button"
      onClick={() => onUpdateView?.({ layout: "list" })}
    >
      Switch layout
    </button>
  ),
}))

vi.mock("@/components/app/screens/work-surface-view", () => ({
  BoardView: () => <div>Board layout</div>,
  ListView: () => <div>List layout</div>,
  TimelineView: () => <div>Timeline layout</div>,
}))

vi.mock("@phosphor-icons/react", () => ({
  ArrowSquareOut: () => null,
  CaretRight: () => null,
  PencilSimple: () => null,
  Plus: () => null,
  SidebarSimple: () => null,
  Trash: () => null,
}))

function seedState() {
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
          summary: "",
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
    ],
    projects: [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "software-delivery",
        name: "Launch",
        summary: "",
        description: "",
        leadId: "user_1",
        memberIds: [],
        health: "on-track",
        priority: "medium",
        status: "in-progress",
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        presentation: undefined,
      },
    ],
    workItems: [
      {
        id: "item_1",
        key: "TES-101",
        teamId: "team_1",
        type: "epic",
        title: "Epic",
        descriptionDocId: "doc_1",
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
        subscriberIds: ["user_1"],
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ],
  })
}

describe("ProjectDetailScreen", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("does not reset local item layout on unrelated rerenders when the project has no persisted presentation", async () => {
    render(<ProjectDetailScreen projectId="project_1" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText("Board layout")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch layout" }))
    })

    expect(screen.getByText("List layout")).toBeInTheDocument()

    await act(async () => {
      useAppStore.setState((state) => ({
        notifications: [
          ...state.notifications,
          {
            id: "notification_1",
            userId: "user_1",
            type: "assignment",
            entityType: "workItem",
            entityId: "item_1",
            actorId: "user_1",
            message: "Assigned",
            readAt: null,
            archivedAt: null,
            emailedAt: null,
            createdAt: "2026-04-18T11:00:00.000Z",
          },
        ],
      }))
    })

    expect(screen.getByText("List layout")).toBeInTheDocument()
  })

  it("opens the shared create-work modal with the current project preselected", () => {
    render(<ProjectDetailScreen projectId="project_1" />)

    fireEvent.click(screen.getByRole("button", { name: "New" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workItem",
        defaultTeamId: "team_1",
        defaultProjectId: "project_1",
      })
    )
  })

  it("opens the shared create-view modal with the current project preselected", () => {
    render(<ProjectDetailScreen projectId="project_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Create view" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "view",
        defaultScopeType: "team",
        defaultScopeId: "team_1",
        defaultProjectId: "project_1",
        defaultEntityKind: "items",
        defaultRoute: "/team/platform/projects/project_1",
        lockScope: true,
        lockProject: true,
        lockEntityKind: true,
      })
    )
  })

  it("renders the shared empty work state for projects with no items", () => {
    useAppStore.setState((state) => ({
      ...state,
      workItems: [],
    }))

    render(<ProjectDetailScreen projectId="project_1" />)

    expect(screen.getByText("Board layout")).toBeInTheDocument()
    expect(screen.getByText("No work items yet")).toBeInTheDocument()
    expect(screen.queryByText("No linked items yet.")).not.toBeInTheDocument()
  })

  it("keeps builtin project tabs active until a saved view is explicitly selected", async () => {
    const savedProjectView = createViewDefinition({
      id: "saved_project_view",
      name: "Saved list",
      description: "",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      containerType: "project-items",
      containerId: "project_1",
      route: "/team/platform/projects/project_1",
      teamSlug: "platform",
      experience: "software-development",
      createdAt: "2026-04-18T10:00:00.000Z",
      updatedAt: "2026-04-18T10:00:00.000Z",
      overrides: {
        layout: "list",
      },
    })

    if (!savedProjectView) {
      throw new Error("Expected saved project view to be created")
    }

    useAppStore.setState((state) => ({
      ...state,
      views: [savedProjectView],
    }))

    render(<ProjectDetailScreen projectId="project_1" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText("Board layout")).toBeInTheDocument()
    expect(screen.queryByText("List layout")).not.toBeInTheDocument()
  })

  it("restores the stable all-items template after switching between builtin tabs", async () => {
    render(<ProjectDetailScreen projectId="project_1" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText("Board layout")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Active" }))
    })

    expect(screen.getByText("Board layout")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch layout" }))
    })

    expect(screen.getByText("List layout")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "All work" }))
    })

    expect(screen.getByText("Board layout")).toBeInTheDocument()
    expect(screen.queryByText("List layout")).not.toBeInTheDocument()
  })
})
