import type { HTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

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
  DialogContent: ({
    children,
    ...props
  }: {
    children: ReactNode
  } & HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/input", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createInputStubModule()
)

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

import {
  ProjectContextMenu,
  ViewContextMenu,
} from "@/components/app/screens/entity-context-menus"
import { RenameDialog } from "@/components/app/screens/rename-dialog"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultViewFilters,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type Project,
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

function createProject(overrides?: Partial<Project>): Project {
  return {
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
    views: [createView()],
  })
}

function renderViewContextMenu(overrides: Partial<ViewDefinition>) {
  render(
    <ViewContextMenu view={createView(overrides)}>
      <button type="button">Open</button>
    </ViewContextMenu>
  )
}

function expectRenameDeleteVisibility(
  entity: "view" | "project",
  visibility: "visible" | "hidden"
) {
  const rename = `Rename ${entity}`
  const deleteLabel = `Delete ${entity}`

  if (visibility === "visible") {
    expect(screen.getByText(rename)).toBeInTheDocument()
    expect(screen.getByText(deleteLabel)).toBeInTheDocument()
    return
  }

  expect(screen.queryByText(rename)).not.toBeInTheDocument()
  expect(screen.queryByText(deleteLabel)).not.toBeInTheDocument()
}

describe("RenameDialog", () => {
  it("confirms trimmed values from Enter and ignores guarded key targets", async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    const onOpenChange = vi.fn()
    const { container } = render(
      <RenameDialog
        open
        onOpenChange={onOpenChange}
        title="Rename view"
        description="Update the saved view name."
        initialValue="  New roadmap  "
        confirmLabel="Rename"
        minLength={1}
        maxLength={80}
        onConfirm={onConfirm}
      />
    )

    const dialogContent = container.querySelector("div") as HTMLDivElement
    fireEvent.keyDown(screen.getByText("Cancel"), { key: "Enter" })
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.keyDown(dialogContent, { key: "Enter" })
    expect(onConfirm).toHaveBeenCalledWith("New roadmap")
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("blocks blank or over-limit rename submissions", () => {
    const onConfirm = vi.fn()
    render(
      <RenameDialog
        open
        onOpenChange={vi.fn()}
        title="Rename project"
        description="Update the project name."
        initialValue=" "
        confirmLabel="Rename"
        minLength={1}
        maxLength={4}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByText("Rename"))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText("Rename")).toBeDisabled()
  })
})

describe("ViewContextMenu", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    vi.clearAllMocks()
  })

  it("hides rename and delete for team views the user cannot edit", () => {
    renderViewContextMenu({
      id: "view_design",
      name: "Design board",
      scopeId: "team_2",
      route: "/team/design/work",
    })

    expect(screen.getByText("Open view")).toBeInTheDocument()
    expectRenameDeleteVisibility("view", "hidden")
  })

  it("keeps rename and delete for workspace-scoped views when the workspace is editable", () => {
    useAppStore.setState((state) => ({
      ...state,
      views: [
        ...state.views,
        createView({
          id: "view_workspace",
          name: "Workspace roadmap",
          scopeType: "workspace",
          scopeId: "workspace_1",
          route: "/workspace/projects",
        }),
      ],
    }))

    renderViewContextMenu({
      id: "view_workspace",
      name: "Workspace roadmap",
      scopeType: "workspace",
      scopeId: "workspace_1",
      route: "/workspace/projects",
    })

    expectRenameDeleteVisibility("view", "visible")
  })

  it("allows custom views that reuse a system label", () => {
    useAppStore.setState((state) => ({
      ...state,
      views: [
        ...state.views,
        createView({
          id: "view_custom_1",
          name: "All work",
          route: "/team/platform/work",
        }),
      ],
    }))

    renderViewContextMenu({
      id: "view_custom_1",
      name: "All work",
      route: "/team/platform/work",
    })

    expectRenameDeleteVisibility("view", "visible")
  })

  it("hides rename and delete for synthetic views that are not persisted", () => {
    renderViewContextMenu({
      id: "view_fallback_project",
      name: "All projects",
      entityKind: "projects",
      route: "/team/platform/projects",
    })

    expect(screen.getByText("Open view")).toBeInTheDocument()
    expectRenameDeleteVisibility("view", "hidden")
  })
})

describe("ProjectContextMenu", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    vi.clearAllMocks()
  })

  it("hides rename and delete for team projects the user cannot edit", () => {
    render(
      <ProjectContextMenu
        data={useAppStore.getState()}
        project={createProject({
          id: "project_design",
          name: "Design system refresh",
          scopeId: "team_2",
        })}
      >
        <button type="button">Open</button>
      </ProjectContextMenu>
    )

    expect(screen.getByText("Open project")).toBeInTheDocument()
    expectRenameDeleteVisibility("project", "hidden")
  })

  it("keeps rename and delete for workspace-scoped projects when the workspace is editable", () => {
    render(
      <ProjectContextMenu
        data={useAppStore.getState()}
        project={createProject({
          id: "project_workspace",
          name: "Workspace roadmap",
          scopeType: "workspace",
          scopeId: "workspace_1",
        })}
      >
        <button type="button">Open</button>
      </ProjectContextMenu>
    )

    expectRenameDeleteVisibility("project", "visible")
  })
})
