import type { ReactNode } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { addDays, addMonths, format, startOfDay } from "date-fns"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createNextLinkStubModule()
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  ScrollBar: () => null,
}))

vi.mock("@/components/app/screens/work-item-menus", () => ({
  IssueActionMenu: ({
    item,
    triggerClassName,
  }: {
    item: { id: string }
    triggerClassName?: string
  }) => (
    <button
      type="button"
      data-testid={`issue-action-${item.id}`}
      className={triggerClassName}
      aria-label={`Actions for ${item.id}`}
    />
  ),
  IssueContextMenu: ({
    children,
    displayProps,
    item,
    onEditItem,
    targetItems,
  }: {
    children: ReactNode
    displayProps?: string[]
    item: { id: string }
    onEditItem?: (itemId: string) => void
    targetItems?: Array<{ id: string }>
  }) => (
    <>
      {children}
      <span
        data-testid={`issue-context-${item.id}`}
        data-display-props={displayProps?.join(",") ?? ""}
      />
      <span data-testid={`issue-context-targets-${item.id}`}>
        {targetItems?.map((target) => target.id).join(",") ?? item.id}
      </span>
      {onEditItem ? (
        <button
          type="button"
          data-testid={`issue-context-edit-${item.id}`}
          onClick={(event) => {
            event.stopPropagation()
            onEditItem(item.id)
          }}
        >
          Edit item
        </button>
      ) : null}
    </>
  ),
  stopMenuEvent: (event: {
    preventDefault?: () => void
    stopPropagation?: () => void
  }) => {
    event.preventDefault?.()
    event.stopPropagation?.()
  },
  stopDragPropagation: (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.()
  },
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  WorkItemAssigneeAvatar: () => <span>Assignee</span>,
  WorkItemTypeBadge: () => <span>Type</span>,
}))

vi.mock("@/components/ui/template-primitives", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/template-primitives")>()

  return {
    ...actual,
    StatusRing: ({ status }: { status: string }) => <span>{status}</span>,
  }
})

vi.mock("@/lib/browser/dialog-transitions", () => ({
  openManagedCreateDialog: vi.fn(),
}))

vi.mock("@/components/app/screens/work-item-detail-screen", () => ({
  WorkItemDetailSidebarSurface: ({
    currentItem,
    editable,
    floatingMaxHeight,
    headerClassName,
    onClose,
    variant = "docked",
  }: {
    currentItem: { title: string }
    editable?: boolean
    floatingMaxHeight?: number
    headerClassName?: string
    onClose?: () => void
    variant?: "docked" | "floating" | "inline"
  }) => (
    <div
      data-testid={`${variant}-detail`}
      data-editable={String(Boolean(editable))}
      data-floating-max-height={floatingMaxHeight}
      data-header-class-name={headerClassName}
    >
      <button type="button" onClick={onClose}>
        Close detail
      </button>
      <span>{currentItem.title}</span>
    </div>
  ),
}))

import {
  BoardView,
  CalendarSettingsButton,
  CalendarView,
  ListView,
  TimelineView,
} from "@/components/app/screens/work-surface-view"
import {
  getCalendarNavigationAnchorDate,
  getCalendarWeekendVisibilityAnchorDate,
} from "@/components/app/screens/work-surface-view/calendar-view"
import { BoardChildItemRow } from "@/components/app/screens/work-surface-view/board-child-item-row"
import { WorkItemSelectionCheckbox } from "@/components/app/screens/work-item-selection"
import { requestWorkSurfaceDragUpdate } from "@/components/app/screens/work-surface-view/drag-state"
import {
  TimelineBar,
  TimelineLabelRow,
} from "@/components/app/screens/work-surface-view/timeline-bars"
import { getTimelineMovePatchForDrag } from "@/components/app/screens/work-surface-view/timeline-state"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { createEmptyState } from "@/lib/domain/empty-state"
import { formatLocalCalendarDate } from "@/lib/calendar-date"
import { useAppStore } from "@/lib/store/app-store"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  createDefaultViewFilters,
  type AppData,
  type DisplayProperty,
  type Team,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"

function createTeam(overrides?: Partial<Team>): Team {
  const baseSettings: Team["settings"] = {
    joinCode: "JOIN1234",
    summary: "",
    guestProjectIds: [],
    guestDocumentIds: [],
    guestWorkItemIds: [],
    experience: "software-development",
    features: createDefaultTeamFeatureSettings("software-development"),
    workflow: createDefaultTeamWorkflowSettings("software-development"),
  }

  return {
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "platform",
    name: "Platform",
    icon: "rocket",
    ...overrides,
    settings: {
      ...baseSettings,
      ...overrides?.settings,
    },
  }
}

function createView(
  layout: ViewDefinition["layout"] = "list",
  displayProps: DisplayProperty[] = [],
  overrides?: Partial<ViewDefinition>
): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    itemLevel: null,
    showChildItems: false,
    layout,
    filters: createDefaultViewFilters(),
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    displayProps,
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

function clickAddItem() {
  fireEvent.click(screen.getByRole("button", { name: "Add item" }))
}

function clickTimelineBarAfterPointerRelease(
  target: Element,
  options: {
    pointerId?: number
    releaseTarget?: Element | Window
  } = {}
) {
  const pointerOptions = {
    clientX: 0,
    clientY: 0,
    ...(options.pointerId ? { pointerId: options.pointerId } : {}),
  }

  fireEvent.pointerDown(target, pointerOptions)
  fireEvent.pointerUp(options.releaseTarget ?? target, pointerOptions)
  fireEvent.click(target, { clientX: 0, clientY: 0 })
}

function expectEmptyOptionalPillsHidden() {
  expect(
    screen.queryByRole("button", { name: "Assignee" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Project" })
  ).not.toBeInTheDocument()
}

function expectCreateDialogDefaults({
  defaultTeamId = "team_1",
  initialType,
  parentId,
}: {
  defaultTeamId?: string
  initialType?: WorkItem["type"]
  parentId: string
}) {
  expect(openManagedCreateDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultTeamId,
      ...(initialType ? { initialType } : {}),
      defaultValues: expect.objectContaining({
        parentId,
      }),
    })
  )
}

function expectPrivateCreateDialogDefaults() {
  expect(openManagedCreateDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultTeamId: "team_1",
      defaultProjectId: null,
      defaultValues: expect.objectContaining({
        assigneeId: null,
        primaryProjectId: null,
        status: "backlog",
        visibility: "private",
      }),
    })
  )
}

function expectBoardAndListCreateDefaults({
  data,
  expected,
  items,
  view,
}: {
  data: AppData
  expected: Parameters<typeof expectCreateDialogDefaults>[0]
  items: WorkItem[]
  view: ViewDefinition
}) {
  const { rerender } = render(
    <BoardView data={data} items={items} view={view} editable />
  )

  clickAddItem()
  expectCreateDialogDefaults(expected)
  vi.mocked(openManagedCreateDialog).mockClear()

  rerender(
    <ListView
      data={data}
      items={items}
      view={{ ...view, layout: "list" }}
      editable
    />
  )

  clickAddItem()
  expectCreateDialogDefaults(expected)
}

function createWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "item_1",
    key: "TES-1",
    teamId: "team_1",
    type: "issue",
    title: "Ship it",
    descriptionDocId: "",
    status: "done",
    priority: "medium",
    assigneeId: null,
    creatorId: "user_1",
    parentId: null,
    primaryProjectId: null,
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
    ...overrides,
  }
}

function createDragEndEvent(activeId: string, overId: string) {
  return {
    active: { id: activeId },
    over: { id: overId },
  } as Parameters<typeof requestWorkSurfaceDragUpdate>[0]["event"]
}

function createData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [createWorkItem()],
  }
}

function createUtcCalendarData(item: WorkItem): AppData {
  return {
    ...createData(),
    users: [
      {
        id: "user_1",
        name: "Alex",
        preferences: {
          timeZone: "UTC",
        },
      } as never,
    ],
    workItems: [item],
  }
}

function createCalendarDataWithItems(items: WorkItem[]): AppData {
  return {
    ...createData(),
    workItems: items,
  }
}

function createAllDayCalendarItems({
  count,
  date = formatLocalCalendarDate(startOfDay(new Date())),
  idPrefix,
  titlePrefix,
}: {
  count: number
  date?: string
  idPrefix: string
  titlePrefix: string
}) {
  return Array.from({ length: count }, (_, index) =>
    createWorkItem({
      id: `${idPrefix}-${index + 1}`,
      title: `${titlePrefix} ${index + 1}`,
      startDate: date,
      targetDate: date,
    })
  )
}

function createTimedCalendarItem(overrides: Partial<WorkItem> = {}) {
  const date = formatLocalCalendarDate(startOfDay(new Date()))

  return createWorkItem({
    startDate: date,
    targetDate: date,
    startTime: "09:00",
    endTime: "10:00",
    scheduleTimeZone: "Europe/London",
    ...overrides,
  })
}

