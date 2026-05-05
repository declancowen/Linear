import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import "@/tests/lib/fixtures/common-screen-mocks"
import {
  DocsScreen,
  ProjectsScreen,
  TeamWorkScreen,
  ViewsScreen,
} from "@/components/app/screens"
import {
  getDocsDialogInput,
} from "@/components/app/screens/docs-dialog-input"
import {
  DocsContent,
} from "@/components/app/screens/docs-content"
import { getDocumentListRowMeta } from "@/components/app/screens/document-list-row-meta"
import { buildGroupedSections } from "@/components/app/screens/grouped-sections"
import { createEmptyState } from "@/lib/domain/empty-state"
import type { CreateDialogState, ViewDefinition } from "@/lib/domain/types"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestUser,
  createTestWorkspaceDirectoryAppData,
} from "@/tests/lib/fixtures/app-data"

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
  ViewsDisplaySettingsPopover: () => (
    <button type="button">Display settings</button>
  ),
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

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: () => ({
    hasLoadedOnce: true,
  }),
}))

vi.mock("@/components/app/screens/create-document-dialog", () => ({
  CreateDocumentDialog: () => null,
}))

vi.mock("@/components/app/screens/document-ui", () => ({
  DocumentContextMenu: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DocumentAuthorAvatar: () => null,
}))

vi.mock("@/components/app/screens/work-surface-controls", () => ({
  GroupChipPopover: ({
    onUpdateView,
    view,
  }: {
    onUpdateView?: (patch: { grouping?: string }) => void
    view: ViewDefinition
  }) => (
    <button
      type="button"
      onClick={() =>
        onUpdateView?.({
          grouping: view.grouping === "status" ? "priority" : "status",
        })
      }
    >
      {`Group:${view.grouping}`}
    </button>
  ),
  PROJECT_DISPLAY_PROPERTY_OPTIONS: [
    "id",
    "status",
    "assignee",
    "priority",
    "updated",
    "dueDate",
  ],
  PROJECT_GROUP_OPTIONS: ["status", "priority"],
  ProjectFilterPopover: ({
    onToggleFilterValue,
    view,
  }: {
    onToggleFilterValue?: (key: "status", value: string) => void
    view: ViewDefinition
  }) => (
    <button
      type="button"
      onClick={() => onToggleFilterValue?.("status", "in-progress")}
    >
      {`Status filters:${view.filters.status.join(",") || "none"}`}
    </button>
  ),
  ProjectLayoutTabs: ({
    onUpdateView,
    view,
  }: {
    onUpdateView?: (patch: { layout?: "list" | "board" }) => void
    view: ViewDefinition
  }) => (
    <button
      type="button"
      onClick={() => {
        const layout = view.layout === "list" ? "board" : "list"

        if (onUpdateView) {
          onUpdateView({ layout })
          return
        }

        useAppStore.getState().updateViewConfig(view.id, { layout })
      }}
    >
      {`Layout:${view.layout}`}
    </button>
  ),
  ProjectSortChipPopover: ({
    onUpdateView,
    view,
  }: {
    onUpdateView?: (patch: { ordering?: string }) => void
    view: ViewDefinition
  }) => (
    <button
      type="button"
      onClick={() =>
        onUpdateView?.({
          ordering: view.ordering === "priority" ? "updatedAt" : "priority",
        })
      }
    >
      {`Sort:${view.ordering}`}
    </button>
  ),
  PropertiesChipPopover: ({
    onToggleDisplayProperty,
    view,
  }: {
    onToggleDisplayProperty?: (property: "dueDate") => void
    view: ViewDefinition
  }) => (
    <button
      type="button"
      onClick={() => onToggleDisplayProperty?.("dueDate")}
    >
      {`Props:${view.displayProps.join(",")}`}
    </button>
  ),
  getGroupFieldOptionLabel: (value: string) => value,
}))

vi.mock("@/components/app/screens/directory-controls", () => ({
  ViewsDirectoryFilterPopover: () => null,
  ViewsDirectoryGroupChipPopover: () => null,
  ViewsDirectoryLayoutTabs: () => <button type="button">Layout</button>,
  ViewsDirectoryPropertiesChipPopover: () => null,
  ViewsDirectorySortChipPopover: () => null,
}))

vi.mock("@/components/ui/template-primitives", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createTemplatePrimitivesStubModule()
)

