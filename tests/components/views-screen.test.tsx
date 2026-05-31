import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"

import "@/tests/lib/fixtures/common-screen-mocks"
import {
  DocsScreen,
  ProjectsScreen,
  TeamWorkScreen,
  UserCalendarScreen,
  ViewsScreen,
} from "@/components/app/screens"
import { getDocsDialogInput } from "@/components/app/screens/docs-dialog-input"
import { DocsContent } from "@/components/app/screens/docs-content"
import { getDocumentListRowMeta } from "@/components/app/screens/document-list-row-meta"
import { buildGroupedSections } from "@/components/app/screens/grouped-sections"
import { createEmptyState } from "@/lib/domain/empty-state"
import type {
  CreateDialogState,
  Project,
  ViewDefinition,
} from "@/lib/domain/types"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestUser,
  createTestWorkItem,
  createTestWorkspaceDirectoryAppData,
} from "@/tests/lib/fixtures/app-data"

const workSurfaceMock = vi.hoisted(() => vi.fn())
const calendarViewMock = vi.hoisted(() => vi.fn())

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
  WorkSurface: (props: Record<string, unknown>) => {
    workSurfaceMock(props)
    return <div>Work surface</div>
  },
}))

vi.mock("@/components/app/screens/work-surface-view", () => ({
  CalendarView: (props: Record<string, unknown>) => {
    calendarViewMock(props)
    return (
      <div>
        <div>Calendar surface</div>
        {props.toolbarAccessory as ReactNode}
      </div>
    )
  },
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

vi.mock("@/components/app/screens/work-surface-controls", () => {
  function StatusFilterButton({
    label,
    onToggleFilterValue,
    view,
  }: {
    label: string
    onToggleFilterValue?: (key: "status", value: string) => void
    view: ViewDefinition
  }) {
    return (
      <button
        type="button"
        onClick={() => onToggleFilterValue?.("status", "in-progress")}
      >
        {`${label} filters:${view.filters.status.join(",") || "none"}`}
      </button>
    )
  }

  return {
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
      "team",
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
      <StatusFilterButton
        label="Status"
        view={view}
        onToggleFilterValue={onToggleFilterValue}
      />
    ),
    FilterPopover: ({
      onToggleFilterValue,
      view,
    }: {
      onToggleFilterValue?: (key: "status", value: string) => void
      view: ViewDefinition
    }) => (
      <StatusFilterButton
        label="Calendar"
        view={view}
        onToggleFilterValue={onToggleFilterValue}
      />
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
  }
})

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

vi.mock("@phosphor-icons/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phosphor-icons/react")>()
  const Icon = () => null
  const icons = {
    ...actual,
    Archive: Icon,
    ArrowCounterClockwise: Icon,
    ArrowSquareOut: Icon,
    Bell: Icon,
    Briefcase: Icon,
    Buildings: Icon,
    BugBeetle: Icon,
    CalendarBlank: Icon,
    CalendarDots: Icon,
    CaretDown: Icon,
    ChatCircle: Icon,
    Check: Icon,
    CheckCircle: Icon,
    Circle: Icon,
    CodesandboxLogo: Icon,
    EnvelopeSimple: Icon,
    Eye: Icon,
    FileText: Icon,
    FunnelSimple: Icon,
    Hash: Icon,
    Kanban: Icon,
    MagnifyingGlass: Icon,
    NotePencil: Icon,
    PencilSimple: Icon,
    Plus: Icon,
    Robot: Icon,
    Rows: Icon,
    SortAscending: Icon,
    SquaresFour: Icon,
    Stack: Icon,
    Tag: Icon,
    Target: Icon,
    Trash: Icon,
    TreeStructure: Icon,
    UsersThree: Icon,
    XIcon: Icon,
  }
  return icons
})

function seedState() {
  useAppStore.setState(createTestWorkspaceDirectoryAppData())
}

function createLaunchProject(overrides: Partial<Project> = {}) {
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
    ...overrides,
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

function renderWorkspaceProjectsScreen() {
  render(
    <ProjectsScreen
      scopeId="workspace_1"
      scopeType="workspace"
      title="Workspace projects"
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

  it("renders the user calendar from assigned team work and private tasks", () => {
    useAppStore.setState(
      createTestAppData({
        workItems: [
          createTestWorkItem("assigned", {
            assigneeId: "user_1",
            visibility: "team",
          }),
          createTestWorkItem("private", {
            creatorId: "user_1",
            teamId: null,
            visibility: "private",
            workspaceId: "workspace_1",
          }),
          createTestWorkItem("not-mine", {
            assigneeId: null,
            creatorId: "user_2",
            visibility: "team",
          }),
        ],
      })
    )

    render(<UserCalendarScreen />)

    expect(calendarViewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editable: true,
        items: expect.arrayContaining([
          expect.objectContaining({ id: "assigned" }),
          expect.objectContaining({ id: "private" }),
        ]),
      })
    )
    expect(
      (calendarViewMock.mock.lastCall?.[0] as { items: { id: string }[] }).items
    ).toHaveLength(2)
  })

  it("uses the shared work filter popover for the user calendar", () => {
    useAppStore.setState(
      createTestAppData({
        workItems: [
          createTestWorkItem("assigned", {
            assigneeId: "user_1",
            status: "todo",
            visibility: "team",
          }),
          createTestWorkItem("private", {
            creatorId: "user_1",
            status: "in-progress",
            teamId: null,
            visibility: "private",
            workspaceId: "workspace_1",
          }),
          createTestWorkItem("not-mine", {
            assigneeId: null,
            creatorId: "user_2",
            status: "in-progress",
            visibility: "team",
          }),
        ],
      })
    )

    render(<UserCalendarScreen />)

    fireEvent.click(
      screen.getByRole("button", { name: "Calendar filters:none" })
    )

    expect(
      (calendarViewMock.mock.lastCall?.[0] as { items: { id: string }[] }).items
    ).toEqual([expect.objectContaining({ id: "private" })])
    expect(screen.getByText("Calendar filters:in-progress")).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("button", { name: "Status filters:none" }))
    expect(
      screen.getByRole("button", {
        name: "Status filters:in-progress",
      })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Props:team,assignee,priority,updated",
      })
    )
    expect(
      screen.getByRole("button", {
        name: "Props:team,assignee,priority,updated,dueDate",
      })
    ).toBeInTheDocument()
  })

  it("keeps project preview metadata out of the secondary text row", () => {
    useAppStore.setState((state) => ({
      ...state,
      views: [],
      projects: [
        createLaunchProject({
          description: "Imported frontend audit backlog.",
          health: "no-update",
          priority: "none",
        }),
      ],
      workItems: [],
    }))

    renderTeamProjectsScreen()

    const projectLink = screen.getByRole("link", { name: /Launch/ })
    const projectPreview = within(projectLink)

    expect(projectPreview.getByText("Platform")).toBeInTheDocument()
    expect(
      projectPreview.getByText("Imported frontend audit backlog.")
    ).toBeInTheDocument()
    expect(projectPreview.queryByText(/ID project_/)).not.toBeInTheDocument()
    expect(projectPreview.queryByText("No update")).not.toBeInTheDocument()
    expect(projectPreview.queryByText("None")).not.toBeInTheDocument()
  })

  it("keeps workspace project tabs scoped to workspace project views", () => {
    useAppStore.setState((state) => ({
      ...state,
      projects: [createLaunchProject()],
    }))

    renderWorkspaceProjectsScreen()

    expect(
      screen.getByRole("button", { name: "Workspace roadmap" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Legacy workspace board" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Platform board" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Design board" })).toBeNull()
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

    expect(
      screen.getByRole("button", { name: "Layout:board" })
    ).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Layout:board" }))
    })

    expect(
      screen.getByRole("button", { name: "Layout:list" })
    ).toBeInTheDocument()
  })

  it("builds grouped sections with owned subgroup boundaries", () => {
    const items = [
      { id: "done-backend", status: "done", area: "backend" },
      { id: "todo-design", status: "todo", area: "design" },
      { id: "todo-backend", status: "todo", area: "backend" },
    ]
    const groupingConfig = {
      getGroupKey: (item: (typeof items)[number], field: string) =>
        item[field as "status" | "area"],
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