function getCalendarTimedGrid() {
  const timedGrid = screen.getByTestId("calendar-timed-grid")
  timedGrid.getBoundingClientRect = () =>
    ({
      bottom: 1536,
      height: 1536,
      left: 0,
      right: 700,
      top: 0,
      width: 700,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect

  return timedGrid
}

function getCalendarEventCard(title: string) {
  const eventCard = screen
    .getByText(title)
    .closest<HTMLElement>("[data-calendar-timed-event]")

  expect(eventCard).toBeTruthy()

  return eventCard!
}

function renderTimedCalendarItem({
  calendarProps,
  canEditItem,
  editable = true,
  item,
}: {
  calendarProps?: Partial<React.ComponentProps<typeof CalendarView>>
  canEditItem?: (item: WorkItem) => boolean
  editable?: boolean
  item: WorkItem
}) {
  const data = {
    ...createData(),
    workItems: [item],
  }

  useAppStore.setState(data)
  const updateWorkItemSpy = vi
    .spyOn(useAppStore.getState(), "updateWorkItem")
    .mockReturnValue({ status: "updated" })

  render(
    <CalendarView
      data={data}
      items={[item]}
      editable={editable}
      canEditItem={canEditItem}
      {...calendarProps}
    />
  )

  return {
    data,
    eventCard: getCalendarEventCard(item.title),
    timedGrid: getCalendarTimedGrid(),
    updateWorkItemSpy,
  }
}

function createEditableData(): AppData {
  return {
    ...createData(),
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
    ],
  }
}

function createCollapsedChildSelectionData() {
  const firstParent = createWorkItem({
    id: "first_parent",
    key: "TES-1",
    title: "First parent",
    status: "todo",
    type: "epic",
  })
  const hiddenCollapsedChild = createWorkItem({
    id: "hidden_collapsed_child",
    key: "TES-2",
    title: "Hidden collapsed child",
    status: "todo",
    type: "feature",
    parentId: firstParent.id,
  })
  const secondParent = createWorkItem({
    id: "second_parent",
    key: "TES-3",
    title: "Second parent",
    status: "todo",
    type: "epic",
  })

  return {
    data: {
      ...createEditableData(),
      workItems: [firstParent, hiddenCollapsedChild, secondParent],
    },
  }
}

type SelectionRangeViewComponent = (props: {
  data: AppData
  editable: boolean
  items: WorkItem[]
  view: ViewDefinition
}) => ReactNode

function renderCollapsedChildSelectionView(
  ViewComponent: SelectionRangeViewComponent,
  layout: ViewDefinition["layout"]
) {
  const { data } = createCollapsedChildSelectionData()

  render(
    <ViewComponent
      data={data}
      items={data.workItems}
      view={createView(layout, ["status"], {
        showChildItems: true,
      })}
      editable
    />
  )
}

function expectCollapsedChildExcludedFromSelectionRange() {
  expect(screen.queryByText("Hidden collapsed child")).not.toBeInTheDocument()

  fireEvent.click(screen.getByLabelText("Select TES-1"))
  fireEvent.click(screen.getByText("Second parent"), { shiftKey: true })

  const target = screen.getByTestId("issue-context-targets-first_parent")
  expect(target).toHaveTextContent("first_parent,second_parent")
  expect(target).not.toHaveTextContent("hidden_collapsed_child")
}

function renderParentGroupedView(
  ViewComponent: SelectionRangeViewComponent,
  layout: ViewDefinition["layout"]
) {
  const data = createEpicGroupedCreateData()

  render(
    <ViewComponent
      data={data}
      items={data.workItems}
      view={createView(layout, ["priority"], {
        grouping: "parent",
        showChildItems: true,
      })}
      editable
    />
  )
}

function expectEditableParentGroupHeader() {
  const parentSummary = screen.getByTestId("parent-group-summary-epic-parent")
  expect(within(parentSummary).getByText("Parent epic")).toBeInTheDocument()
  expect(
    within(parentSummary).getByRole("link", {
      name: "Open parent Parent epic",
    })
  ).toBeInTheDocument()
  expect(screen.getAllByRole("link", { name: "Open Parent epic" })).toHaveLength(
    1
  )
  expect(screen.getByText("Grouped feature")).toBeInTheDocument()
  expect(screen.queryByText("No parent")).not.toBeInTheDocument()

  fireEvent.click(within(parentSummary).getByRole("button", { name: "Medium" }))
  expect(screen.getByText("Urgent")).toBeInTheDocument()
}

function createCreateDefaultData(): AppData {
  return {
    ...createEditableData(),
    labels: [
      {
        id: "label_cx",
        name: "CX",
        color: "#34d399",
        workspaceId: "workspace_1",
      },
      {
        id: "label_ops",
        name: "Ops",
        color: "#60a5fa",
        workspaceId: "workspace_1",
      },
    ],
    projects: [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "project-management",
        name: "Roadmap",
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
  }
}

function createOrderedPropertyData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    users: [
      {
        id: "user_1",
        name: "Alex Morgan",
        email: "alex@example.com",
        title: "",
        handle: "alex",
        avatarUrl: "",
        avatarImageUrl: null,
        workosUserId: null,
        status: "offline",
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      },
    ],
    projects: [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "project-management",
        name: "Roadmap",
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
        ...createWorkItem(),
        assigneeId: "user_1",
        primaryProjectId: "project_1",
        dueDate: "2026-04-25T12:00:00.000Z",
      },
    ],
  }
}

function createProgressData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "parent",
        key: "TES-10",
        type: "epic",
        title: "Parent item",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "child-done",
        key: "TES-11",
        parentId: "parent",
        type: "feature",
        title: "Child done",
        status: "done",
      },
      {
        ...createWorkItem(),
        id: "child-open",
        key: "TES-12",
        parentId: "parent",
        type: "feature",
        title: "Child open",
        status: "in-progress",
      },
    ],
  }
}

function createAssignedHierarchyData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent",
        key: "TES-20",
        type: "epic",
        title: "Epic parent",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-parent",
        key: "TES-21",
        type: "feature",
        title: "Feature parent",
        status: "todo",
        parentId: "epic-parent",
      },
      {
        ...createWorkItem(),
        id: "requirement-middle",
        key: "TES-22",
        type: "requirement",
        title: "Requirement middle",
        status: "todo",
        parentId: "feature-parent",
      },
      {
        ...createWorkItem(),
        id: "story-child",
        key: "TES-23",
        type: "story",
        title: "Story child",
        status: "in-progress",
        assigneeId: "user_1",
        parentId: "requirement-middle",
      },
    ],
  }
}

function createAssignedHierarchyWithoutVisibleDescendantsData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent-empty",
        key: "EPIC",
        type: "epic",
        title: "Epic parent empty",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-parent-empty",
        key: "FEATURE",
        type: "feature",
        title: "Feature parent empty",
        status: "todo",
        parentId: "epic-parent-empty",
      },
      {
        ...createWorkItem(),
        id: "story-child-empty",
        key: "STORY",
        type: "story",
        title: "Story child empty",
        status: "in-progress",
        assigneeId: "user_2",
        parentId: "feature-parent-empty",
      },
    ],
  }
}

function createEpicGroupedCreateData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [createTeam()],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
    ],
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-child",
        key: "TES-31",
        type: "feature",
        title: "Grouped feature",
        status: "in-progress",
        parentId: "epic-parent",
      },
    ],
  }
}

function createCrossTeamEpicGroupedCreateData(): AppData {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    teams: [
      createTeam(),
      createTeam({
        id: "team_2",
        slug: "ops",
        name: "Ops",
      }),
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
    workItems: [
      {
        ...createWorkItem(),
        id: "epic-parent-team-2",
        teamId: "team_2",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "epic-parent-team-1",
        teamId: "team_1",
        key: "TES-30",
        type: "epic",
        title: "Parent epic",
        status: "todo",
      },
      {
        ...createWorkItem(),
        id: "feature-child-team-1",
        teamId: "team_1",
        key: "TES-31",
        type: "feature",
        title: "Grouped feature",
        status: "in-progress",
        parentId: "epic-parent-team-1",
      },
    ],
  }
}

