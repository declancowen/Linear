import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { ViewsScreen } from "@/components/app/screens"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type CreateDialogState,
  type ViewDefinition,
} from "@/lib/domain/types"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
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

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    ...props
  }: HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
  TableHead: ({
    children,
    ...props
  }: ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  TableCell: ({
    children,
    ...props
  }: TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
}))

vi.mock("@/components/app/screens/shared", () => ({
  CollectionDisplaySettingsPopover: () => null,
  HeaderTitle: ({ title }: { title: string }) => <div>{title}</div>,
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
  SCREEN_HEADER_CLASS_NAME: "screen-header",
  ScreenHeader: ({
    title,
    actions,
  }: {
    title: string
    actions?: ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
    </div>
  ),
  ViewsDisplaySettingsPopover: () => <button type="button">Display settings</button>,
  formatEntityKind: (entityKind: string) => entityKind,
  getDocumentPreview: () => "",
  getEntityKindIcon: () => <span>Icon</span>,
}))

vi.mock("@/components/app/screens/collection-boards", () => ({
  DocumentBoard: () => <div>Document board</div>,
  ProjectBoard: () => <div>Project board</div>,
  SavedViewsBoard: ({
    views,
    contextLabels,
  }: {
    views: ViewDefinition[]
    contextLabels?: Record<string, string>
  }) => (
    <div>
      {views.map((view) => (
        <div key={view.id}>
          <span>{view.name}</span>
          <span>{contextLabels?.[view.id] ?? "Shared"}</span>
        </div>
      ))}
    </div>
  ),
}))

vi.mock("@/components/app/screens/work-surface", () => ({
  WorkSurface: () => <div>Work surface</div>,
}))

vi.mock("@/components/app/screens/create-document-dialog", () => ({
  CreateDocumentDialog: () => null,
}))

vi.mock("@/components/app/team-workflow-settings-dialog", () => ({
  TeamWorkflowSettingsDialog: () => null,
}))

vi.mock("@/components/app/screens/document-ui", () => ({
  DocumentContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DocumentAuthorAvatar: () => null,
}))

vi.mock("@/components/app/screens/work-surface-controls", () => ({
  ProjectFilterPopover: () => null,
  ProjectViewConfigPopover: () => null,
}))

vi.mock("@phosphor-icons/react", () => ({
  ArrowSquareOut: () => null,
  FileText: () => null,
  PencilSimple: () => null,
  Plus: () => null,
  Trash: () => null,
}))

function createView(overrides?: Partial<ViewDefinition>): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout: "board",
    filters: {
      status: [],
      priority: [],
      assigneeIds: [],
      creatorIds: [],
      leadIds: [],
      health: [],
      milestoneIds: [],
      relationTypes: [],
      projectIds: [],
      itemTypes: [],
      labelIds: [],
      teamIds: [],
      showCompleted: true,
    },
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
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
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
        createdBy: "user_1",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
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
    views: [
      createView({
        id: "workspace-view",
        name: "Workspace roadmap",
        scopeType: "workspace",
        scopeId: "workspace_1",
        entityKind: "projects",
        route: "/workspace/projects",
      }),
      createView({
        id: "team-view",
        name: "Platform board",
        scopeType: "team",
        scopeId: "team_1",
        entityKind: "projects",
        route: "/team/platform/projects",
      }),
      createView({
        id: "legacy-view",
        name: "Legacy workspace board",
        scopeType: "personal",
        scopeId: "user_1",
        entityKind: "projects",
        isShared: false,
        route: "/workspace/projects",
      }),
      createView({
        id: "hidden-team-view",
        name: "Design board",
        scopeType: "team",
        scopeId: "team_2",
        entityKind: "projects",
        route: "/team/design/projects",
      }),
    ],
  })
}

describe("ViewsScreen", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    vi.clearAllMocks()
  })

  it("shows workspace and accessible team views together with their real scope labels", () => {
    render(
      <ViewsScreen
        scopeId="workspace_1"
        scopeType="workspace"
        title="Workspace views"
      />
    )

    expect(screen.getByText("Scope")).toBeInTheDocument()
    expect(screen.queryByText("Sharing")).not.toBeInTheDocument()
    expect(screen.getByText("Workspace roadmap")).toBeInTheDocument()
    expect(screen.getByText("Platform board")).toBeInTheDocument()
    expect(screen.getByText("Legacy workspace board")).toBeInTheDocument()
    expect(screen.queryByText("Design board")).not.toBeInTheDocument()
    expect(screen.getAllByText("Acme").length).toBeGreaterThan(0)
    expect(screen.getByText("Platform")).toBeInTheDocument()
  })

  it("keeps workspace views createable from the workspace directory without locking scope", () => {
    render(
      <ViewsScreen
        scopeId="workspace_1"
        scopeType="workspace"
        title="Workspace views"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "New" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "view",
        defaultScopeType: "workspace",
        defaultScopeId: "workspace_1",
      })
    )
    const firstDialog = vi.mocked(openManagedCreateDialog).mock.calls[0]?.[0] as
      | Extract<CreateDialogState, { kind: "view" }>
      | undefined
    expect(firstDialog?.lockScope).toBeUndefined()
  })
})
