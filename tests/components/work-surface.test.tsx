import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const {
  filterPopoverMock,
  getVisibleItemsForViewMock,
  propertiesPopoverMock,
  searchParamsState,
} = vi.hoisted(() => ({
  filterPopoverMock: vi.fn(() => null),
  getVisibleItemsForViewMock: vi.fn((_: unknown, items: unknown[]) => items),
  propertiesPopoverMock: vi.fn(() => null),
  searchParamsState: {
    value: "",
  },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}))

vi.mock("@/lib/browser/dialog-transitions", () => ({
  openManagedCreateDialog: vi.fn(),
}))

vi.mock("@/lib/domain/selectors", () => ({
  canEditTeam: () => true,
  canEditWorkspace: () => true,
  getUser: () => null,
  getVisibleItemsForView: getVisibleItemsForViewMock,
  getViewByRoute: (
    data: { views: Array<{ route: string }> },
    routeKey: string
  ) => data.views.find((view) => view.route === routeKey) ?? null,
}))

vi.mock("@/components/ui/button", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createButtonStubModule()
)

vi.mock("@/components/ui/template-primitives", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createTemplatePrimitivesStubModule()
)

vi.mock("@/components/app/screens/shared", () => ({
  HeaderTitle: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock("@/components/app/screens/entity-context-menus", () => ({
  ViewContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/app/screens/work-surface-controls", () => ({
  FilterPopover: filterPopoverMock,
  getAvailableGroupOptions: () => ["status"],
  GroupChipPopover: () => null,
  LayoutTabs: () => null,
  LevelChipPopover: ({ showLabel }: { showLabel?: boolean }) => (
    <div>{showLabel === false ? "level:value-only" : "level:label"}</div>
  ),
  PropertiesChipPopover: propertiesPopoverMock,
  SortChipPopover: () => null,
  ViewConfigPopover: () => null,
}))

vi.mock("@/components/app/screens/work-surface-view", () => ({
  BoardView: ({
    view,
  }: {
    view: { grouping: string; subGrouping: string | null }
  }) => (
    <div>
      <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>
      <div>board-content</div>
    </div>
  ),
  getWorkSurfaceCreateDefaultsFromView: ({
    createContext,
    view,
  }: {
    createContext?: {
      defaultProjectId?: string | null
      defaultTeamId?: string | null
      defaultVisibility?: "private" | "team"
    }
    view: ViewDefinition
  }) => {
    const labelId =
      view.filters.labelIds.length === 1 ? view.filters.labelIds[0] : undefined
    const projectId =
      view.filters.projectIds.length === 1
        ? view.filters.projectIds[0]
        : createContext?.defaultProjectId
    const teamId =
      view.filters.teamIds.length === 1
        ? view.filters.teamIds[0]
        : createContext?.defaultTeamId
    const itemType =
      view.filters.itemTypes.length === 1 ? view.filters.itemTypes[0] : null
    const visibility =
      view.filters.visibility?.length === 1
        ? view.filters.visibility[0]
        : createContext?.defaultVisibility

    return {
      defaultProjectId: visibility === "private" ? null : projectId,
      defaultTeamId: teamId,
      initialType: itemType ?? (visibility === "private" ? "task" : null),
      defaultValues: {
        ...(view.filters.status.length === 1
          ? { status: view.filters.status[0] }
          : {}),
        ...(projectId && visibility !== "private"
          ? { primaryProjectId: projectId }
          : {}),
        ...(labelId && visibility !== "private" ? { labelIds: [labelId] } : {}),
        ...(visibility ? { visibility } : {}),
      },
    }
  },
  ListView: ({
    view,
  }: {
    view: { grouping: string; subGrouping: string | null }
  }) => <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>,
  TimelineView: ({
    view,
  }: {
    view: { grouping: string; subGrouping: string | null }
  }) => <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>,
}))

vi.mock("@phosphor-icons/react", () => ({
  ArrowCounterClockwise: () => null,
  CalendarBlank: () => null,
  ChartBarHorizontal: () => null,
  Plus: () => null,
}))

import { WorkSurface } from "@/components/app/screens/work-surface"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultViewFilters,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type Team,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

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
    layout: "list",
    filters: createDefaultViewFilters(),
    grouping: "epic",
    subGrouping: "feature",
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

function createAssignedFallbackViews() {
  return [
    createView({
      id: "view_assigned_all_items",
      name: "All work",
      scopeType: "personal",
      scopeId: "user_1",
      route: "/assigned",
      grouping: "status",
      subGrouping: null,
    }),
    createView({
      id: "view_assigned_active_items",
      name: "Active",
      scopeType: "personal",
      scopeId: "user_1",
      route: "/assigned",
      layout: "board",
      grouping: "status",
      subGrouping: null,
    }),
  ]
}

function renderAssignedFallbackSurface() {
  render(
    <WorkSurface
      title="My items"
      routeKey="/assigned"
      views={[]}
      fallbackViews={createAssignedFallbackViews()}
      items={[]}
      team={createTeam()}
      emptyLabel="Nothing assigned"
      allowCreateViews={false}
    />
  )
}

describe("WorkSurface", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      ui: {
        ...createEmptyState().ui,
        activeTeamId: "team_1",
      },
      views: [createView()],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    searchParamsState.value = ""
    filterPopoverMock.mockClear()
    getVisibleItemsForViewMock.mockClear()
    propertiesPopoverMock.mockClear()
    vi.clearAllMocks()
  })

  it("applies incompatible grouping fallbacks locally without persisting the saved view", () => {
    const updateViewConfigSpy = vi.spyOn(
      useAppStore.getState(),
      "updateViewConfig"
    )

    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={useAppStore.getState().views}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
      />
    )

    expect(screen.getByText("group:status/sub:none")).toBeInTheDocument()
    expect(screen.getByText("level:label")).toBeInTheDocument()
    expect(updateViewConfigSpy).not.toHaveBeenCalled()

    updateViewConfigSpy.mockRestore()
  })

  it("does not render a duplicate surface-level empty state below empty board content", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      views: [
        createView({
          layout: "board",
          grouping: "status",
          subGrouping: null,
        }),
      ],
    })

    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={useAppStore.getState().views}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
      />
    )

    expect(screen.getByText("board-content")).toBeInTheDocument()
    expect(screen.queryByText("No work")).not.toBeInTheDocument()
  })

  it("renders team work without fallback views", () => {
    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={useAppStore.getState().views}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
      />
    )

    expect(screen.getByRole("button", { name: "All work" })).toBeInTheDocument()
    expect(screen.getByText("group:status/sub:none")).toBeInTheDocument()
  })

  it("opens top-level creates with single-value active view defaults", () => {
    const view = createView({
      filters: {
        ...createDefaultViewFilters(),
        status: ["todo"],
        projectIds: ["project_1"],
        teamIds: ["team_1"],
        itemTypes: ["task"],
        labelIds: ["label_cx"],
      },
      grouping: "status",
      subGrouping: null,
    })

    useAppStore.setState({
      ...useAppStore.getState(),
      views: [view],
    })

    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={[view]}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "New" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProjectId: "project_1",
        defaultTeamId: "team_1",
        initialType: "task",
        defaultValues: expect.objectContaining({
          labelIds: ["label_cx"],
          primaryProjectId: "project_1",
          status: "todo",
        }),
      })
    )
  })

  it("does not treat ambiguous visibility filters as private create defaults", () => {
    const view = createView({
      filters: {
        ...createDefaultViewFilters(),
        projectIds: ["project_1"],
        teamIds: ["team_1"],
        labelIds: ["label_cx"],
        visibility: ["team", "private"],
      },
      grouping: "status",
      subGrouping: null,
    })

    useAppStore.setState({
      ...useAppStore.getState(),
      views: [view],
    })

    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={[view]}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "New" }))

    const dialog = vi.mocked(openManagedCreateDialog).mock.calls[0]?.[0]

    expect(dialog).toEqual(
      expect.objectContaining({
        defaultProjectId: "project_1",
        defaultTeamId: "team_1",
        defaultValues: expect.objectContaining({
          labelIds: ["label_cx"],
          primaryProjectId: "project_1",
        }),
      })
    )
    expect(dialog?.kind === "workItem" && dialog.defaultValues?.visibility).toBe(
      undefined
    )
  })

  it("renders fallback views when no saved views exist", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      views: [],
    })

    renderAssignedFallbackSurface()

    expect(screen.getByRole("button", { name: "All work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Active" }))

    expect(screen.getByText("board-content")).toBeInTheDocument()
  })

  it("does not coerce private task views away from their saved layout", () => {
    render(
      <WorkSurface
        title="My items"
        routeKey="/assigned"
        views={[]}
        fallbackViews={[
          createView({
            id: "view_assigned_private_tasks",
            name: "Private tasks",
            scopeType: "personal",
            scopeId: "user_1",
            route: "/assigned",
            layout: "list",
            grouping: "status",
            subGrouping: null,
            filters: {
              ...createDefaultViewFilters(),
              visibility: ["private"],
            },
          }),
        ]}
        items={[]}
        team={createTeam()}
        emptyLabel="Nothing assigned"
        allowCreateViews={false}
      />
    )

    expect(screen.queryByText("board-content")).not.toBeInTheDocument()
    expect(screen.getByText("group:status/sub:none")).toBeInTheDocument()
  })

  it("ignores stale assignment filters on private task views", () => {
    const privateItem = {
      id: "private_task_1",
      assigneeId: null,
      creatorId: "user_1",
      visibility: "private",
    }

    render(
      <WorkSurface
        title="My items"
        routeKey="/assigned"
        views={[]}
        fallbackViews={[
          createView({
            id: "view_assigned_private_tasks",
            name: "Private tasks",
            scopeType: "personal",
            scopeId: "user_1",
            route: "/assigned",
            grouping: "status",
            subGrouping: null,
            filters: {
              ...createDefaultViewFilters(),
              assigneeIds: ["user_1"],
              creatorIds: ["user_2"],
              projectIds: ["project_1"],
              teamIds: ["team_1"],
              visibility: ["private"],
            },
          }),
        ]}
        items={[privateItem] as never[]}
        filterItems={[privateItem] as never[]}
        team={createTeam()}
        emptyLabel="Nothing assigned"
        allowCreateViews={false}
      />
    )

    expect(getVisibleItemsForViewMock).toHaveBeenCalledWith(
      expect.anything(),
      [privateItem],
      expect.objectContaining({
        filters: expect.objectContaining({
          assigneeIds: [],
          creatorIds: [],
          projectIds: [],
          teamIds: [],
          visibility: ["private"],
        }),
      }),
      {}
    )
  })

  it("matches assigned descendant filters against the assigned rows", () => {
    const assignedItem = {
      id: "story_1",
      parentId: "epic_1",
    }
    const displayItem = {
      id: "epic_1",
      parentId: null,
    }

    render(
      <WorkSurface
        title="My items"
        routeKey="/assigned"
        views={[]}
        fallbackViews={[
          createView({
            id: "view_assigned_all_items",
            scopeType: "personal",
            scopeId: "user_1",
            route: "/assigned",
            showChildItems: true,
          }),
        ]}
        items={[displayItem] as never[]}
        filterItems={[assignedItem] as never[]}
        team={createTeam()}
        emptyLabel="Nothing assigned"
        childDisplayMode="assigned-descendants"
        allowCreateViews={false}
      />
    )

    expect(getVisibleItemsForViewMock).toHaveBeenCalledWith(
      expect.anything(),
      [displayItem],
      expect.objectContaining({
        id: "view_assigned_all_items",
      }),
      {
        matchItems: [assignedItem],
        childDisplayMode: "assigned-descendants",
      }
    )
    expect(filterPopoverMock).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [displayItem],
        view: expect.objectContaining({
          id: "view_assigned_all_items",
        }),
      }),
      undefined
    )
  })

  it("does not snap fallback tab selection back to the URL view after local edits", () => {
    searchParamsState.value = "view=view_assigned_active_items"

    renderAssignedFallbackSurface()

    expect(screen.getByText("board-content")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "All work" }))

    expect(screen.queryByText("board-content")).not.toBeInTheDocument()

    const filterPopoverCalls = filterPopoverMock.mock.calls as unknown[][]
    const filterPopoverProps = filterPopoverCalls.at(-1)?.[0] as
      | {
          onToggleFilterValue?: (key: string, value: string) => void
        }
      | undefined

    expect(filterPopoverProps?.onToggleFilterValue).toBeTruthy()

    act(() => {
      filterPopoverProps?.onToggleFilterValue?.("status", "todo")
    })

    expect(screen.queryByText("board-content")).not.toBeInTheDocument()
  })

  it("preserves fallback view defaults when applying local viewbar changes", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      views: [],
    })

    renderAssignedFallbackSurface()

    const initialFilterProps = (filterPopoverMock.mock.calls as unknown[][]).at(
      -1
    )?.[0] as
      | {
          view: ViewDefinition
          onToggleFilterValue?: (key: string, value: string) => void
        }
      | undefined

    expect(initialFilterProps?.view.displayProps).toEqual(["id", "status"])

    act(() => {
      initialFilterProps?.onToggleFilterValue?.("status", "todo")
    })

    const updatedFilterProps = (filterPopoverMock.mock.calls as unknown[][]).at(
      -1
    )?.[0] as
      | {
          view: ViewDefinition
        }
      | undefined

    expect(updatedFilterProps?.view.filters.status).toEqual(["todo"])
    expect(updatedFilterProps?.view.displayProps).toEqual(["id", "status"])

    const propertyProps = (propertiesPopoverMock.mock.calls as unknown[][]).at(
      -1
    )?.[0] as
      | {
          onToggleDisplayProperty?: (
            property: ViewDefinition["displayProps"][number]
          ) => void
        }
      | undefined

    act(() => {
      propertyProps?.onToggleDisplayProperty?.("priority")
    })

    const latestFilterProps = (filterPopoverMock.mock.calls as unknown[][]).at(
      -1
    )?.[0] as
      | {
          view: ViewDefinition
        }
      | undefined

    expect(latestFilterProps?.view.filters.status).toEqual(["todo"])
    expect(latestFilterProps?.view.displayProps).toEqual([
      "id",
      "status",
      "priority",
    ])
    expect(useAppStore.getState().ui.viewerViewConfigByRoute).toEqual({})
  })

  it("renders a loading state instead of the empty label while scoped data is hydrating", () => {
    render(
      <WorkSurface
        title="Work"
        routeKey="/team/platform/work"
        views={useAppStore.getState().views}
        items={[]}
        team={createTeam()}
        emptyLabel="No work"
        isLoading
        loadingLabel="Loading work..."
      />
    )

    expect(screen.getByText("Loading work...")).toBeInTheDocument()
    expect(screen.queryByText("No work")).not.toBeInTheDocument()
  })
})
