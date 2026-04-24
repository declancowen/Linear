import type { ReactNode } from "react"
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

vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react")

  const DropdownMenuContext = React.createContext<{
    close: () => void
    open: boolean
  } | null>(null)

  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(true)

      return (
        <DropdownMenuContext.Provider
          value={{
            close: () => setOpen(false),
            open,
          }}
        >
          {children}
        </DropdownMenuContext.Provider>
      )
    },
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(DropdownMenuContext)
      return context?.open ? <div>{children}</div> : null
    },
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => null,
    DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuSubContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onSelect,
    }: {
      children: ReactNode
      onSelect?: (event: Event) => void
    }) => {
      const context = React.useContext(DropdownMenuContext)

      return (
        <button
          type="button"
          onClick={() => {
            let defaultPrevented = false
            onSelect?.({
              preventDefault() {
                defaultPrevented = true
              },
              stopPropagation() {},
            } as Event)
            if (!defaultPrevented) {
              context?.close()
            }
          }}
        >
          {children}
        </button>
      )
    },
  }
})

vi.mock("@/components/ui/context-menu", async () => {
  const React = await import("react")

  const ContextMenuState = React.createContext<{
    close: () => void
    open: boolean
  } | null>(null)

  return {
    ContextMenu: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(true)

      return (
        <ContextMenuState.Provider
          value={{
            close: () => setOpen(false),
            open,
          }}
        >
          {children}
        </ContextMenuState.Provider>
      )
    },
    ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    ContextMenuContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(ContextMenuState)
      return context?.open ? <div>{children}</div> : null
    },
    ContextMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ContextMenuSeparator: () => null,
    ContextMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ContextMenuSubTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    ContextMenuSubContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    ContextMenuItem: ({
      children,
      onSelect,
    }: {
      children: ReactNode
      onSelect?: (event: Event) => void
    }) => {
      const context = React.useContext(ContextMenuState)

      return (
        <button
          type="button"
          onClick={() => {
            let defaultPrevented = false
            onSelect?.({
              preventDefault() {
                defaultPrevented = true
              },
              stopPropagation() {},
            } as Event)
            if (!defaultPrevented) {
              context?.close()
            }
          }}
        >
          {children}
        </button>
      )
    },
  }
})

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
