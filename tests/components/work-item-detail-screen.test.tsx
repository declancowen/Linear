import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WorkItemDetailScreen } from "@/components/app/screens/work-item-detail-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

const {
  routerReplaceMock,
  syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotificationsMock,
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  syncClearWorkItemPresenceMock: vi.fn(),
  syncHeartbeatWorkItemPresenceMock: vi.fn(),
  syncSendItemDescriptionMentionNotificationsMock: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncClearWorkItemPresence: syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresence: syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotifications:
    syncSendItemDescriptionMentionNotificationsMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
  }: {
    content: string
    onChange: (value: string) => void
  }) => (
    <textarea
      aria-label="Description editor"
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock("@/components/app/screens/document-ui", () => ({
  DocumentPresenceAvatarGroup: ({
    viewers,
  }: {
    viewers: Array<{ name: string }>
  }) => <div>{viewers.map((viewer) => viewer.name).join(",")}</div>,
}))

vi.mock("@/components/app/screens/shared", () => ({
  buildPropertyStatusOptions: (statuses: string[]) =>
    statuses.map((status) => ({
      value: status,
      label: status,
    })),
  CollapsibleSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
  PriorityDot: () => null,
  PropertyDateField: () => null,
  PropertyRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PropertySelect: () => null,
  StatusIcon: () => null,
  WorkItemLabelsEditor: () => null,
}))

vi.mock("@/components/app/screens/work-item-ui", () => ({
  CommentsInline: () => null,
  WorkItemAssigneeAvatar: () => null,
  InlineChildIssueComposer: () => null,
  WorkItemTypeBadge: () => <div>Task</div>,
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

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      Sidebar
    </button>
  ),
}))

vi.mock("@/components/ui/collapsible-right-sidebar", () => ({
  CollapsibleRightSidebar: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => null,
}))

vi.mock("@phosphor-icons/react", () => ({
  CaretDown: () => null,
  CaretRight: () => null,
  DotsThree: () => null,
  Plus: () => null,
  SidebarSimple: () => null,
  Trash: () => null,
}))

function seedState() {
  useAppStore.setState({
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
      {
        id: "user_2",
        name: "Taylor",
        handle: "taylor",
        email: "taylor@example.com",
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
        icon: "robot",
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
    documents: [
      {
        id: "document_1",
        kind: "item-description",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Plan launch",
        content: "<p>Initial description</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: ["item_1"],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ],
    workItems: [
      {
        id: "item_1",
        key: "PLA-1",
        teamId: "team_1",
        type: "task",
        title: "Plan launch",
        descriptionDocId: "document_1",
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
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ],
    ui: {
      activeTeamId: "team_1",
      activeInboxNotificationId: null,
      selectedViewByRoute: {},
      activeCreateDialog: null,
    },
  })
}

describe("work item detail screen", () => {
  beforeEach(() => {
    syncClearWorkItemPresenceMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockReset()
    syncSendItemDescriptionMentionNotificationsMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([])
    syncClearWorkItemPresenceMock.mockResolvedValue({ ok: true })
    seedState()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("shows a stale draft notice and reloads the latest main-section content", async () => {
    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByDisplayValue("Plan launch"), {
      target: {
        value: "Plan launch draft",
      },
    })

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled()

    act(() => {
      useAppStore.setState((state) => ({
        workItems: state.workItems.map((item) =>
          item.id === "item_1"
            ? {
                ...item,
                title: "Plan launch remote",
                updatedAt: "2026-04-18T11:00:00.000Z",
              }
            : item
        ),
        documents: state.documents.map((document) =>
          document.id === "document_1"
            ? {
                ...document,
                content: "<p>Remote description</p>",
                updatedAt: "2026-04-18T11:00:00.000Z",
              }
            : document
        ),
      }))
    })

    expect(
      screen.getByText("This item changed while you were editing")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }))

    expect(screen.queryByText("This item changed while you were editing")).toBeNull()
    expect(screen.getByDisplayValue("Plan launch remote")).toBeInTheDocument()
  })

  it("surfaces when other people are editing the same item", async () => {
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([
      {
        userId: "user_1",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-18T10:01:00.000Z",
      },
      {
        userId: "user_2",
        name: "Taylor",
        avatarUrl: "",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-18T10:01:00.000Z",
      },
    ])

    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    expect(
      await screen.findByText("Taylor is also editing this item")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "You can keep editing, but you may need to reload before saving if they update the item first."
      )
    ).toBeInTheDocument()
  })

  it("closes edit mode even when mention delivery fails after save", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockRejectedValue(
      new Error("Saved changes but failed to notify mentions")
    )
    useAppStore.setState({
      saveWorkItemMainSection: saveWorkItemMainSectionMock,
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByLabelText("Description editor"), {
      target: {
        value:
          '<p>Initial description</p><span data-type="mention" data-id="user_2">@Taylor</span>',
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(saveWorkItemMainSectionMock).toHaveBeenCalled()
    expect(
      await screen.findByRole("button", { name: "Edit" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })

  it("retries failed mention delivery on the next save without reintroducing the mention", async () => {
    let saveCount = 0
    const saveWorkItemMainSectionMock = vi.fn().mockImplementation(
      async ({
        description,
        title,
      }: {
        description: string
        title: string
      }) => {
        saveCount += 1
        useAppStore.setState((state) => ({
          workItems: state.workItems.map((item) =>
            item.id === "item_1"
              ? {
                  ...item,
                  title,
                  updatedAt: `2026-04-18T10:00:0${saveCount}.000Z`,
                }
              : item
          ),
          documents: state.documents.map((document) =>
            document.id === "document_1"
              ? {
                  ...document,
                  content: description,
                  updatedAt: `2026-04-18T10:00:0${saveCount}.000Z`,
                }
              : document
          ),
        }))

        return true
      }
    )
    syncSendItemDescriptionMentionNotificationsMock
      .mockRejectedValueOnce(new Error("Saved changes but failed to notify mentions"))
      .mockResolvedValueOnce({
        recipientCount: 1,
        mentionCount: 1,
      })
    useAppStore.setState({
      saveWorkItemMainSection: saveWorkItemMainSectionMock,
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByLabelText("Description editor"), {
      target: {
        value:
          '<p>Initial description</p><span data-type="mention" data-id="user_2">@Taylor</span>',
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByRole("button", { name: "Edit" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    const saveButton = screen.getByRole("button", { name: "Save" })
    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)

    await waitFor(() =>
      expect(
        syncSendItemDescriptionMentionNotificationsMock
      ).toHaveBeenNthCalledWith(2, "item_1", [
        {
          userId: "user_2",
          count: 1,
        },
      ])
    )

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }))
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("sends self-mentions after saving the main section", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockResolvedValue({
      recipientCount: 1,
      mentionCount: 1,
    })
    useAppStore.setState({
      saveWorkItemMainSection: saveWorkItemMainSectionMock,
    } as Partial<ReturnType<typeof useAppStore.getState>>)

    render(<WorkItemDetailScreen itemId="item_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByLabelText("Description editor"), {
      target: {
        value:
          '<p>Initial description</p><span data-type="mention" data-id="user_1">@Alex</span>',
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(saveWorkItemMainSectionMock).toHaveBeenCalled()
    await waitFor(() =>
      expect(
        syncSendItemDescriptionMentionNotificationsMock
      ).toHaveBeenCalledWith("item_1", [
        {
          userId: "user_1",
          count: 1,
        },
      ])
    )
  })
})
