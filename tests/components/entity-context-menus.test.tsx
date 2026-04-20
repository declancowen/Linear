import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open?: boolean
  }) => <>{open ? children : null}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContextMenuSeparator: () => null,
  ContextMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode
    onSelect?: (event: Event) => void
  }) => (
    <button
      type="button"
      onClick={() => onSelect?.(new Event("select"))}
    >
      {children}
    </button>
  ),
}))

vi.mock("@phosphor-icons/react", () => ({
  ArrowSquareOut: () => null,
  PencilSimple: () => null,
  Trash: () => null,
}))

import { ViewContextMenu } from "@/components/app/screens/entity-context-menus"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultViewFilters,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
  return {
    id: "view_1",
    name: "Platform board",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout: "board",
    filters: createDefaultViewFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps: ["id", "status"],
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

function seedState() {
  useAppStore.setState({
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    workspaces: [
      {
        id: "workspace_1",
        slug: "acme",
        name: "Acme",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_2",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      },
    ],
    workspaceMemberships: [
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "admin",
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
          summary: "",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: createDefaultTeamFeatureSettings("software-development"),
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
      {
        id: "team_2",
        workspaceId: "workspace_1",
        slug: "design",
        name: "Design",
        icon: "palette",
        settings: {
          joinCode: "JOIN5678",
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
  })
}

describe("ViewContextMenu", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    vi.clearAllMocks()
  })

  it("hides rename and delete for team views the user cannot edit", () => {
    render(
      <ViewContextMenu
        view={createView({
          id: "view_design",
          name: "Design board",
          scopeId: "team_2",
          route: "/team/design/work",
        })}
        editable
      >
        <button type="button">Open</button>
      </ViewContextMenu>
    )

    expect(screen.getByText("Open view")).toBeInTheDocument()
    expect(screen.queryByText("Rename view")).not.toBeInTheDocument()
    expect(screen.queryByText("Delete view")).not.toBeInTheDocument()
  })

  it("keeps rename and delete for workspace-scoped views when the workspace is editable", () => {
    render(
      <ViewContextMenu
        view={createView({
          id: "view_workspace",
          name: "Workspace roadmap",
          scopeType: "workspace",
          scopeId: "workspace_1",
          route: "/workspace/projects",
        })}
        editable
      >
        <button type="button">Open</button>
      </ViewContextMenu>
    )

    expect(screen.getByText("Rename view")).toBeInTheDocument()
    expect(screen.getByText("Delete view")).toBeInTheDocument()
  })
})
