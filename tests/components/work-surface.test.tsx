import type { ButtonHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const { filterPopoverMock, getVisibleItemsForViewMock, searchParamsState } =
  vi.hoisted(() => ({
  filterPopoverMock: vi.fn(() => null),
  getVisibleItemsForViewMock: vi.fn((_: unknown, items: unknown[]) => items),
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
  getVisibleItemsForView: getVisibleItemsForViewMock,
  getViewByRoute: (
    data: { views: Array<{ route: string }> },
    routeKey: string
  ) => data.views.find((view) => view.route === routeKey) ?? null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/template-primitives", () => ({
  IconButton: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Topbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Viewbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

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
  PropertiesChipPopover: () => null,
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
  Plus: () => null,
}))

import { WorkSurface } from "@/components/app/screens/work-surface"
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

  it("renders fallback views when no saved views exist", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      views: [],
    })

    render(
      <WorkSurface
        title="My items"
        routeKey="/assigned"
        views={[]}
        fallbackViews={[
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
        ]}
        items={[]}
        team={createTeam()}
        emptyLabel="Nothing assigned"
        allowCreateViews={false}
      />
    )

    expect(screen.getByRole("button", { name: "All work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Active" }))

    expect(screen.getByText("board-content")).toBeInTheDocument()
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

    render(
      <WorkSurface
        title="My items"
        routeKey="/assigned"
        views={[]}
        fallbackViews={[
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
        ]}
        items={[]}
        team={createTeam()}
        emptyLabel="Nothing assigned"
        allowCreateViews={false}
      />
    )

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
})
