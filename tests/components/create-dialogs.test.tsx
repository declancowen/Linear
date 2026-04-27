import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/components/ui/select", async () => {
  const React = await import("react")

  type SelectItemDefinition = {
    value: string
    label: string
  }

  function getTextContent(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") {
      return String(node)
    }

    if (Array.isArray(node)) {
      return node.map((entry) => getTextContent(entry)).join("")
    }

    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
      return getTextContent(node.props.children)
    }

    return ""
  }

  function collectItems(node: React.ReactNode): SelectItemDefinition[] {
    const items: SelectItemDefinition[] = []

    React.Children.forEach(node, (child) => {
      if (
        !React.isValidElement<{
          children?: React.ReactNode
          value: string
        }>(child)
      ) {
        return
      }

      if ((child.type as { displayName?: string }).displayName === "MockSelectItem") {
        items.push({
          value: child.props.value,
          label: getTextContent(child.props.children),
        })
      }

      if (child.props.children) {
        items.push(...collectItems(child.props.children))
      }
    })

    return items
  }

  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
    items: SelectItemDefinition[]
  } | null>(null)

  function Select({
    value,
    defaultValue,
    onValueChange,
    children,
  }: {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) {
    const items = React.useMemo(() => collectItems(children), [children])
    const [internalValue, setInternalValue] = React.useState(
      defaultValue ?? items[0]?.value ?? ""
    )
    const controlled = value !== undefined
    const currentValue = controlled ? value : internalValue

    return (
      <SelectContext.Provider
        value={{
          value: currentValue,
          onValueChange(nextValue) {
            if (!controlled) {
              setInternalValue(nextValue)
            }

            onValueChange?.(nextValue)
          },
          items,
        }}
      >
        {children}
      </SelectContext.Provider>
    )
  }

  function SelectTrigger(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const context = React.useContext(SelectContext)

    return (
      <select
        role="combobox"
        value={context?.value ?? ""}
        onChange={(event) => context?.onValueChange(event.target.value)}
        {...props}
      >
        {context?.items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    )
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return <span>{placeholder ?? null}</span>
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }

  function SelectGroup({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }

  function SelectItem() {
    return null
  }

  SelectItem.displayName = "MockSelectItem"

  return {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  }
})

import { CreateProjectDialog } from "@/components/app/screens/project-creation"
import { CreateDocumentDialog } from "@/components/app/screens/create-document-dialog"
import { CreateViewDialog } from "@/components/app/screens/create-view-dialog"
import { CreateWorkItemDialog } from "@/components/app/screens/create-work-item-dialog"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultViewFilters,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

describe("create dialogs", () => {
  beforeEach(() => {
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
      labels: [
        {
          id: "label_1",
          workspaceId: "workspace_1",
          name: "Platform",
          color: "blue",
        },
      ],
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
          icon: "code",
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
          slug: "ops",
          name: "Ops",
          icon: "box",
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
        {
          teamId: "team_2",
          userId: "user_1",
          role: "admin",
        },
      ],
      projects: [],
      ui: {
        ...createEmptyState().ui,
        activeTeamId: "team_1",
      },
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("renders the work-item create dialog without recursive store updates", () => {
    render(
      <CreateWorkItemDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
        initialType="epic"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Epic title")).toBeInTheDocument()
    expect(screen.queryByText("New item")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Start date" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Target date" })
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveClass("top-6", "translate-y-0")
  })

  it("lets you switch team spaces without throwing when an initial type is provided", async () => {
    render(
      <CreateWorkItemDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
        initialType="epic"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Platform" }))
    fireEvent.click(await screen.findByText("Ops"))

    expect(screen.getAllByText("Ops").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Epic title")).toBeInTheDocument()
  })

  it("forwards dueDate default values when creating a work item", async () => {
    const createWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "createWorkItem")
      .mockReturnValue("item_new")

    try {
      render(
        <CreateWorkItemDialog
          open
          onOpenChange={vi.fn()}
          defaultTeamId="team_1"
          defaultValues={{
            dueDate: "2026-05-01",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/title/i), {
        target: { value: "Launch task" },
      })

      fireEvent.click(screen.getByRole("button", { name: /Create /i }))

      await waitFor(() =>
        expect(createWorkItemSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            dueDate: "2026-05-01",
          })
        )
      )
    } finally {
      createWorkItemSpy.mockRestore()
    }
  })

  it("drops invalid default assignees that do not belong to the selected team", async () => {
    useAppStore.setState((state) => ({
      ...state,
      users: [
        ...state.users,
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
      teamMemberships: [
        ...state.teamMemberships,
        {
          teamId: "team_1",
          userId: "user_2",
          role: "member",
        },
      ],
    }))

    const createWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "createWorkItem")
      .mockReturnValue("item_new")

    try {
      render(
        <CreateWorkItemDialog
          open
          onOpenChange={vi.fn()}
          defaultTeamId="team_2"
          defaultValues={{
            assigneeId: "user_2",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/title/i), {
        target: { value: "Cross-team task" },
      })

      fireEvent.click(screen.getByRole("button", { name: /Create /i }))

      await waitFor(() =>
        expect(createWorkItemSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            assigneeId: null,
          })
        )
      )
    } finally {
      createWorkItemSpy.mockRestore()
    }
  })

  it("keeps explicit lane project defaults while preserving the preselected parent", async () => {
    useAppStore.setState((state) => ({
      ...state,
      projects: [
        {
          id: "project_parent",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Parent project",
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
        {
          id: "project_lane",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Lane project",
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
          id: "feature_parent",
          key: "FEAT-1",
          teamId: "team_1",
          type: "feature",
          title: "Feature parent",
          descriptionDocId: "",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_parent",
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
        },
      ],
    }))

    const createWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "createWorkItem")
      .mockReturnValue("item_new")

    try {
      render(
        <CreateWorkItemDialog
          open
          onOpenChange={vi.fn()}
          defaultTeamId="team_1"
          defaultProjectId="project_lane"
          initialType="requirement"
          defaultValues={{
            parentId: "feature_parent",
            primaryProjectId: "project_lane",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/title/i), {
        target: { value: "Lane child" },
      })

      fireEvent.click(screen.getByRole("button", { name: /Create /i }))

      await waitFor(() =>
        expect(createWorkItemSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "requirement",
            parentId: "feature_parent",
            primaryProjectId: "project_lane",
          })
        )
      )
    } finally {
      createWorkItemSpy.mockRestore()
    }
  })

  it("still inherits the parent project when no explicit lane project default is provided", async () => {
    useAppStore.setState((state) => ({
      ...state,
      projects: [
        {
          id: "project_parent",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Parent project",
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
          id: "feature_parent",
          key: "FEAT-1",
          teamId: "team_1",
          type: "feature",
          title: "Feature parent",
          descriptionDocId: "",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_parent",
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
        },
      ],
    }))

    const createWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "createWorkItem")
      .mockReturnValue("item_new")

    try {
      render(
        <CreateWorkItemDialog
          open
          onOpenChange={vi.fn()}
          defaultTeamId="team_1"
          initialType="requirement"
          defaultValues={{
            parentId: "feature_parent",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/title/i), {
        target: { value: "Inherited child" },
      })

      fireEvent.click(screen.getByRole("button", { name: /Create /i }))

      await waitFor(() =>
        expect(createWorkItemSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "requirement",
            parentId: "feature_parent",
            primaryProjectId: "project_parent",
          })
        )
      )
    } finally {
      createWorkItemSpy.mockRestore()
    }
  })

  it("renders the project create dialog without recursive store updates", () => {
    render(
      <CreateProjectDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Project name")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveClass("top-6", "translate-y-0")
  })

  it("shows only canonical project statuses in the project status picker", async () => {
    render(
      <CreateProjectDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Backlog/ }))

    expect(await screen.findByText("Planned")).toBeInTheDocument()
    expect(screen.queryByText("Planning")).not.toBeInTheDocument()
  })

  it("uses the searchable team-space picker in the project create dialog and resets to the caller team on reopen", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <CreateProjectDialog
        open
        onOpenChange={onOpenChange}
        defaultTeamId="team_1"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Platform" }))
    expect(
      await screen.findByPlaceholderText("Switch team space…")
    ).toBeInTheDocument()
    fireEvent.click(await screen.findByText("Ops"))
    expect(screen.getAllByText("Ops").length).toBeGreaterThan(0)

    rerender(
      <CreateProjectDialog
        open={false}
        onOpenChange={onOpenChange}
        defaultTeamId="team_1"
      />
    )
    rerender(
      <CreateProjectDialog
        open
        onOpenChange={onOpenChange}
        defaultTeamId="team_1"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
  })

  it("starts create view from clean defaults instead of seeded config", async () => {
    useAppStore.setState({
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Billing v2",
          summary: "Billing overhaul",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "high",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "PLAT-101",
          teamId: "team_1",
          type: "task",
          title: "Ship billing work",
          descriptionDocId: "doc_1",
          status: "todo",
          priority: "high",
          assigneeId: "user_1",
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_1",
          linkedProjectIds: ["project_1"],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    })

    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "team",
            defaultScopeId: "team_1",
            defaultEntityKind: "items",
            defaultRoute: "/team/platform/work",
            lockScope: true,
            lockEntityKind: true,
            initialConfig: {
              layout: "board",
              filters: {
                ...createDefaultViewFilters(),
                projectIds: ["project_1"],
              },
              ordering: "updatedAt",
              itemLevel: "task",
              showChildItems: false,
            },
          }}
        />
      )

      expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Level.*Epic/ })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Group" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Properties.*0/ })
      ).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Billing queue" },
      })
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Create view" })).not.toBeDisabled()
      )

      fireEvent.click(screen.getByRole("button", { name: "Create view" }))

      expect(createViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "team",
          scopeId: "team_1",
          entityKind: "items",
          route: "/team/platform/work",
          name: "Billing queue",
          layout: "list",
          ordering: "createdAt",
          filters: expect.objectContaining({
            projectIds: [],
          }),
        })
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })

  it("creates a project-specific view from the workspace dialog when a project is selected", async () => {
    useAppStore.setState({
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Billing v2",
          summary: "Billing overhaul",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "high",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "project_2",
          scopeType: "team",
          scopeId: "team_2",
          templateType: "software-delivery",
          name: "Ops cutover",
          summary: "Ops readiness",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "medium",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    })

    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "workspace",
            defaultScopeId: "workspace_1",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Ops launch board" },
      })

      expect(screen.getByRole("button", { name: "Acme" })).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Project" }))
      fireEvent.click(await screen.findByRole("button", { name: "Ops cutover" }))
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Create view" })).not.toBeDisabled()
      )
      fireEvent.click(screen.getByRole("button", { name: "Create view" }))

      expect(createViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "team",
          scopeId: "team_2",
          entityKind: "items",
          route: "/team/ops/projects/project_2",
          name: "Ops launch board",
        })
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })

  it("lets workspace-scoped item views be created without editable teams", async () => {
    useAppStore.setState({
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: "user_1",
          role: "admin",
        },
      ],
      teamMemberships: [],
      projects: [
        {
          id: "project_workspace",
          scopeType: "workspace",
          scopeId: "workspace_1",
          templateType: "software-delivery",
          name: "Workspace roadmap",
          summary: "Shared roadmap",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "high",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    })

    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "workspace",
            defaultScopeId: "workspace_1",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Ops intake" },
      })
      expect(screen.getByRole("button", { name: "Acme" })).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Project" }))
      fireEvent.click(await screen.findByRole("button", { name: "Workspace roadmap" }))
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Create view" })).not.toBeDisabled()
      )
      fireEvent.click(screen.getByRole("button", { name: "Create view" }))

      expect(createViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "workspace",
          scopeId: "workspace_1",
          entityKind: "items",
          route: "/workspace/projects/project_workspace",
          name: "Ops intake",
        })
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })

  it("lets unlocked create-view flows switch entity kind before submit", async () => {
    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "workspace",
            defaultScopeId: "workspace_1",
          }}
        />
      )

      fireEvent.change(screen.getByRole("combobox", { name: "Entity kind" }), {
        target: { value: "projects" },
      })
      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Workspace projects" },
      })

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Create view" })
        ).not.toBeDisabled()
      )

      fireEvent.click(screen.getByRole("button", { name: "Create view" }))

      expect(createViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "workspace",
          scopeId: "workspace_1",
          entityKind: "projects",
          route: "/workspace/projects",
          name: "Workspace projects",
        })
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })

  it("resets unlocked create-view entity kind on reopen", () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <CreateViewDialog
        open
        onOpenChange={onOpenChange}
        dialog={{
          kind: "view",
          defaultScopeType: "workspace",
          defaultScopeId: "workspace_1",
        }}
      />
    )

    fireEvent.change(screen.getByRole("combobox", { name: "Entity kind" }), {
      target: { value: "projects" },
    })
    expect(screen.getByRole("combobox", { name: "Entity kind" })).toHaveValue(
      "projects"
    )

    rerender(
      <CreateViewDialog
        open={false}
        onOpenChange={onOpenChange}
        dialog={{
          kind: "view",
          defaultScopeType: "workspace",
          defaultScopeId: "workspace_1",
        }}
      />
    )
    rerender(
      <CreateViewDialog
        open
        onOpenChange={onOpenChange}
        dialog={{
          kind: "view",
          defaultScopeType: "workspace",
          defaultScopeId: "workspace_1",
        }}
      />
    )

    expect(screen.getByRole("combobox", { name: "Entity kind" })).toHaveValue(
      "items"
    )
  })

  it("uses the searchable team-space picker in the create view dialog", async () => {
    render(
      <CreateViewDialog
        open
        onOpenChange={vi.fn()}
        dialog={{
          kind: "view",
          defaultScopeType: "workspace",
          defaultScopeId: "workspace_1",
        }}
        />
      )

    fireEvent.click(screen.getByRole("button", { name: "Acme" }))
    expect(
      await screen.findByPlaceholderText("Switch team space…")
    ).toBeInTheDocument()
  })

  it("submits the create-view dialog with Ctrl/Cmd + Enter", async () => {
    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "team",
            defaultScopeId: "team_1",
            defaultEntityKind: "items",
            defaultRoute: "/team/platform/work",
            lockScope: true,
            lockEntityKind: true,
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Platform queue" },
      })

      fireEvent.keyDown(window, {
        key: "Enter",
        ctrlKey: true,
      })

      await waitFor(() =>
        expect(createViewSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Platform queue",
          })
        )
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })

  it("submits the document create dialog with Ctrl/Cmd + Enter", async () => {
    const createDocumentSpy = vi
      .spyOn(useAppStore.getState(), "createDocument")
      .mockResolvedValue("document_1")

    try {
      render(
        <CreateDocumentDialog
          open
          onOpenChange={vi.fn()}
          input={{
            kind: "team-document",
            teamId: "team_1",
          }}
          disabled={false}
        />
      )

      fireEvent.change(screen.getByPlaceholderText("Untitled document"), {
        target: { value: "Launch plan" },
      })

      fireEvent.keyDown(window, {
        key: "Enter",
        ctrlKey: true,
      })

      await waitFor(() =>
        expect(createDocumentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Launch plan",
          })
        )
      )
    } finally {
      createDocumentSpy.mockRestore()
    }
  })

  it("hides the project selector when there are no projects in scope", () => {
    render(
      <CreateViewDialog
        open
        onOpenChange={vi.fn()}
        dialog={{
          kind: "view",
          defaultScopeType: "team",
          defaultScopeId: "team_1",
          defaultEntityKind: "items",
          defaultRoute: "/team/platform/work",
          lockScope: true,
          lockEntityKind: true,
        }}
      />
    )

    expect(screen.queryByRole("button", { name: "Project" })).not.toBeInTheDocument()
  })

  it("renders full item-view controls for project-specific views", () => {
    useAppStore.setState({
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Billing v2",
          summary: "Billing overhaul",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "high",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "PLAT-101",
          teamId: "team_1",
          type: "epic",
          title: "Ship billing work",
          descriptionDocId: "doc_1",
          status: "todo",
          priority: "high",
          assigneeId: "user_1",
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_1",
          linkedProjectIds: ["project_1"],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    })

    render(
      <CreateViewDialog
        open
        onOpenChange={vi.fn()}
        dialog={{
          kind: "view",
          defaultScopeType: "team",
          defaultScopeId: "team_1",
          defaultProjectId: "project_1",
          defaultEntityKind: "items",
          defaultRoute: "/team/platform/projects/project_1",
          lockScope: true,
          lockProject: true,
          lockEntityKind: true,
        }}
      />
    )

    expect(screen.getAllByText("Billing v2").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Level.*Epic/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Group" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Properties.*0/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Project" })).not.toBeInTheDocument()
  })

  it("renders the shared chip controls for project view creation", () => {
    render(
      <CreateViewDialog
        open
        onOpenChange={vi.fn()}
        dialog={{
          kind: "view",
          defaultScopeType: "team",
          defaultScopeId: "team_1",
          defaultEntityKind: "projects",
          defaultRoute: "/team/platform/projects",
          lockScope: true,
          lockEntityKind: true,
        }}
      />
    )

    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument()
  })

  it("limits project selection to the current team when the team scope is locked", () => {
    useAppStore.setState({
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Billing v2",
          summary: "Billing overhaul",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "high",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "project_2",
          scopeType: "team",
          scopeId: "team_2",
          templateType: "software-delivery",
          name: "Ops cutover",
          summary: "Ops readiness",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "medium",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "project_3",
          scopeType: "workspace",
          scopeId: "workspace_1",
          templateType: "software-delivery",
          name: "Workspace roadmap",
          summary: "Cross-team planning",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track",
          priority: "medium",
          status: "in-progress",
          presentation: undefined,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    })

    render(
      <CreateViewDialog
        open
        onOpenChange={vi.fn()}
        dialog={{
          kind: "view",
          defaultScopeType: "team",
          defaultScopeId: "team_1",
          defaultEntityKind: "items",
          defaultRoute: "/team/platform/work",
          lockScope: true,
          lockEntityKind: true,
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Project" }))

    expect(screen.getByRole("button", { name: "Billing v2" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Ops cutover" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Workspace roadmap" })
    ).not.toBeInTheDocument()
  })

  it("preserves workspace scope for workspace project views", async () => {
    const createViewSpy = vi
      .spyOn(useAppStore.getState(), "createView")
      .mockReturnValue("view_1")

    try {
      render(
        <CreateViewDialog
          open
          onOpenChange={vi.fn()}
          dialog={{
            kind: "view",
            defaultScopeType: "workspace",
            defaultScopeId: "workspace_1",
            defaultEntityKind: "projects",
            defaultRoute: "/workspace/projects",
          }}
        />
      )

      fireEvent.change(screen.getByPlaceholderText("View name"), {
        target: { value: "Platform projects" },
      })
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Create view" })).not.toBeDisabled()
      )

      fireEvent.click(screen.getByRole("button", { name: "Create view" }))

      expect(createViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "workspace",
          scopeId: "workspace_1",
          entityKind: "projects",
          route: "/workspace/projects",
        })
      )
    } finally {
      createViewSpy.mockRestore()
    }
  })
})
