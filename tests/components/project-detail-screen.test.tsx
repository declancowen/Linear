import type { ButtonHTMLAttributes, ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectDetailScreen } from "@/components/app/screens/project-detail-screen"
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

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/app/screens/shared", () => ({
  HeaderTitle: ({ title }: { title: string }) => <div>{title}</div>,
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock("@/components/app/screens/project-detail-ui", () => ({
  ProjectOverviewTab: () => <div>Overview</div>,
  ProjectActivityTab: () => <div>Activity</div>,
  ProjectPropertiesSidebar: () => <div>Properties</div>,
}))

vi.mock("@/components/app/screens/work-surface-controls", () => ({
  FilterPopover: () => null,
  LevelChipPopover: () => null,
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
  CaretRight: () => null,
  Plus: () => null,
  SidebarSimple: () => null,
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
        status: "active",
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-18T09:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        presentation: null,
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
            title: "Assigned",
            body: "",
            readAt: null,
            createdAt: "2026-04-18T11:00:00.000Z",
          },
        ],
      }))
    })

    expect(screen.getByText("List layout")).toBeInTheDocument()
  })
})