describe("CalendarView", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    useAppStore.setState(createEmptyState())
  })

  it("renders multi-day all-day work as one spanning event", () => {
    const today = startOfDay(new Date(2026, 4, 18))
    const item = createWorkItem({
      id: "multi-day-item",
      title: "Company holiday",
      startDate: formatLocalCalendarDate(today),
      targetDate: formatLocalCalendarDate(addDays(today, 2)),
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(<CalendarView data={data} items={[item]} editable={false} />)

    expect(
      screen.getAllByRole("button", { name: "Company holiday" })
    ).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: /month/i }))

    expect(
      screen.getAllByRole("button", { name: "Company holiday" })
    ).toHaveLength(1)
  })

  it("keeps timed work visible in month mode", () => {
    const today = startOfDay(new Date())
    const date = formatLocalCalendarDate(today)
    const item = createWorkItem({
      id: "timed-item",
      title: "Timed planning",
      startDate: date,
      targetDate: date,
      startTime: "09:00",
      endTime: "10:00",
      scheduleTimeZone: "Europe/London",
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(<CalendarView data={data} items={[item]} editable={false} />)
    fireEvent.click(screen.getByRole("button", { name: /month/i }))

    expect(screen.getByText("Timed planning")).toBeInTheDocument()
  })

  it("wraps calendar events in the shared work-item context menu", () => {
    const today = startOfDay(new Date())
    const allDayItem = createWorkItem({
      id: "calendar-all-day-context",
      title: "All-day context",
      startDate: formatLocalCalendarDate(today),
      targetDate: formatLocalCalendarDate(today),
    })
    const timedItem = createTimedCalendarItem({
      id: "calendar-timed-context",
      title: "Timed context",
    })
    const data = {
      ...createData(),
      workItems: [allDayItem, timedItem],
    }

    render(
      <CalendarView data={data} items={[allDayItem, timedItem]} editable />
    )

    expect(
      screen.getAllByTestId("issue-context-calendar-all-day-context").length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByTestId("issue-context-calendar-timed-context").length
    ).toBeGreaterThan(0)
  })

  it("keeps calendar item details open when edit is chosen from the context menu", () => {
    const item = createTimedCalendarItem({
      id: "calendar-context-edit",
      title: "Calendar context edit",
    })
    const { eventCard, updateWorkItemSpy } = renderTimedCalendarItem({ item })

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 24,
    })
    fireEvent.pointerUp(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 24,
    })
    fireEvent.click(eventCard)

    expect(screen.getByTestId("calendar-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )

    fireEvent.click(
      screen.getAllByTestId("issue-context-edit-calendar-context-edit")[0]
    )

    expect(screen.getByTestId("calendar-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )
    updateWorkItemSpy.mockRestore()
  })

  it("renders cross-midnight timed work in hourly columns", () => {
    const today = startOfDay(new Date())
    const startDate = formatLocalCalendarDate(today)
    const endDate = formatLocalCalendarDate(addDays(today, 1))
    const item = createWorkItem({
      id: "overnight-item",
      title: "Overnight support",
      startDate,
      targetDate: endDate,
      startTime: "23:30",
      endTime: "00:30",
      scheduleTimeZone: "UTC",
    })
    const data = createUtcCalendarData(item)

    render(<CalendarView data={data} items={[item]} editable={false} />)

    expect(
      screen.queryByRole("button", { name: "Overnight support" })
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Overnight support")).toHaveLength(2)
    expect(screen.getByText("23:30 – 23:59")).toBeInTheDocument()
    expect(screen.getByText("00:00 – 00:30")).toBeInTheDocument()
  })

  it("does not render a terminal midnight timed segment", () => {
    const today = startOfDay(new Date())
    const startDate = formatLocalCalendarDate(today)
    const endDate = formatLocalCalendarDate(addDays(today, 1))
    const item = createWorkItem({
      id: "overnight-midnight-item",
      title: "Midnight handoff",
      startDate,
      targetDate: endDate,
      startTime: "23:30",
      endTime: "00:00",
      scheduleTimeZone: "UTC",
    })
    const data = createUtcCalendarData(item)

    render(<CalendarView data={data} items={[item]} editable={false} />)

    expect(screen.getAllByText("Midnight handoff")).toHaveLength(1)
    expect(screen.getByText("23:30 – 23:59")).toBeInTheDocument()
    expect(screen.queryByText("00:00 - 00:00")).not.toBeInTheDocument()
  })

  it("moves month navigation by calendar months", () => {
    const today = startOfDay(new Date())

    render(<CalendarView data={createData()} items={[]} editable={false} />)
    fireEvent.click(screen.getByRole("button", { name: /month/i }))
    fireEvent.click(screen.getByRole("button", { name: "Next period" }))

    expect(
      screen.getByText(format(addMonths(today, 1), "MMMM yyyy"))
    ).toBeInTheDocument()
  })

  it("advances hidden-weekend week navigation by visible days", () => {
    const periodStart = new Date(2026, 4, 18)
    const nextAnchor = getCalendarNavigationAnchorDate({
      anchorDate: periodStart,
      direction: 1,
      mode: "week",
      showWeekends: false,
      weekDayCount: 7,
      weekStart: "monday",
    })
    const previousAnchor = getCalendarNavigationAnchorDate({
      anchorDate: nextAnchor,
      direction: -1,
      mode: "week",
      showWeekends: false,
      weekDayCount: 7,
      weekStart: "monday",
    })

    expect(formatLocalCalendarDate(nextAnchor)).toBe("2026-05-27")
    expect(formatLocalCalendarDate(previousAnchor)).toBe("2026-05-18")
  })

  it("keeps hidden-weekend five-day navigation on the next workweek", () => {
    const periodStart = new Date(2026, 4, 18)
    const nextAnchor = getCalendarNavigationAnchorDate({
      anchorDate: periodStart,
      direction: 1,
      mode: "week",
      showWeekends: false,
      weekDayCount: 5,
      weekStart: "monday",
    })

    expect(formatLocalCalendarDate(nextAnchor)).toBe("2026-05-25")
  })

  it("re-anchors day view from a hidden weekend to the next visible day", () => {
    const saturday = new Date(2026, 4, 23)
    const nextAnchor = getCalendarWeekendVisibilityAnchorDate({
      anchorDate: saturday,
      mode: "day",
      nextShowWeekends: false,
    })

    expect(formatLocalCalendarDate(nextAnchor)).toBe("2026-05-25")
  })

  it("keeps visible-weekend day anchors unchanged", () => {
    const saturday = new Date(2026, 4, 23)
    const nextAnchor = getCalendarWeekendVisibilityAnchorDate({
      anchorDate: saturday,
      mode: "day",
      nextShowWeekends: true,
    })

    expect(formatLocalCalendarDate(nextAnchor)).toBe("2026-05-23")
  })

  it("normalizes Today clicks away from hidden-weekend day anchors", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 20, 9))

    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        mode="day"
        showWeekends={false}
      />
    )

    expect(screen.getByText("20 May 2026")).toBeInTheDocument()

    vi.setSystemTime(new Date(2026, 4, 23, 9))
    fireEvent.click(screen.getByRole("button", { name: "Today" }))

    expect(screen.getByText("25 May 2026")).toBeInTheDocument()
    expect(screen.queryByText("23 May 2026")).not.toBeInTheDocument()
  })

  it("anchors Today clicks to the selected calendar time zone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-21T02:00:00.000Z"))

    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        mode="day"
        timeZone="America/Los_Angeles"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Today" }))

    expect(screen.getByText("20 May 2026")).toBeInTheDocument()
    expect(screen.queryByText("21 May 2026")).not.toBeInTheDocument()
  })

  it("initializes the anchor date from the selected calendar time zone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-21T02:00:00.000Z"))

    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        mode="day"
        timeZone="America/Los_Angeles"
      />
    )

    expect(screen.getByText("20 May 2026")).toBeInTheDocument()
    expect(screen.queryByText("21 May 2026")).not.toBeInTheDocument()
  })

  it("highlights today from the selected calendar time zone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-21T02:00:00.000Z"))

    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        timeZone="America/Los_Angeles"
      />
    )

    expect(screen.getByText("20")).toHaveClass(
      "bg-[color:var(--priority-urgent)]"
    )
    expect(screen.getByText("21")).not.toHaveClass(
      "bg-[color:var(--priority-urgent)]"
    )
  })

  it("normalizes hidden-weekend anchors when entering day mode", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 23, 9))

    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        showWeekends={false}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^day$/i }))

    expect(screen.getByText("25 May 2026")).toBeInTheDocument()
    expect(screen.queryByText("23 May 2026")).not.toBeInTheDocument()
  })

  it("keeps trackpad wheel events as native calendar scrolling", () => {
    const today = startOfDay(new Date())

    render(<CalendarView data={createData()} items={[]} editable={false} />)

    fireEvent.wheel(screen.getByTestId("calendar-view"), {
      deltaX: 180,
      deltaY: 0,
    })

    expect(screen.getByText(format(today, "MMMM yyyy"))).toBeInTheDocument()
  })

  it("keeps vertical day scrolling from shifting the calendar window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 21, 9))

    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(29000)

    try {
      render(
        <CalendarView
          data={createData()}
          items={[]}
          editable={false}
          mode="day"
        />
      )

      const scrollContainer = screen.getByTestId(
        "calendar-day-scroll-container"
      )

      scrollContainer.scrollLeft = 0
      scrollContainer.scrollTop = 420
      fireEvent.scroll(scrollContainer)

      expect(screen.getByText("21 May 2026")).toBeInTheDocument()
      expect(screen.queryByText("20 May 2026")).not.toBeInTheDocument()
    } finally {
      scrollWidthSpy.mockRestore()
    }
  })

  it("anchors day view after its backward scroll buffer", () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(29000)

    try {
      render(
        <CalendarView
          data={createData()}
          items={[]}
          editable={false}
          mode="day"
        />
      )

      expect(screen.getByTestId("calendar-timed-grid")).toHaveStyle({
        width: "2900%",
      })
      expect(
        screen.getByTestId("calendar-day-scroll-container").scrollLeft
      ).toBe(14000)
    } finally {
      scrollWidthSpy.mockRestore()
    }
  })

  it("uses the week day count to size date columns, not just event blocks", () => {
    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable={false}
        mode="week"
        weekDayCount={14}
      />
    )

    expect(screen.getByTestId("calendar-day-header-grid")).toHaveStyle({
      width: "700%",
    })
    expect(screen.getByTestId("calendar-timed-grid")).toHaveStyle({
      width: "700%",
    })
  })

  it("exposes shared calendar settings controls", () => {
    const onColorModeChange = vi.fn()
    const onTimeIntervalChange = vi.fn()
    const onMaxAllDayEventsChange = vi.fn()
    const onTimeZoneChange = vi.fn()

    render(
      <CalendarSettingsButton
        colorMode="status"
        onColorModeChange={onColorModeChange}
        timeInterval="hour"
        onTimeIntervalChange={onTimeIntervalChange}
        maxAllDayEvents={3}
        onMaxAllDayEventsChange={onMaxAllDayEventsChange}
        timeZone="UTC"
        onTimeZoneChange={onTimeZoneChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }))

    expect(screen.getByText("Color formatting")).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Color formatting" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Time interval" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Max all-day events shown" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Weekends" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Week starts on" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Time zone" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Show number of days" })
    ).not.toBeInTheDocument()
  })

  it("shows the number of days setting only for week calendars", () => {
    const props = {
      colorMode: "status" as const,
      onColorModeChange: vi.fn(),
      timeInterval: "hour" as const,
      onTimeIntervalChange: vi.fn(),
      maxAllDayEvents: 3,
      onMaxAllDayEventsChange: vi.fn(),
      weekDayCount: 7 as const,
      onWeekDayCountChange: vi.fn(),
      showWeekends: true,
      onShowWeekendsChange: vi.fn(),
      timeZone: "UTC",
      onTimeZoneChange: vi.fn(),
    }

    const { rerender } = render(
      <CalendarSettingsButton {...props} showWeekDayCount={false} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }))

    expect(
      screen.queryByRole("combobox", { name: "Show number of days" })
    ).not.toBeInTheDocument()

    rerender(<CalendarSettingsButton {...props} showWeekDayCount />)

    expect(
      screen.getByRole("combobox", { name: "Show number of days" })
    ).toBeInTheDocument()
  })

  it("collapses extra all-day rows and expands them on demand", () => {
    const items = createAllDayCalendarItems({
      count: 5,
      idPrefix: "all-day-limit",
      titlePrefix: "All-day limit",
    })
    const data = createCalendarDataWithItems(items)

    render(
      <CalendarView
        data={data}
        items={items}
        editable={false}
        maxAllDayEvents={3}
      />
    )

    expect(screen.getByText("All-day limit 1")).toBeInTheDocument()
    expect(screen.getByText("All-day limit 2")).toBeInTheDocument()
    expect(screen.getByText("All-day limit 3")).toBeInTheDocument()
    expect(screen.queryByText("All-day limit 4")).not.toBeInTheDocument()
    expect(screen.queryByText("All-day limit 5")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("+ 2 more"))

    expect(screen.getByText("All-day limit 4")).toBeInTheDocument()
    expect(screen.getByText("All-day limit 5")).toBeInTheDocument()
    expect(
      screen.getByTestId("calendar-all-day-collapse-bar")
    ).toHaveTextContent("Collapse events")

    fireEvent.click(screen.getByTestId("calendar-all-day-collapse-bar"))

    expect(screen.queryByText("All-day limit 4")).not.toBeInTheDocument()
    expect(screen.queryByText("All-day limit 5")).not.toBeInTheDocument()
    expect(screen.getByText("+ 2 more")).toBeInTheDocument()
  })

  it("expands all-day rows up to ten events without keeping the collapsed row limit", () => {
    const items = createAllDayCalendarItems({
      count: 10,
      idPrefix: "all-day-expanded-limit",
      titlePrefix: "All-day expanded limit",
    })
    const data = createCalendarDataWithItems(items)

    render(
      <CalendarView
        data={data}
        items={items}
        editable={false}
        maxAllDayEvents={3}
      />
    )

    expect(screen.getByText("All-day expanded limit 3")).toBeInTheDocument()
    expect(
      screen.queryByText("All-day expanded limit 4")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("+ 7 more"))

    expect(screen.getByText("All-day expanded limit 10")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-all-day-scroll-area")).toHaveStyle({
      height: "334px",
    })
    expect(
      screen.getByTestId("calendar-all-day-collapse-bar")
    ).toHaveTextContent("Collapse events")
  })

  it("resets expanded all-day rows after navigating away and back", () => {
    const items = createAllDayCalendarItems({
      count: 5,
      idPrefix: "all-day-reset",
      titlePrefix: "All-day reset",
    })
    const data = createCalendarDataWithItems(items)

    render(
      <CalendarView
        data={data}
        items={items}
        editable={false}
        maxAllDayEvents={3}
      />
    )

    fireEvent.click(screen.getByText("+ 2 more"))
    expect(screen.getByText("All-day reset 5")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next period" }))
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }))

    expect(screen.queryByText("All-day reset 4")).not.toBeInTheDocument()
    expect(screen.queryByText("All-day reset 5")).not.toBeInTheDocument()
    expect(screen.getByText("+ 2 more")).toBeInTheDocument()
  })

  it("opens the day view from hidden month events", () => {
    const today = startOfDay(new Date())
    const date = formatLocalCalendarDate(today)
    const items = Array.from({ length: 8 }, (_, index) =>
      createWorkItem({
        id: `month-more-${index + 1}`,
        title: `Month hidden ${index + 1}`,
        startDate: date,
        targetDate: date,
        startTime: `${String(9 + index).padStart(2, "0")}:00`,
        endTime: `${String(10 + index).padStart(2, "0")}:00`,
        scheduleTimeZone: "UTC",
      })
    )
    const data = createUtcCalendarData(items[0]!)

    render(
      <CalendarView
        data={{ ...data, workItems: items }}
        items={items}
        editable={false}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /month/i }))
    fireEvent.click(screen.getAllByText(/\+ \d+ more/)[0]!)

    expect(screen.getByText(format(today, "d MMMM yyyy"))).toBeInTheDocument()
    expect(screen.getByText("Month hidden 8")).toBeInTheDocument()
  })

  it("sizes the all-day lane to the visible all-day row count", () => {
    const items = createAllDayCalendarItems({
      count: 2,
      idPrefix: "all-day-fit",
      titlePrefix: "All-day fit",
    })
    const data = createCalendarDataWithItems(items)

    render(
      <CalendarView
        data={data}
        items={items}
        editable={false}
        maxAllDayEvents={3}
      />
    )

    expect(screen.getByTestId("calendar-all-day-lane")).toHaveStyle({
      height: "68px",
    })
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it("grows the collapsed all-day lane to fit visible rows", () => {
    const items = createAllDayCalendarItems({
      count: 8,
      idPrefix: "all-day-visible",
      titlePrefix: "All-day visible",
    })
    const data = createCalendarDataWithItems(items)

    render(
      <CalendarView
        data={data}
        items={items}
        editable={false}
        maxAllDayEvents={8}
      />
    )

    expect(screen.getByTestId("calendar-all-day-lane")).toHaveStyle({
      height: "248px",
    })
    expect(screen.getByTestId("calendar-all-day-scroll-area")).toHaveStyle({
      height: "248px",
    })
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it("clears floating detail after leaving a hovered calendar item", () => {
    vi.useFakeTimers()
    const today = startOfDay(new Date())
    const item = createWorkItem({
      id: "hover-item",
      title: "Hover planning",
      startDate: formatLocalCalendarDate(today),
      targetDate: formatLocalCalendarDate(today),
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(<CalendarView data={data} items={[item]} editable />)

    const itemButton = screen.getByRole("button", { name: "Hover planning" })
    fireEvent.mouseEnter(itemButton)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId("floating-detail")).toBeInTheDocument()

    fireEvent.mouseLeave(itemButton)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByTestId("floating-detail")).not.toBeInTheDocument()
  })

  it("positions floating calendar details near the cursor inside the calendar surface", () => {
    vi.useFakeTimers()
    const today = startOfDay(new Date())
    const item = createWorkItem({
      id: "hover-position-item",
      title: "Hover position planning",
      startDate: formatLocalCalendarDate(today),
      targetDate: formatLocalCalendarDate(today),
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(<CalendarView data={data} items={[item]} editable />)

    const calendarSurface = screen.getByTestId("calendar-main-surface")
    vi.spyOn(calendarSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 650,
      height: 600,
      left: 100,
      right: 900,
      top: 50,
      width: 800,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Hover position planning" }),
      {
        clientX: 180,
        clientY: 120,
      }
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const floatingDetail = screen.getByTestId("floating-detail")

    expect(floatingDetail.parentElement).toHaveStyle({
      left: "188px",
      maxHeight: "514px",
      top: "128px",
      width: "420px",
    })
    expect(floatingDetail).toHaveAttribute("data-floating-max-height", "514")
  })

  it("clears timed drag state on pointer cancellation", () => {
    const item = createTimedCalendarItem({
      id: "drag-item",
      title: "Drag planning",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 576,
      pointerId: 7,
    })
    fireEvent.pointerCancel(eventCard, {
      clientX: 120,
      clientY: 576,
      pointerId: 7,
    })
    fireEvent.pointerUp(timedGrid, {
      clientX: 260,
      clientY: 720,
      pointerId: 7,
    })

    expect(updateWorkItemSpy).not.toHaveBeenCalled()
    updateWorkItemSpy.mockRestore()
  })

  it("blocks drag edits for non-editable calendar items", () => {
    const item = createTimedCalendarItem({
      id: "readonly-calendar-item",
      title: "Read-only planning",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      {
        canEditItem: () => false,
        item,
      }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 576,
      pointerId: 11,
    })
    fireEvent.pointerUp(timedGrid, {
      clientX: 260,
      clientY: 720,
      pointerId: 11,
    })
    fireEvent.click(eventCard)

    expect(updateWorkItemSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId("inline-detail")).toHaveAttribute(
      "data-editable",
      "false"
    )
    updateWorkItemSpy.mockRestore()
  })

  it("ignores non-primary pointer starts for timed calendar drags", () => {
    vi.useFakeTimers()
    const item = createTimedCalendarItem({
      id: "right-click-calendar-item",
      title: "Right click planning",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      button: 2,
      clientX: 120,
      clientY: 640,
      pointerId: 17,
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    fireEvent.pointerMove(timedGrid, {
      button: 2,
      clientX: 240,
      clientY: 720,
      pointerId: 17,
    })
    fireEvent.pointerUp(timedGrid, {
      button: 2,
      clientX: 240,
      clientY: 720,
      pointerId: 17,
    })

    expect(updateWorkItemSpy).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId("calendar-drag-preview")
    ).not.toBeInTheDocument()
    updateWorkItemSpy.mockRestore()
  })

  it("keeps timed event duration when a move is clamped late in the day", () => {
    const item = createTimedCalendarItem({
      id: "late-day-drag-item",
      title: "Late-day planning",
      startTime: "10:00",
      endTime: "11:30",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 12,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 120,
      clientY: 1504,
      pointerId: 12,
    })
    fireEvent.pointerUp(timedGrid, {
      clientX: 120,
      clientY: 1504,
      pointerId: 12,
    })

    expect(updateWorkItemSpy).toHaveBeenCalledWith(
      "late-day-drag-item",
      expect.objectContaining({
        startTime: "22:29",
        endTime: "23:59",
      })
    )
    updateWorkItemSpy.mockRestore()
  })

  it("opens details on click without starting a timed calendar drag", () => {
    const item = createTimedCalendarItem({
      id: "click-calendar-item",
      title: "Click planning",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, updateWorkItemSpy } = renderTimedCalendarItem({ item })

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 14,
    })
    fireEvent.pointerUp(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 14,
    })
    fireEvent.click(eventCard)

    expect(updateWorkItemSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId("inline-detail")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )
    expect(screen.getByTestId("calendar-detail-slot")).toHaveClass("h-full")
    expect(screen.getByTestId("inline-detail")).toHaveAttribute(
      "data-header-class-name",
      "h-[37px]"
    )
    expect(screen.getByTestId("calendar-main-surface")).toBeInTheDocument()

    fireEvent.click(eventCard)

    expect(screen.queryByTestId("inline-detail")).not.toBeInTheDocument()
    updateWorkItemSpy.mockRestore()
  })

  it("keeps the anchored day visible when the calendar detail sidebar opens", () => {
    let scrollWidth = 29000
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(() => scrollWidth)
    const item = createTimedCalendarItem({
      id: "sidebar-anchor-item",
      title: "Sidebar anchor planning",
      startTime: "10:00",
      endTime: "11:00",
    })

    try {
      const { eventCard, updateWorkItemSpy } = renderTimedCalendarItem({
        calendarProps: { mode: "day" },
        item,
      })
      const scrollContainer = screen.getByTestId(
        "calendar-day-scroll-container"
      )

      expect(scrollContainer.scrollLeft).toBe(14000)

      scrollWidth = 14500
      fireEvent.click(eventCard)

      expect(screen.getByTestId("inline-detail")).toBeInTheDocument()
      expect(scrollContainer.scrollLeft).toBe(7000)
      updateWorkItemSpy.mockRestore()
    } finally {
      scrollWidthSpy.mockRestore()
    }
  })

  it("closes the calendar detail sidebar when a blank slot is clicked", () => {
    const item = createTimedCalendarItem({
      id: "blank-close-item",
      title: "Blank close planning",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.click(eventCard)

    expect(screen.getByTestId("inline-detail")).toBeInTheDocument()

    fireEvent.click(timedGrid)

    expect(screen.queryByTestId("inline-detail")).not.toBeInTheDocument()
    updateWorkItemSpy.mockRestore()
  })

  it("opens the create modal with private schedule defaults on blank double click", () => {
    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable
        createContext={{
          defaultTeamId: "team_1",
          defaultProjectId: "project_1",
          defaultVisibility: "private",
        }}
      />
    )

    const timedGrid = getCalendarTimedGrid()

    fireEvent.doubleClick(timedGrid, {
      clientX: 120,
      clientY: 640,
    })

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProjectId: null,
        defaultTeamId: "team_1",
        initialType: "task",
        kind: "workItem",
        defaultValues: expect.objectContaining({
          primaryProjectId: null,
          scheduleTimeZone: expect.any(String),
          startTime: "10:00",
          endTime: "11:00",
          visibility: "private",
        }),
      })
    )
  })

  it("opens the create modal with a dragged calendar time range", () => {
    render(
      <CalendarView
        data={createData()}
        items={[]}
        editable
        createContext={{
          defaultTeamId: "team_1",
          defaultProjectId: "project_1",
        }}
      />
    )

    const timedGrid = getCalendarTimedGrid()

    fireEvent.pointerDown(timedGrid, {
      clientX: 120,
      clientY: 640,
      pointerId: 17,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 120,
      clientY: 704,
      pointerId: 17,
    })

    expect(screen.getByTestId("calendar-selection-preview")).toBeInTheDocument()

    fireEvent.pointerUp(timedGrid, {
      clientX: 120,
      clientY: 704,
      pointerId: 17,
    })

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProjectId: "project_1",
        defaultTeamId: "team_1",
        kind: "workItem",
        defaultValues: expect.objectContaining({
          scheduleTimeZone: expect.any(String),
          startTime: "10:00",
          endTime: "11:00",
        }),
      })
    )
  })

  it("shows a visible preview while dragging timed calendar items", () => {
    const item = createTimedCalendarItem({
      id: "preview-calendar-item",
      title: "Preview planning",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 15,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 120,
      clientY: 704,
      pointerId: 15,
    })

    expect(screen.getByTestId("calendar-drag-preview")).toHaveTextContent(
      "Preview planning"
    )
    expect(screen.getByTestId("calendar-drag-preview")).toHaveTextContent(
      "11:00 – 12:00"
    )

    fireEvent.pointerUp(timedGrid, {
      clientX: 120,
      clientY: 704,
      pointerId: 15,
    })

    expect(
      screen.queryByTestId("calendar-drag-preview")
    ).not.toBeInTheDocument()
    updateWorkItemSpy.mockRestore()
  })

  it("moves timed items to the target visible day when weekends are hidden", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-22T09:00:00.000Z"))

    const item = createTimedCalendarItem({
      id: "hidden-weekend-drag-item",
      title: "Hidden weekend drag",
      startDate: "2026-05-22",
      targetDate: "2026-05-22",
      startTime: "09:00",
      endTime: "10:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      {
        calendarProps: {
          mode: "day",
          showWeekends: false,
          timeZone: "Europe/London",
        },
        item,
      }
    )

    timedGrid.getBoundingClientRect = () =>
      ({
        bottom: 1536,
        height: 1536,
        left: 0,
        right: 2900,
        top: 0,
        width: 2900,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    fireEvent.pointerDown(eventCard, {
      clientX: 1450,
      clientY: 576,
      pointerId: 18,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 1550,
      clientY: 576,
      pointerId: 18,
    })
    fireEvent.pointerUp(timedGrid, {
      clientX: 1550,
      clientY: 576,
      pointerId: 18,
    })

    expect(updateWorkItemSpy).toHaveBeenCalledWith(
      "hidden-weekend-drag-item",
      expect.objectContaining({
        startDate: "2026-05-25",
        targetDate: "2026-05-25",
        startTime: "09:00",
        endTime: "10:00",
      })
    )
    updateWorkItemSpy.mockRestore()
  })

  it("converts a timed calendar item back to all day when dragged into the all-day lane", () => {
    const item = createTimedCalendarItem({
      id: "timed-to-all-day-item",
      title: "Timed to all day",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 16,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 120,
      clientY: -12,
      pointerId: 16,
    })

    expect(
      screen.getByTestId("calendar-all-day-drag-preview")
    ).toHaveTextContent("Timed to all day")

    fireEvent.pointerUp(timedGrid, {
      clientX: 120,
      clientY: -12,
      pointerId: 16,
    })

    expect(updateWorkItemSpy).toHaveBeenCalledWith(
      "timed-to-all-day-item",
      expect.objectContaining({
        startTime: null,
        endTime: null,
        scheduleTimeZone: null,
      })
    )
    updateWorkItemSpy.mockRestore()
  })

  it("previews all-day items as timed events and resizes the all-day lane while dragging out", () => {
    const items = createAllDayCalendarItems({
      count: 2,
      idPrefix: "all-day-drag",
      titlePrefix: "All-day drag",
    })
    const data = createCalendarDataWithItems(items)
    useAppStore.setState(data)
    const updateWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "updateWorkItem")
      .mockReturnValue({ status: "updated" })

    render(<CalendarView data={data} items={items} editable />)

    const allDayEvent = screen
      .getByText("All-day drag 1")
      .closest<HTMLElement>("[data-calendar-all-day-event]")

    expect(allDayEvent).toBeTruthy()
    expect(screen.getByTestId("calendar-all-day-lane")).toHaveStyle({
      height: "68px",
    })

    fireEvent.pointerDown(allDayEvent!, {
      clientX: 120,
      clientY: 120,
      pointerId: 21,
    })
    fireEvent.pointerMove(document, {
      clientX: 120,
      clientY: 640,
      pointerId: 21,
    })

    expect(screen.getByTestId("calendar-drag-preview")).toHaveTextContent(
      "All-day drag 1"
    )
    expect(screen.getByTestId("calendar-all-day-lane")).toHaveStyle({
      height: "44px",
    })

    fireEvent.pointerUp(document, {
      clientX: 120,
      clientY: 640,
      pointerId: 21,
    })

    expect(updateWorkItemSpy).toHaveBeenCalledWith(
      "all-day-drag-1",
      expect.objectContaining({
        startTime: "10:00",
        endTime: "11:00",
        scheduleTimeZone: expect.any(String),
      })
    )
    updateWorkItemSpy.mockRestore()
  })

  it("suppresses the click emitted after a timed calendar drag", () => {
    vi.useFakeTimers()
    const item = createTimedCalendarItem({
      id: "drag-click-item",
      title: "Drag click planning",
      startTime: "10:00",
      endTime: "11:00",
    })
    const { eventCard, timedGrid, updateWorkItemSpy } = renderTimedCalendarItem(
      { item }
    )

    fireEvent.pointerDown(eventCard, {
      clientX: 120,
      clientY: 640,
      pointerId: 13,
    })
    fireEvent.pointerMove(timedGrid, {
      clientX: 120,
      clientY: 704,
      pointerId: 13,
    })
    fireEvent.pointerUp(eventCard, {
      clientX: 120,
      clientY: 704,
      pointerId: 13,
    })
    fireEvent.click(eventCard)

    expect(updateWorkItemSpy).toHaveBeenCalled()
    expect(screen.queryByTestId("inline-detail")).not.toBeInTheDocument()

    act(() => {
      vi.runOnlyPendingTimers()
    })
    updateWorkItemSpy.mockRestore()
  })

  it("lets the expanded all-day lane scroll separately while keeping days in sync", () => {
    const today = startOfDay(new Date())
    const date = formatLocalCalendarDate(today)
    const items = createAllDayCalendarItems({
      count: 36,
      date,
      idPrefix: "all-day-overflow",
      titlePrefix: "Overflow all-day",
    })
    const data = createCalendarDataWithItems(items)

    render(<CalendarView data={data} items={items} editable={false} />)

    fireEvent.click(screen.getAllByText(/\+ \d+ more/)[0])

    const allDayArea = screen.getByTestId("calendar-all-day-scroll-area")
    const dayScrollContainer = screen.getByTestId(
      "calendar-day-scroll-container"
    )

    expect(allDayArea).toHaveStyle({ height: "334px" })
    expect(allDayArea).toHaveClass("no-scrollbar")
    expect(dayScrollContainer).toHaveClass("no-scrollbar")
    expect(screen.getByTestId("calendar-all-day-collapse-bar")).toHaveClass(
      "absolute"
    )
    expect(screen.getByTestId("calendar-all-day-collapse-bar")).not.toHaveClass(
      "bottom-1"
    )

    allDayArea.scrollLeft = 240
    fireEvent.scroll(allDayArea)

    expect(dayScrollContainer.scrollLeft).toBe(240)
  })
})