vi.mock("@phosphor-icons/react", () => ({
  Archive: () => null,
  ArrowCounterClockwise: () => null,
  CalendarDots: () => null,
  ArrowSquareOut: () => null,
  Bell: () => null,
  Briefcase: () => null,
  Buildings: () => null,
  BugBeetle: () => null,
  ChatCircle: () => null,
  CheckCircle: () => null,
  Circle: () => null,
  FunnelSimple: () => null,
  FileText: () => null,
  Hash: () => null,
  EnvelopeSimple: () => null,
  CodesandboxLogo: () => null,
  NotePencil: () => null,
  PencilSimple: () => null,
  Plus: () => null,
  Kanban: () => null,
  Rows: () => null,
  Robot: () => null,
  SortAscending: () => null,
  Stack: () => null,
  Eye: () => null,
  CaretDown: () => null,
  Check: () => null,
  MagnifyingGlass: () => null,
  SquaresFour: () => null,
  Tag: () => null,
  Target: () => null,
  Trash: () => null,
  UsersThree: () => null,
}))

function seedState() {
  useAppStore.setState(createTestWorkspaceDirectoryAppData())
}

function createLaunchProject() {
  return createTestProject({
    id: "project_1",
    scopeType: "team",
    scopeId: "team_1",
    templateType: "software-delivery",
    name: "Launch",
    status: "in-progress",
    createdAt: "2026-04-18T09:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    presentation: undefined,
  })
}

function renderTeamProjectsScreen() {
  render(
    <ProjectsScreen
      scopeId="team_1"
      scopeType="team"
      team={useAppStore.getState().teams[0]}
      title="Projects"
    />
  )
}

