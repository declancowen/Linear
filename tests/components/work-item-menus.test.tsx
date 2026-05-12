import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
  }: {
    open: boolean
    title: string
  }) => (open ? <div>{title}</div> : null),
}))

vi.mock("@/components/app/entity-icons", () => ({
  ProjectTemplateGlyph: () => <span>Project icon</span>,
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  WorkItemAssigneeAvatar: () => <span>Avatar</span>,
}))

vi.mock("@/components/ui/dropdown-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSelectableMenuStubModule("DropdownMenu")
)

vi.mock("@/components/ui/context-menu", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSelectableMenuStubModule("ContextMenu")
)

vi.mock("@phosphor-icons/react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@phosphor-icons/react")>()

  return {
    ...actual,
    DotsThree: () => null,
    Trash: () => null,
  }
})

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppData,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  IssueActionMenu,
  IssueContextMenu,
} from "@/components/app/screens/work-item-menus"

function createMenuData(): { data: AppData; item: WorkItem } {
  const item: WorkItem = {
    id: "item_1",
    key: "TES-1",
    teamId: "team_1",
    type: "feature",
    title: "Feature item",
    descriptionDocId: "doc_1",
    status: "todo",
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
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  }

  return {
    item,
    data: {
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [
        {
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
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
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "rocket",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
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
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Roadmap",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: [],
          health: "on-track",
          priority: "medium",
          status: "backlog",
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      workItems: [item],
    },
  }
}

describe("work item menus", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      updateWorkItem: vi.fn(() => ({
        status: "project-confirmation-required",
        cascadeItemCount: 3,
      })) as never,
      deleteWorkItem: vi.fn(async () => true) as never,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("keeps project confirmation mounted from the action menu", () => {
    const { data, item } = createMenuData()

    render(
      <IssueActionMenu
        data={data}
        item={item}
      />
    )

    fireEvent.click(screen.getByText("Roadmap"))

    expect(screen.getByText("Update project for hierarchy")).toBeInTheDocument()
  })

  it("keeps project confirmation mounted from the context menu", () => {
    const { data, item } = createMenuData()

    render(
      <IssueContextMenu data={data} item={item}>
        <button type="button">Open menu</button>
      </IssueContextMenu>
    )

    fireEvent.click(screen.getByText("Roadmap"))

    expect(screen.getByText("Update project for hierarchy")).toBeInTheDocument()
  })
})