describe("TimelineView primitives", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("hides scrollbar chrome on timeline scroll containers", () => {
    render(
      <TimelineView
        data={createData()}
        items={[]}
        view={createView("timeline")}
        editable={false}
      />
    )

    expect(screen.getByTestId("timeline-body-scroll")).toHaveClass(
      "no-scrollbar"
    )
    expect(screen.getByTestId("timeline-grid-scroll")).toHaveClass(
      "no-scrollbar"
    )
  })

  it("updates timeline anchors after the local date changes", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 20, 23, 59, 50))

    render(
      <TimelineView
        data={createData()}
        items={[]}
        view={createView("timeline")}
        editable={false}
      />
    )

    expect(screen.getByText("W 20")).toHaveClass("text-primary")

    act(() => {
      vi.setSystemTime(new Date(2026, 4, 21, 0, 0, 2))
      vi.advanceTimersByTime(12_000)
    })

    expect(screen.getByText("T 21")).toHaveClass("text-primary")
  })

  it("opens timeline item details inline with the timeline rows", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22, 8))
    const item = createWorkItem({
      id: "timeline-detail-item",
      title: "Timeline detail",
      status: "todo",
      startDate: "2026-05-22T00:00:00.000Z",
      targetDate: "2026-05-23T00:00:00.000Z",
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(
      <TimelineView
        data={data}
        items={[item]}
        view={createView("timeline")}
        editable={false}
      />
    )

    const timelineLink = screen.getByRole("link", { name: "Timeline detail" })

    fireEvent.click(timelineLink)

    expect(screen.getByTestId("timeline-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )
    expect(screen.getByTestId("timeline-detail-slot")).toHaveClass("h-full")
    expect(screen.getByTestId("timeline-main-surface")).toBeInTheDocument()
    expect(screen.getByTestId("timeline-view")).toContainElement(
      screen.getByTestId("timeline-detail-slot")
    )
    expect(
      screen.getAllByTestId("issue-context-timeline-detail-item").length
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId("inline-detail")).toHaveAttribute(
      "data-header-class-name",
      "h-8"
    )

    fireEvent.click(timelineLink)

    expect(screen.queryByTestId("inline-detail")).not.toBeInTheDocument()

    const timelineBar = screen.getByRole("button", { name: item.key })

    clickTimelineBarAfterPointerRelease(timelineBar, {
      pointerId: 42,
      releaseTarget: window,
    })

    expect(screen.getByTestId("timeline-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )
  })

  it("keeps timeline item details open when edit is chosen from the context menu", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22, 8))
    const item = createWorkItem({
      id: "timeline-context-edit",
      title: "Timeline context edit",
      status: "todo",
      startDate: "2026-05-22T00:00:00.000Z",
      targetDate: "2026-05-23T00:00:00.000Z",
    })
    const data = {
      ...createData(),
      workItems: [item],
    }

    render(
      <TimelineView
        data={data}
        items={[item]}
        view={createView("timeline")}
        editable
      />
    )

    fireEvent.click(screen.getByRole("link", { name: "Timeline context edit" }))

    expect(screen.getByTestId("timeline-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )

    fireEvent.click(
      screen.getAllByTestId("issue-context-edit-timeline-context-edit")[0]
    )

    expect(screen.getByTestId("timeline-detail-slot")).toContainElement(
      screen.getByTestId("inline-detail")
    )
  })

  it("computes drag patches and rejects invalid timeline drops", () => {
    const data = {
      ...createData(),
      workItems: [
        createWorkItem({
          id: "item_1",
          startDate: "2026-04-20T00:00:00.000Z",
          dueDate: "2026-04-22T00:00:00.000Z",
        }),
      ],
    }
    const timelineStart = new Date("2026-04-20T00:00:00.000Z")

    expect(
      getTimelineMovePatchForDrag({
        activeId: "item_1",
        data,
        dragOffset: { itemId: "item_1", offsetDays: 1 },
        editable: true,
        overId: "timeline::lane::2026-04-25",
        timelineStart,
      })
    ).toEqual({
      itemId: "item_1",
      patch: {
        dueDate: "2026-04-26T00:00:00.000Z",
        startDate: "2026-04-24T00:00:00.000Z",
        targetDate: undefined,
      },
    })
    expect(
      getTimelineMovePatchForDrag({
        activeId: "item_1",
        data,
        dragOffset: null,
        editable: false,
        overId: "timeline::lane::2026-04-25",
        timelineStart,
      })
    ).toBeNull()
  })

  it("renders timeline labels and bars with fallback compact titles", () => {
    const data = {
      ...createData(),
      users: [
        {
          id: "user_1",
          name: "Alex",
        } as never,
      ],
    }
    const item = createWorkItem({
      assigneeId: "user_1",
      title: "Long timeline item",
      status: "in-progress",
    })
    const onCaptureDragOffset = vi.fn()
    const onResizeStart = vi.fn()
    const onSelectItem = vi.fn()

    const { container } = render(
      <>
        <TimelineLabelRow
          data={data}
          item={item}
          accentMode="status"
          accentIndex={0}
          labelsById={null}
        />
        <TimelineBar
          data={data}
          item={item}
          accentMode="status"
          accentIndex={0}
          labelsById={null}
          span={1}
          onCaptureDragOffset={onCaptureDragOffset}
          onSelectItem={onSelectItem}
          onResizeStart={onResizeStart}
        />
      </>
    )

    expect(screen.getByText("TES-1")).toBeInTheDocument()
    expect(screen.getByText("Alex")).toBeInTheDocument()

    const timelineBar = screen.getByRole("button")
    fireEvent.pointerUp(timelineBar, { clientX: 0, clientY: 0 })
    expect(onSelectItem).not.toHaveBeenCalled()

    fireEvent.pointerDown(timelineBar, { button: 2, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(timelineBar, { button: 2, clientX: 0, clientY: 0 })
    expect(onCaptureDragOffset).not.toHaveBeenCalled()
    expect(onSelectItem).not.toHaveBeenCalled()

    clickTimelineBarAfterPointerRelease(timelineBar)
    expect(onSelectItem).toHaveBeenCalledWith(item.id)
    expect(onSelectItem).toHaveBeenCalledTimes(1)

    onSelectItem.mockClear()
    clickTimelineBarAfterPointerRelease(timelineBar, {
      pointerId: 42,
      releaseTarget: window,
    })
    expect(onSelectItem).toHaveBeenCalledWith(item.id)
    expect(onSelectItem).toHaveBeenCalledTimes(1)

    onSelectItem.mockClear()
    fireEvent.pointerDown(timelineBar, { clientX: 0, clientY: 0 })
    fireEvent.click(timelineBar, { clientX: 8, clientY: 0 })
    expect(onSelectItem).not.toHaveBeenCalled()

    const startResizeHandle = container.querySelector(
      '[data-timeline-resize-handle="start"]'
    )

    if (!startResizeHandle) {
      throw new Error("Expected start resize handle")
    }

    fireEvent.click(startResizeHandle)
    expect(onSelectItem).not.toHaveBeenCalled()

    onCaptureDragOffset.mockClear()
    fireEvent.pointerDown(startResizeHandle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(startResizeHandle, { clientX: 0, clientY: 0 })
    fireEvent.click(startResizeHandle, { clientX: 0, clientY: 0 })
    expect(onCaptureDragOffset).not.toHaveBeenCalled()
    expect(onResizeStart).toHaveBeenCalledWith(item, "start", 0)
    expect(onSelectItem).not.toHaveBeenCalled()

    onResizeStart.mockClear()
    fireEvent.pointerDown(startResizeHandle, {
      button: 2,
      clientX: 0,
      clientY: 0,
    })
    expect(onResizeStart).not.toHaveBeenCalled()
  })
})

describe("BoardView", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("excludes collapsed child cards from board selection ranges", () => {
    renderCollapsedChildSelectionView(BoardView, "board")
    expectCollapsedChildExcludedFromSelectionRange()
  })
})

describe("ListView", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("does not render empty read-only groups without item rows", () => {
    const data = createData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView()}
        editable={false}
      />
    )

    expect(
      screen.queryByRole("button", { name: /backlog/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()
  })

  it("opens visible label properties as editable list dropdowns", () => {
    const item = createWorkItem({
      labelIds: ["label_cx"],
      status: "todo",
    })
    const data = {
      ...createEditableData(),
      labels: [
        {
          id: "label_cx",
          workspaceId: "workspace_1",
          name: "CX",
          color: "#34d399",
        },
        {
          id: "label_ops",
          workspaceId: "workspace_1",
          name: "Ops",
          color: "#60a5fa",
        },
      ],
      workItems: [item],
    }

    useAppStore.setState(data)
    const updateWorkItemSpy = vi
      .spyOn(useAppStore.getState(), "updateWorkItem")
      .mockImplementation((id: string, patch: Partial<WorkItem>) => {
        useAppStore.setState((state) => ({
          workItems: state.workItems.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry
          ),
        }))

        return {
          status: "updated" as const,
        }
      })

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["labels"])}
        editable
      />
    )

    const labelTrigger = screen.getByRole("button", { name: "Labels: CX" })

    expect(labelTrigger.querySelector("svg")).toBeNull()

    fireEvent.click(labelTrigger)
    fireEvent.click(screen.getByRole("button", { name: "Ops" }))

    expect(updateWorkItemSpy).toHaveBeenCalledWith("item_1", {
      labelIds: ["label_cx", "label_ops"],
    })
  })

  it("opens private label properties as editable list dropdowns", () => {
    const item = createWorkItem({
      id: "private_item",
      key: "TES-1",
      title: "Private follow-up",
      labelIds: ["label_private"],
      visibility: "private",
      workspaceId: "workspace_1",
      teamId: null,
    })
    const data = {
      ...createEditableData(),
      labels: [
        {
          id: "label_cx",
          workspaceId: "workspace_1",
          name: "CX",
          color: "#34d399",
        },
        {
          id: "label_private",
          workspaceId: "workspace_1",
          scopeType: "private" as const,
          ownerId: "user_1",
          name: "Focus",
          color: "#a78bfa",
        },
        {
          id: "label_other_private",
          workspaceId: "workspace_1",
          scopeType: "private" as const,
          ownerId: "user_2",
          name: "Hidden",
          color: "#94a3b8",
        },
      ],
      workItems: [item],
    }
    useAppStore.setState(data)

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["labels"], {
          filters: {
            ...createDefaultViewFilters(),
            visibility: ["private"],
          },
        })}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Labels: Focus" }))

    expect(screen.getAllByText("Focus").length).toBeGreaterThan(0)
    expect(screen.queryByText("CX")).not.toBeInTheDocument()
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
  })

  it("passes selected visible list rows into the work item context menu", () => {
    const firstItem = createWorkItem({
      id: "item_1",
      key: "TES-1",
      title: "First item",
      status: "todo",
    })
    const secondItem = createWorkItem({
      id: "item_2",
      key: "TES-2",
      title: "Second item",
      status: "todo",
    })
    const data = {
      ...createEditableData(),
      workItems: [firstItem, secondItem],
    }

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["status"])}
        editable
      />
    )

    fireEvent.click(screen.getByLabelText("Select TES-1"))
    fireEvent.click(screen.getByLabelText("Select TES-2"))

    expect(screen.getByTestId("issue-context-targets-item_1")).toHaveTextContent(
      "item_1,item_2"
    )
    expect(screen.getByTestId("issue-context-item_1")).toHaveAttribute(
      "data-display-props",
      "status"
    )
  })

  it("keeps list row actions aligned with reserved row padding", () => {
    const item = createWorkItem({
      id: "item_1",
      key: "TES-1",
      title: "Aligned action row",
      status: "todo",
    })
    const data = {
      ...createEditableData(),
      workItems: [item],
    }

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["status"])}
        editable
      />
    )

    const actionButton = screen.getByTestId("issue-action-item_1")
    const actionSlot = actionButton.parentElement
    const reservedProperties = actionSlot?.previousElementSibling

    expect(actionSlot).toHaveClass("right-5")
    expect(reservedProperties).toHaveClass("pr-12")
  })

  it("places list selection after disclosure next to the identity cluster", () => {
    const parentItem = createWorkItem({
      id: "parent_item",
      key: "TES-1",
      title: "Parent item",
      status: "todo",
      type: "epic",
    })
    const childItem = createWorkItem({
      id: "child_item",
      key: "TES-2",
      title: "Child item",
      status: "todo",
      type: "feature",
      parentId: parentItem.id,
    })
    const data = {
      ...createEditableData(),
      workItems: [parentItem, childItem],
    }

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["status"], {
          showChildItems: true,
        })}
        editable
      />
    )

    const disclosure = screen.getByLabelText("Expand sub-issues")
    const checkbox = screen.getByLabelText("Select TES-1")

    expect(
      disclosure.compareDocumentPosition(checkbox) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("renders unchecked checkboxes with darker contrast", () => {
    render(
      <WorkItemSelectionCheckbox
        checked={false}
        label="Select TES-1"
        onChange={vi.fn()}
      />
    )

    const checkbox = screen.getByLabelText("Select TES-1")
    const visualBox = checkbox.nextElementSibling

    expect(visualBox).toHaveClass("border", "border-fg-4", "bg-surface-3")
    expect(visualBox).toHaveClass("peer-checked:border-transparent")
  })

  it("renders selected checkboxes as gray boxes with a black tick", () => {
    render(
      <WorkItemSelectionCheckbox
        checked
        label="Select TES-1"
        onChange={vi.fn()}
      />
    )

    const checkbox = screen.getByLabelText("Select TES-1")
    const visualBox = checkbox.nextElementSibling

    expect(visualBox).toHaveClass("bg-surface-3")
    expect(visualBox).toHaveClass("peer-checked:border-transparent")
    expect(visualBox).toHaveClass("peer-checked:text-foreground")
  })

  it("keeps list selection ranges scoped to rendered child rows", () => {
    const parentItem = createWorkItem({
      id: "parent_item",
      key: "TES-1",
      title: "Parent item",
      status: "todo",
      type: "epic",
    })
    const visibleChild = createWorkItem({
      id: "visible_child",
      key: "TES-2",
      title: "Visible child",
      status: "todo",
      type: "feature",
      parentId: parentItem.id,
    })
    const hiddenRetainedChild = createWorkItem({
      id: "hidden_child",
      key: "TES-3",
      title: "Hidden retained child",
      status: "todo",
      type: "feature",
      parentId: parentItem.id,
    })
    const data = {
      ...createEditableData(),
      workItems: [parentItem, visibleChild, hiddenRetainedChild],
    }
    const scopedItems = [parentItem, visibleChild]

    render(
      <ListView
        data={data}
        items={[parentItem]}
        scopedItems={scopedItems}
        view={createView("list", ["status"], {
          showChildItems: true,
        })}
        editable
      />
    )

    fireEvent.click(screen.getByLabelText("Expand sub-issues"))
    fireEvent.click(screen.getByLabelText("Select TES-1"))
    fireEvent.click(screen.getByText("Visible child"), { shiftKey: true })

    expect(
      screen.getByTestId("issue-context-targets-parent_item")
    ).toHaveTextContent("parent_item,visible_child")
    expect(
      screen.getByTestId("issue-context-targets-parent_item")
    ).not.toHaveTextContent("hidden_child")
  })

  it("excludes collapsed child rows from list selection ranges", () => {
    renderCollapsedChildSelectionView(ListView, "list")
    expectCollapsedChildExcludedFromSelectionRange()
  })

  it("does not show bulk selection controls in read-only list rows", () => {
    const data = createData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["status"])}
        editable={false}
      />
    )

    expect(screen.queryByLabelText("Select TES-1")).not.toBeInTheDocument()
  })

  it("keeps add item available for empty unfiltered editable groups", () => {
    const data = {
      ...createEditableData(),
      workItems: [],
    }

    render(
      <ListView
        data={data}
        items={[]}
        view={createView("list", [], { grouping: "status" })}
        editable
        createContext={{
          defaultTeamId: "team_1",
          defaultProjectId: "project_1",
        }}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0])

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultProjectId: "project_1",
        defaultValues: expect.objectContaining({
          status: "backlog",
        }),
      })
    )
  })

  it("keeps no-group list add controls aligned with the row content lane", () => {
    const data = createEditableData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", [], { grouping: null })}
        editable
      />
    )

    const addButton = screen.getByRole("button", { name: "Add item" })

    expect(addButton).toHaveStyle({ paddingLeft: "14px" })
    expect(addButton).toHaveClass("gap-2.5")
    expect(addButton).not.toHaveClass("pl-[45px]")
  })

  it("prepopulates labels when adding from an empty label-filtered lane", () => {
    const data = {
      ...createCreateDefaultData(),
      workItems: [],
    }
    const view = createView("list", [], {
      filters: {
        ...createDefaultViewFilters(),
        labelIds: ["label_cx"],
      },
      grouping: "label",
    })

    render(
      <ListView
        data={data}
        items={[]}
        view={view}
        editable
        createContext={{
          defaultTeamId: "team_1",
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultValues: expect.objectContaining({
          labelIds: ["label_cx"],
        }),
      })
    )
  })

  it("prepopulates private labels when adding from private label-filtered lanes", () => {
    const data = {
      ...createCreateDefaultData(),
      labels: [
        ...createCreateDefaultData().labels,
        {
          id: "label_private",
          workspaceId: "workspace_1",
          scopeType: "private" as const,
          ownerId: "user_1",
          name: "Focus",
          color: "#a78bfa",
        },
      ],
      workItems: [],
    }
    const view = createView("list", [], {
      filters: {
        ...createDefaultViewFilters(),
        labelIds: ["label_private"],
        visibility: ["private"],
      },
      grouping: "label",
    })

    render(
      <ListView
        data={data}
        items={[]}
        view={view}
        editable
        createContext={{
          defaultTeamId: "team_1",
          defaultVisibility: "private",
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProjectId: null,
        defaultValues: expect.objectContaining({
          labelIds: ["label_private"],
          visibility: "private",
        }),
      })
    )
  })

  it("merges group, subgroup, and single-value filter defaults for lane creates", () => {
    const data = {
      ...createCreateDefaultData(),
      workItems: [
        createWorkItem({
          id: "item_cx",
          labelIds: ["label_cx"],
          status: "in-progress",
        }),
      ],
    }
    const view = createView("list", [], {
      filters: {
        ...createDefaultViewFilters(),
        projectIds: ["project_1"],
        teamIds: ["team_1"],
        itemTypes: ["task"],
      },
      grouping: "label",
      subGrouping: "status",
    })

    render(<ListView data={data} items={data.workItems} view={view} editable />)

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    expect(openManagedCreateDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultProjectId: "project_1",
        initialType: "task",
        defaultValues: expect.objectContaining({
          labelIds: ["label_cx"],
          primaryProjectId: "project_1",
          status: "in-progress",
        }),
      })
    )
  })

  it("applies safe single-value filters but leaves ambiguous label filters unset", () => {
    const data = {
      ...createCreateDefaultData(),
      workItems: [],
    }
    const view = createView("list", [], {
      filters: {
        ...createDefaultViewFilters(),
        status: ["todo"],
        priority: ["high"],
        projectIds: ["project_1"],
        teamIds: ["team_1"],
        itemTypes: ["task"],
        labelIds: ["label_cx", "label_ops"],
      },
      grouping: "status",
      hiddenState: {
        groups: ["backlog", "in-progress", "done", "cancelled", "duplicate"],
        subgroups: [],
      },
    })

    render(<ListView data={data} items={[]} view={view} editable />)

    fireEvent.click(screen.getByRole("button", { name: "Add item" }))

    const dialog = vi.mocked(openManagedCreateDialog).mock.calls[0]?.[0]

    expect(dialog).toEqual(
      expect.objectContaining({
        defaultTeamId: "team_1",
        defaultProjectId: "project_1",
        initialType: "task",
        defaultValues: expect.objectContaining({
          primaryProjectId: "project_1",
          priority: "high",
          status: "todo",
        }),
      })
    )
    expect(dialog?.kind === "workItem" && dialog.defaultValues?.labelIds).toBe(
      undefined
    )
  })

  it("opens grouped creates in the private tasks destination for private views", () => {
    const data = {
      ...createEditableData(),
      workItems: [],
    }

    const view = createView("board", [], {
      filters: {
        ...createDefaultViewFilters(),
        visibility: ["private"],
      },
      grouping: "status",
    })
    const createContext = {
      defaultTeamId: "team_1",
      defaultProjectId: null,
      defaultVisibility: "private" as const,
    }

    const { rerender } = render(
      <BoardView
        data={data}
        items={[]}
        scopedItems={[]}
        view={view}
        editable
        createContext={createContext}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0])

    expectPrivateCreateDialogDefaults()

    vi.mocked(openManagedCreateDialog).mockClear()

    rerender(
      <ListView
        data={data}
        items={[]}
        scopedItems={[]}
        view={{ ...view, layout: "list" }}
        editable
        createContext={createContext}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0])

    expectPrivateCreateDialogDefaults()
  })

  it("does not synthesize create-context groups for read-only empty surfaces", () => {
    const data = {
      ...createEditableData(),
      workItems: [],
    }
    const view = createView("list", [], { grouping: "status" })
    const createContext = {
      defaultTeamId: "team_1",
      defaultProjectId: "project_1",
    }

    const { rerender } = render(
      <ListView
        data={data}
        items={[]}
        scopedItems={[]}
        view={view}
        editable={false}
        createContext={createContext}
      />
    )

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={[]}
        scopedItems={[]}
        view={{ ...view, layout: "board" }}
        editable={false}
        createContext={createContext}
      />
    )

    expect(screen.queryByText("Backlog")).not.toBeInTheDocument()
    expect(screen.queryByText("No items")).not.toBeInTheDocument()
  })

  it("does not render completion meters in list group headers", () => {
    const data = createProgressData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.parentId === null)}
        view={createView("list")}
        editable={false}
      />
    )

    expect(screen.queryByLabelText("Completion")).not.toBeInTheDocument()
  })

  it("renders child rollup progress on list rows when the progress property is enabled", () => {
    const data = createProgressData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.parentId === null)}
        view={createView("list", ["progress"])}
        editable={false}
      />
    )

    expect(screen.getByLabelText("Child progress 50%")).toBeInTheDocument()
  })

  it("renders child rollup progress on board cards only when the progress property is enabled", () => {
    const data = createProgressData()
    const topLevelItems = data.workItems.filter(
      (item) => item.parentId === null
    )

    const { rerender } = render(
      <BoardView
        data={data}
        items={topLevelItems}
        view={createView("board", ["progress"])}
        editable={false}
      />
    )

    expect(screen.getByLabelText("Child progress 50%")).toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={topLevelItems}
        view={createView("board")}
        editable={false}
      />
    )

    expect(
      screen.queryByLabelText("Child progress 50%")
    ).not.toBeInTheDocument()
  })

  it("applies active filters to board child disclosure rows", () => {
    const data = createProgressData()
    const parentItems = data.workItems.filter((item) => item.parentId === null)
    const view = createView("board", [], {
      showChildItems: true,
      filters: {
        ...createDefaultViewFilters(),
        status: ["todo", "in-progress"],
      },
    })

    render(
      <BoardView
        data={data}
        items={parentItems}
        scopedItems={data.workItems}
        view={view}
        editable={false}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "1 feature" }))

    expect(screen.getByText("Child open")).toBeInTheDocument()
    expect(screen.queryByText("Child done")).not.toBeInTheDocument()
  })

  it("applies active filters to list child disclosure rows", () => {
    const data = createProgressData()
    const parentItems = data.workItems.filter((item) => item.parentId === null)
    const view = createView("list", [], {
      showChildItems: true,
      filters: {
        ...createDefaultViewFilters(),
        status: ["todo", "in-progress"],
      },
    })

    render(
      <ListView
        data={data}
        items={parentItems}
        scopedItems={data.workItems}
        view={view}
        editable={false}
      />
    )

    fireEvent.click(screen.getByLabelText("Expand sub-issues"))

    expect(screen.getByText("Child open")).toBeInTheDocument()
    expect(screen.queryByText("Child done")).not.toBeInTheDocument()
  })

  it("renders list-row properties in the same order as visible properties", () => {
    const data = createOrderedPropertyData()

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["assignee", "project", "dueDate"])}
        editable={false}
      />
    )

    const assignee = screen.getByText("Assignee")
    const roadmap = screen.getByText("Roadmap")
    const dueDate = screen.getByText("Due 25 April")

    expect(
      assignee.compareDocumentPosition(roadmap) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      roadmap.compareDocumentPosition(dueDate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("renders multiple list-row assignees as avatars without visible count text", () => {
    const alex = {
      id: "user_1",
      name: "Alex",
    } as AppData["users"][number]
    const morgan = {
      id: "user_2",
      name: "Morgan",
    } as AppData["users"][number]
    const item = createWorkItem({
      assigneeId: alex.id,
      assigneeIds: [alex.id, morgan.id],
    })
    const data = {
      ...createData(),
      users: [alex, morgan],
      workItems: [item],
    }

    render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["assignee"])}
        editable={false}
      />
    )

    expect(screen.getAllByText("Assignee")).toHaveLength(2)
    expect(screen.queryByText("2 assignees")).not.toBeInTheDocument()
    expect(screen.queryByText("Alex")).not.toBeInTheDocument()
  })

  it("renders parent as a selectable work item property", () => {
    const data = createOrderedPropertyData()
    const parent = createWorkItem({
      id: "parent_1",
      key: "TES-99",
      title: "Parent feature",
    })
    const child = {
      ...data.workItems[0],
      parentId: parent.id,
    } as WorkItem
    const scopedData = {
      ...data,
      workItems: [parent, child],
    }

    render(
      <ListView
        data={scopedData}
        items={[child]}
        view={createView("list", ["parent"])}
        editable={false}
      />
    )

    expect(screen.getByText("TES-99 · Parent feature")).toBeInTheDocument()
  })

  it("renders board-card properties in the same order as visible properties", () => {
    const data = createOrderedPropertyData()

    render(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["project", "dueDate", "assignee"])}
        editable={false}
      />
    )

    const roadmap = screen.getByText("Roadmap")
    const dueDate = screen.getByText("Due 25 April")
    const assignee = screen.getByText("Assignee")

    expect(
      roadmap.compareDocumentPosition(dueDate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      dueDate.compareDocumentPosition(assignee) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("hides empty assignee and project pills on editable list rows and board cards", () => {
    const data = createEditableData()

    const { rerender } = render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["assignee", "project"])}
        editable
      />
    )

    expectEmptyOptionalPillsHidden()

    rerender(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["assignee", "project"])}
        editable
      />
    )

    expectEmptyOptionalPillsHidden()
  })

  it("removes dedicated list drag handles and makes board cards draggable from the full card surface", () => {
    const data = createData()
    const { rerender } = render(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list")}
        editable
      />
    )

    expect(screen.queryByLabelText("Drag Ship it")).not.toBeInTheDocument()

    rerender(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board")}
        editable
      />
    )

    expect(screen.queryByLabelText("Drag Ship it")).not.toBeInTheDocument()
    expect(
      screen.getByText("Ship it").closest('[aria-roledescription="draggable"]')
    ).toBeTruthy()
  })

  it("opens inline property pickers from both board cards and list rows", async () => {
    const data = createEditableData()
    const { rerender } = render(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", ["priority"])}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Medium" }))
    expect(await screen.findByText("Urgent")).toBeInTheDocument()

    rerender(
      <ListView
        data={data}
        items={data.workItems}
        view={createView("list", ["priority"])}
        editable
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Medium" }))
    expect(await screen.findByText("Urgent")).toBeInTheDocument()
  })

  it("preserves grouped parent defaults when adding an item from epic lanes", () => {
    const data = createEpicGroupedCreateData()
    const groupedItems = data.workItems.filter(
      (item) => item.id === "feature-child"
    )
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })

    expectBoardAndListCreateDefaults({
      data,
      items: groupedItems,
      view,
      expected: {
        initialType: "feature",
        parentId: "epic-parent",
      },
    })
  })

  it("preserves direct parent defaults when adding an item from parent lanes", () => {
    const data = createEpicGroupedCreateData()
    const groupedItems = data.workItems.filter(
      (item) => item.id === "feature-child"
    )
    const view = createView("board", [], {
      grouping: "parent",
      hiddenState: {
        groups: ["No parent"],
        subgroups: [],
      },
    })

    expectBoardAndListCreateDefaults({
      data,
      items: groupedItems,
      view,
      expected: {
        initialType: "feature",
        parentId: "epic-parent",
      },
    })
  })

  it("promotes parent groups into board headers with editable properties", () => {
    renderParentGroupedView(BoardView, "board")
    expectEditableParentGroupHeader()
  })

  it("promotes parent groups into list headers with editable properties", () => {
    renderParentGroupedView(ListView, "list")
    expectEditableParentGroupHeader()
  })

  it("promotes a parentless container issue into its own parent lane", () => {
    const issueExperience = "issue-analysis" as const
    const issueTeam = createTeam()
    const data = {
      ...createData(),
      teams: [
        {
          ...issueTeam,
          settings: {
            ...issueTeam.settings,
            experience: issueExperience,
            features: createDefaultTeamFeatureSettings(issueExperience),
            workflow: createDefaultTeamWorkflowSettings(issueExperience),
          },
        },
      ],
      workItems: [
        createWorkItem({
          id: "issue-parentless",
          key: "BUG-1",
          type: "issue",
          title: "Parentless issue",
        }),
        createWorkItem({
          id: "sub-issue-loose",
          key: "BUG-2",
          type: "sub-issue",
          title: "Loose sub-issue",
        }),
      ],
    }

    render(
      <BoardView
        data={data}
        items={data.workItems}
        view={createView("board", [], {
          grouping: "parent",
          itemLevel: "issue",
        })}
        editable={false}
        groupingExperience="issue-analysis"
      />
    )

    const parentLane = screen.getByTestId(
      "parent-group-summary-issue-parentless"
    )
    expect(within(parentLane).getByText("Parentless issue")).toBeInTheDocument()
    // A parentless leaf (no allowed children) still falls under the
    // experience-labelled empty parent lane.
    expect(screen.getByText("No issue")).toBeInTheDocument()
  })

  it("derives parent defaults from the epic lane even when only the parent row is visible", () => {
    const data = createEpicGroupedCreateData()
    const laneItems = data.workItems.filter((item) => item.id === "epic-parent")
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })
    expectBoardAndListCreateDefaults({
      data,
      items: laneItems,
      view,
      expected: {
        initialType: "feature",
        parentId: "epic-parent",
      },
    })
  })

  it("prefers the more specific parent subgroup when opening create from nested parent lanes", () => {
    const data = createEpicGroupedCreateData()
    const view = createView("board", [], {
      grouping: "epic",
      subGrouping: "feature",
      hiddenState: {
        groups: ["No epic"],
        subgroups: ["No feature"],
      },
    })
    expectBoardAndListCreateDefaults({
      data,
      items: data.workItems,
      view,
      expected: {
        initialType: "requirement",
        parentId: "feature-child",
      },
    })
  })

  it("scopes parent lane defaults to the active team when duplicate parent labels exist", () => {
    const data = createCrossTeamEpicGroupedCreateData()
    const groupedItems = data.workItems.filter(
      (item) => item.id === "feature-child-team-1"
    )
    const view = createView("board", [], {
      grouping: "epic",
      hiddenState: {
        groups: ["No epic"],
        subgroups: [],
      },
    })
    expectBoardAndListCreateDefaults({
      data,
      items: groupedItems,
      view,
      expected: {
        parentId: "epic-parent-team-1",
      },
    })
  })

  it("renders the lowest assigned descendant under the selected parent level in list mode", () => {
    const data = createAssignedHierarchyData()

    render(
      <ListView
        data={data}
        items={data.workItems.filter((item) => item.id === "epic-parent")}
        scopedItems={data.workItems}
        view={createView("list", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    fireEvent.click(screen.getByLabelText("Expand sub-issues"))

    expect(screen.getByText("Story child")).toBeInTheDocument()
    expect(screen.queryByText("Feature parent")).not.toBeInTheDocument()
  })

  it("labels compressed board children using the visible assigned descendant type", () => {
    const data = createAssignedHierarchyData()

    render(
      <BoardView
        data={data}
        items={data.workItems.filter((item) => item.id === "epic-parent")}
        scopedItems={data.workItems}
        view={createView("board", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    const childDisclosure = screen.getByRole("button", { name: "1 story" })
    expect(childDisclosure).toBeInTheDocument()

    fireEvent.click(childDisclosure)

    expect(screen.getByText("Story child")).toBeInTheDocument()
  })

  it("does not show fallback child counts when assigned-descendant containers have no visible descendants", () => {
    const data = createAssignedHierarchyWithoutVisibleDescendantsData()
    const items = data.workItems.filter(
      (item) => item.id === "epic-parent-empty"
    )

    const { rerender } = render(
      <ListView
        data={data}
        items={items}
        scopedItems={data.workItems}
        view={createView("list", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    expect(screen.queryByLabelText("Expand sub-issues")).not.toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(1)

    rerender(
      <BoardView
        data={data}
        items={items}
        scopedItems={data.workItems}
        view={createView("board", [], {
          itemLevel: "epic",
          showChildItems: true,
        })}
        editable={false}
        childDisplayMode="assigned-descendants"
      />
    )

    expect(screen.queryByLabelText("1 story")).not.toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(1)
  })

  it("requests owner-local drag patches for item and group targets", () => {
    const activeItem = createWorkItem({
      id: "active",
      status: "todo",
    })
    const targetItem = createWorkItem({
      id: "target",
      status: "done",
    })
    const data = {
      ...createData(),
      workItems: [activeItem, targetItem],
    }
    const requestUpdate = vi.fn()
    const view = createView("board", [], { grouping: "status" })

    requestWorkSurfaceDragUpdate({
      data,
      editable: false,
      event: createDragEndEvent(activeItem.id, "board::done"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).not.toHaveBeenCalled()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, targetItem.id),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).not.toHaveBeenCalled()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, "list::done"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).not.toHaveBeenCalled()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, `board-item::${activeItem.id}`),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).not.toHaveBeenCalled()

    requestWorkSurfaceDragUpdate({
      data: {
        ...data,
        workItems: [
          ...data.workItems,
          createWorkItem({ id: "other-team", teamId: "team_2" }),
        ],
      },
      editable: true,
      event: createDragEndEvent(activeItem.id, "board-item::other-team"),
      itemPool: [
        ...data.workItems,
        createWorkItem({ id: "other-team", teamId: "team_2" }),
      ],
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).not.toHaveBeenCalled()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, `board-item::${targetItem.id}`),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).toHaveBeenLastCalledWith(
      activeItem.id,
      expect.objectContaining({
        status: "done",
        parentId: null,
      })
    )

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, "board::todo"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view,
    })
    expect(requestUpdate).toHaveBeenLastCalledWith(activeItem.id, {
      status: "todo",
    })
  })

  it("preserves parent links when dragging between non-parent group lanes", () => {
    const parentItem = createWorkItem({
      id: "parent",
      type: "issue",
      status: "todo",
    })
    const activeItem = createWorkItem({
      id: "active",
      type: "sub-issue",
      parentId: parentItem.id,
      status: "todo",
    })
    const data = {
      ...createData(),
      workItems: [parentItem, activeItem],
    }
    const requestUpdate = vi.fn()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, "board::done"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view: createView("board", [], { grouping: "status" }),
    })

    expect(requestUpdate).toHaveBeenCalledWith(activeItem.id, {
      status: "done",
    })
  })

  it("updates parent links when dragging between parent group lanes", () => {
    const originalParent = createWorkItem({
      id: "parent-a",
      key: "BUG-1",
      title: "Original parent",
      type: "issue",
    })
    const nextParent = createWorkItem({
      id: "parent-b",
      key: "BUG-2",
      title: "Next parent",
      type: "issue",
    })
    const activeItem = createWorkItem({
      id: "active",
      key: "BUG-3",
      type: "sub-issue",
      parentId: originalParent.id,
    })
    const data = {
      ...createData(),
      workItems: [originalParent, nextParent, activeItem],
    }
    const requestUpdate = vi.fn()

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, "board::BUG-2 · Next parent"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view: createView("board", [], { grouping: "parent" }),
    })

    expect(requestUpdate).toHaveBeenCalledWith(activeItem.id, {
      parentId: nextParent.id,
    })

    requestWorkSurfaceDragUpdate({
      data,
      editable: true,
      event: createDragEndEvent(activeItem.id, "board::No parent"),
      itemPool: data.workItems,
      requestUpdate,
      scope: "board",
      view: createView("board", [], { grouping: "parent" }),
    })

    expect(requestUpdate).toHaveBeenLastCalledWith(activeItem.id, {
      parentId: null,
    })
  })

  it("renders board child rows as static rows or interactive links", () => {
    const item = createWorkItem({ title: "Child item", status: "in-progress" })

    const { rerender } = render(
      <BoardChildItemRow item={item} assignee={null} interactive={false} />
    )

    expect(screen.getByText("Child item")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()

    rerender(
      <BoardChildItemRow
        item={item}
        assignee={{
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "",
          status: "active",
          statusMessage: "",
          preferences: {
            emailAssignments: true,
            emailDigest: true,
            emailMentions: true,
            theme: "system",
          },
        }}
        interactive
        href="/items/item_1"
        isDropTarget
      />
    )

    expect(screen.getByRole("link")).toHaveAttribute("href", "/items/item_1")
    expect(screen.getByText("Assignee")).toBeInTheDocument()
  })
})
