import type { ButtonHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/browser/dialog-transitions", () => ({
  openManagedCreateDialog: vi.fn(),
}))

vi.mock("@/lib/domain/selectors", () => ({
  canEditTeam: () => true,
  getVisibleItemsForView: (_data: unknown, items: unknown[]) => items,
  getViewByRoute: (data: { views: Array<{ route: string }> }, routeKey: string) =>
    data.views.find((view) => view.route === routeKey) ?? null,
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
  FilterPopover: () => null,
  getAvailableGroupOptions: () => ["status"],
  GroupChipPopover: () => null,
  LayoutTabs: () => null,
  LevelChipPopover: () => null,
  PropertiesChipPopover: () => null,
  SortChipPopover: () => null,
  ViewConfigPopover: () => null,
}))

vi.mock("@/components/app/screens/work-surface-view", () => ({
  BoardView: ({
    view,
    items,
  }: {
    view: { grouping: string; subGrouping: string | null }
    items: unknown[]
  }) => (
    <div>
      <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>
      {items.length === 0 ? <div>Drop here</div> : null}
    </div>
  ),
  ListView: ({ view }: { view: { grouping: string; subGrouping: string | null } }) => (
    <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>
  ),
  TimelineView: ({ view }: { view: { grouping: string; subGrouping: string | null } }) => (
    <div>{`group:${view.grouping}/sub:${view.subGrouping ?? "none"}`}</div>
  ),
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
    vi.clearAllMocks()
  })

  it("applies incompatible grouping fallbacks locally without persisting the saved view", () => {
    const updateViewConfigSpy = vi.spyOn(useAppStore.getState(), "updateViewConfig")

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

    expect(screen.getByText("Drop here")).toBeInTheDocument()
    expect(screen.queryByText("No work")).not.toBeInTheDocument()
  })
})