describe("ViewsScreen", () => {
  beforeEach(() => {
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
    vi.clearAllMocks()
  })

  it("renders team work and docs screens through scoped screen owners", () => {
    render(<TeamWorkScreen teamSlug="platform" />)
    expect(screen.getByText("Work surface")).toBeInTheDocument()

    useAppStore.setState(
      createTestAppData({
        documents: [
          createTestDocument({
            id: "doc_screen",
            title: "Screen document",
          }),
        ],
      })
    )

    render(
      <DocsScreen
        scopeId="team_1"
        scopeType="team"
        team={useAppStore.getState().teams[0]}
        title="Docs"
      />
    )

    expect(screen.getByText("Docs")).toBeInTheDocument()
    expect(screen.getByText("Screen document")).toBeInTheDocument()
  })

  it("renders docs content loading, empty, list, and board states", () => {
    const data = createTestAppData()

    const { rerender } = render(
      <DocsContent
        data={data}
        documents={[]}
        emptyTitle="No documents"
        hasLoadedOnce={false}
        layout="list"
      />
    )

    expect(screen.getByText("Loading documents...")).toBeInTheDocument()

    rerender(
      <DocsContent
        data={data}
        documents={[]}
        emptyTitle="No documents"
        hasLoadedOnce
        layout="list"
      />
    )
    expect(screen.getByText("No documents")).toBeInTheDocument()

    rerender(
      <DocsContent
        data={data}
        documents={[createTestDocument({ title: "Specs" })]}
        emptyTitle="No documents"
        hasLoadedOnce
        layout="board"
      />
    )
    expect(screen.getByText("Document board")).toBeInTheDocument()
  })

  it("shows workspace and accessible team views together with their real scope labels", () => {
    render(
      <ViewsScreen
        scopeId="workspace_1"
        scopeType="workspace"
        title="Workspace views"
      />
    )

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
    const firstDialog = vi.mocked(openManagedCreateDialog).mock
      .calls[0]?.[0] as Extract<CreateDialogState, { kind: "view" }> | undefined
    expect(firstDialog?.lockScope).toBeUndefined()
  })

  it("keeps fallback project view controls local when no saved project view exists", () => {
    useAppStore.setState((state) => ({
      ...state,
      views: [],
      projects: [createLaunchProject()],
    }))

    renderTeamProjectsScreen()

    fireEvent.click(screen.getByRole("button", { name: "Layout:list" }))
    expect(
      screen.getByRole("button", { name: "Layout:board" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Group:status" }))
    expect(
      screen.getByRole("button", { name: "Group:priority" })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Status filters:none" })
    )
    expect(
      screen.getByRole("button", {
        name: "Status filters:in-progress",
      })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Props:id,status,assignee,priority,updated",
      })
    )
    expect(
      screen.getByRole("button", {
        name: "Props:id,status,assignee,priority,updated,dueDate",
      })
    ).toBeInTheDocument()
  })

  it("renders and updates saved project layouts from the active saved view", () => {
    useAppStore.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        selectedViewByRoute: {
          ...state.ui.selectedViewByRoute,
          [getViewerScopedDirectoryKey(
            state.currentUserId,
            "/team/platform/projects"
          )]: "team-view",
        },
      },
      views: state.views.map((view) =>
        view.id === "team-view" ? { ...view, layout: "board" } : view
      ),
      projects: [createLaunchProject()],
    }))

    renderTeamProjectsScreen()

    expect(screen.getByRole("button", { name: "Layout:board" })).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Layout:board" }))
    })

    expect(screen.getByRole("button", { name: "Layout:list" })).toBeInTheDocument()
  })

  it("builds grouped sections with owned subgroup boundaries", () => {
    const items = [
      { id: "done-backend", status: "done", area: "backend" },
      { id: "todo-design", status: "todo", area: "design" },
      { id: "todo-backend", status: "todo", area: "backend" },
    ]
    const groupingConfig = {
      getGroupKey: (
        item: (typeof items)[number],
        field: string
      ) => item[field as "status" | "area"],
      getGroupLabel: (field: string, key: string) => `${field}:${key}`,
      compareGroupKeys: (_field: string, left: string, right: string) =>
        left.localeCompare(right),
    }

    expect(
      buildGroupedSections({
        items,
        grouping: "none",
        subGrouping: "area",
        ...groupingConfig,
      })
    ).toEqual([
      {
        key: "all",
        label: "All",
        items,
        children: null,
      },
    ])

    const grouped = buildGroupedSections({
      items,
      grouping: "status",
      subGrouping: "area",
      ...groupingConfig,
    })

    expect(grouped).toEqual([
      {
        key: "done",
        label: "status:done",
        items: [items[0]],
        children: [
          {
            key: "done:backend",
            label: "area:backend",
            items: [items[0]],
            children: null,
          },
        ],
      },
      {
        key: "todo",
        label: "status:todo",
        items: [items[1], items[2]],
        children: [
          {
            key: "todo:backend",
            label: "area:backend",
            items: [items[2]],
            children: null,
          },
          {
            key: "todo:design",
            label: "area:design",
            items: [items[1]],
            children: null,
          },
        ],
      },
    ])

    expect(
      buildGroupedSections({
        items,
        grouping: "status",
        subGrouping: "status",
        ...groupingConfig,
      })[0]?.children
    ).toBeNull()
  })

  it("chooses the document dialog owner from the active docs scope", () => {
    expect(
      getDocsDialogInput({
        activeTab: "workspace",
        activeTeamId: "team_1",
        isWorkspaceDocs: true,
        scopeId: "workspace_1",
      })
    ).toEqual({ kind: "workspace-document", workspaceId: "workspace_1" })
    expect(
      getDocsDialogInput({
        activeTab: "private",
        activeTeamId: "team_1",
        isWorkspaceDocs: true,
        scopeId: "workspace_1",
      })
    ).toEqual({ kind: "private-document", workspaceId: "workspace_1" })
    expect(
      getDocsDialogInput({
        activeTab: "workspace",
        activeTeamId: "active_team",
        isWorkspaceDocs: false,
        scopeId: "team_1",
        team: createTestTeam({ id: "team_2" }),
      })
    ).toEqual({ kind: "team-document", teamId: "team_2" })
    expect(
      getDocsDialogInput({
        activeTab: "workspace",
        activeTeamId: "active_team",
        isWorkspaceDocs: false,
        scopeId: "team_1",
        team: null,
      })
    ).toEqual({ kind: "team-document", teamId: "active_team" })
  })

  it("derives document list metadata from the document author fallback chain", () => {
    const data = createTestAppData({
      users: [
        createTestUser({
          id: "creator",
          name: "Creator",
          avatarImageUrl: "https://example.com/creator.png",
        }),
        createTestUser({
          id: "updater",
          name: "Updater",
          avatarUrl: "https://example.com/updater.svg",
        }),
      ],
    })

    expect(
      getDocumentListRowMeta(
        data,
        createTestDocument({
          createdBy: "creator",
          updatedBy: "updater",
          updatedAt: "2026-05-05T09:00:00.000Z",
        })
      )
    ).toMatchObject({
      authorAvatarUrl: "https://example.com/updater.svg",
      authorName: "Updater",
      preview: "",
      updated: "May 5",
    })

    expect(
      getDocumentListRowMeta(
        data,
        createTestDocument({
          createdBy: "missing",
          updatedBy: undefined,
        })
      ).authorName
    ).toBe("Unknown")
  })
})
