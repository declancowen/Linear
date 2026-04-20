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
import { RouteMutationError } from "@/lib/convex/client/shared"
import { useAppStore } from "@/lib/store/app-store"

const {
  routerReplaceMock,
  syncAddCommentMock,
  syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotificationsMock,
  syncToggleCommentReactionMock,
  syncUpdateWorkItemMock,
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  syncAddCommentMock: vi.fn(),
  syncClearWorkItemPresenceMock: vi.fn(),
  syncHeartbeatWorkItemPresenceMock: vi.fn(),
  syncSendItemDescriptionMentionNotificationsMock: vi.fn(),
  syncToggleCommentReactionMock: vi.fn(),
  syncUpdateWorkItemMock: vi.fn(),
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
  syncAddComment: syncAddCommentMock,
  syncClearWorkItemPresence: syncClearWorkItemPresenceMock,
  syncHeartbeatWorkItemPresence: syncHeartbeatWorkItemPresenceMock,
  syncSendItemDescriptionMentionNotifications:
    syncSendItemDescriptionMentionNotificationsMock,
  syncToggleCommentReaction: syncToggleCommentReactionMock,
  syncUpdateWorkItem: syncUpdateWorkItemMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
    onSubmitShortcut,
    submitOnEnter,
  }: {
    content: string
    onChange: (value: string) => void
    placeholder?: string
    onSubmitShortcut?: () => void
    submitOnEnter?: boolean
  }) => (
    <textarea
      aria-label={
        placeholder === "Add a description…"
          ? "Description editor"
          : (placeholder ?? "Rich text editor")
      }
      value={content}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          onSubmitShortcut?.()
        }
      }}
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
  PROPERTY_SELECT_SEPARATOR_VALUE: "__separator__",
  PriorityIcon: () => null,
  PriorityDot: () => null,
  PropertyDateField: ({
    label,
    value,
    disabled,
    onValueChange,
  }: {
    label: string
    value: string | null
    disabled?: boolean
    onValueChange: (value: string | null) => void
  }) => (
    <input
      aria-label={label}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value || null)}
    />
  ),
  PropertyRow: ({
    label,
    value,
  }: {
    label: string
    value: string
  }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  PropertySelect: ({
    accessibleLabel,
    label,
    value,
    options,
    disabled,
    onValueChange,
  }: {
    accessibleLabel?: string
    label: string
    value: string
    options: Array<{ value: string; label: string }>
    disabled?: boolean
    onValueChange: (value: string) => void
  }) => (
    <button
      type="button"
      aria-label={accessibleLabel ?? (label || "Project")}
      disabled={disabled}
      onClick={() => {
        const nextOption = options.find(
          (option) => option.value !== "__separator__" && option.value !== value
        )

        if (nextOption) {
          onValueChange(nextOption.value)
        }
      }}
    >
      {label || "Project"}:{value}
    </button>
  ),
  StatusIcon: () => null,
  WorkItemLabelsEditor: ({ editable }: { editable: boolean }) => (
    <button type="button" aria-label="Manage labels" disabled={!editable}>
      Manage labels
    </button>
  ),
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
  CalendarBlank: () => null,
  CaretDown: () => null,
  CaretRight: () => null,
  Clock: () => null,
  DotsThree: () => null,
  Flag: () => null,
  FolderSimple: () => null,
  LinkSimple: () => null,
  NotePencil: () => null,
  PaperPlaneTilt: () => null,
  Plus: () => null,
  SidebarSimple: () => null,
  Smiley: () => null,
  Tag: () => null,
  Trash: () => null,
  X: () => null,
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
      {
        id: "document_2",
        kind: "item-description",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Follow up",
        content: "<p>Second description</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: ["item_2"],
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
      {
        id: "item_2",
        key: "PLA-2",
        teamId: "team_1",
        type: "task",
        title: "Follow up",
        descriptionDocId: "document_2",
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
    syncUpdateWorkItemMock.mockReset()
    syncHeartbeatWorkItemPresenceMock.mockResolvedValue([])
    syncClearWorkItemPresenceMock.mockResolvedValue({ ok: true })
    syncUpdateWorkItemMock.mockResolvedValue({ ok: true })
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

  it("preserves mention retries for one item when saving a different item without mentions", async () => {
    let saveCount = 0
    const saveWorkItemMainSectionMock = vi.fn().mockImplementation(
      async ({
        itemId,
        description,
        title,
      }: {
        itemId: string
        description: string
        title: string
      }) => {
        saveCount += 1
        const documentId = itemId === "item_1" ? "document_1" : "document_2"

        useAppStore.setState((state) => ({
          workItems: state.workItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  title,
                  updatedAt: `2026-04-18T10:00:${saveCount.toString().padStart(2, "0")}.000Z`,
                }
              : item
          ),
          documents: state.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  content: description,
                  updatedAt: `2026-04-18T10:00:${saveCount.toString().padStart(2, "0")}.000Z`,
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

    const { rerender } = render(<WorkItemDetailScreen itemId="item_1" />)

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

    rerender(<WorkItemDetailScreen itemId="item_2" />)

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByDisplayValue("Follow up"), {
      target: { value: "Follow up updated" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByRole("button", { name: "Edit" })
    ).toBeInTheDocument()

    rerender(<WorkItemDetailScreen itemId="item_1" />)

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

  it("clears mention retries when the server reports they were already delivered", async () => {
    const saveWorkItemMainSectionMock = vi.fn().mockResolvedValue(true)
    syncSendItemDescriptionMentionNotificationsMock.mockRejectedValue(
      new RouteMutationError(
        "One or more mentioned users were already notified for this work item",
        409,
        {
          code: "ITEM_DESCRIPTION_MENTION_ALREADY_SENT",
        }
      )
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

    expect(
      await screen.findByRole("button", { name: "Edit" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("keeps sidebar properties editable for root and child items without entering main edit mode", async () => {
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        documents: [
          ...state.documents,
          {
            id: "document_3",
            kind: "item-description",
            workspaceId: "workspace_1",
            teamId: "team_1",
            title: "Child item",
            content: "<p>Child description</p>",
            linkedProjectIds: [],
            linkedWorkItemIds: ["item_3"],
            createdBy: "user_1",
            updatedBy: "user_1",
            createdAt: "2026-04-18T10:00:00.000Z",
            updatedAt: "2026-04-18T10:00:00.000Z",
          },
        ],
        workItems: [
          ...state.workItems,
          {
            id: "item_3",
            key: "PLA-3",
            teamId: "team_1",
            type: "sub-task",
            title: "Child item",
            descriptionDocId: "document_3",
            status: "todo",
            priority: "medium",
            assigneeId: null,
            creatorId: "user_1",
            parentId: "item_1",
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
      }))
    })

    const { rerender } = render(<WorkItemDetailScreen itemId="item_1" />)

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Status" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Priority" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Assignee" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Project" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Start" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Due" })).not.toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Manage labels" })
    ).not.toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Status" }))
    fireEvent.click(await screen.findByRole("button", { name: /backlog/i }))
    expect(
      useAppStore.getState().workItems.find((item) => item.id === "item_1")?.status
    ).toBe("backlog")

    fireEvent.click(screen.getByRole("button", { name: "Priority" }))
    fireEvent.click(await screen.findByRole("button", { name: /high/i }))
    expect(
      useAppStore.getState().workItems.find((item) => item.id === "item_1")
        ?.priority
    ).toBe("high")

    rerender(<WorkItemDetailScreen itemId="item_3" />)

    expect(screen.getByRole("button", { name: "Status" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Priority" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Assignee" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Parent" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Project" })).not.toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Assignee" }))
    fireEvent.click(await screen.findByRole("button", { name: /^Alex$/ }))
    expect(
      useAppStore.getState().workItems.find((item) => item.id === "item_3")
        ?.assigneeId
    ).toBe("user_1")
  })

  it("posts activity comments on Enter and preserves mentions", () => {
    act(() => {
      useAppStore.setState((state) => ({
        teamMemberships: [
          ...state.teamMemberships,
          {
            teamId: "team_1",
            userId: "user_2",
            role: "member",
          },
        ],
      }))
    })

    render(<WorkItemDetailScreen itemId="item_1" />)

    const commentEditor = screen.getByLabelText(
      "Leave a comment or mention a teammate with @handle..."
    )
    fireEvent.change(commentEditor, {
      target: {
        value:
          '<p>Heads up <span data-type="mention" data-id="user_2">@Taylor</span></p>',
      },
    })
    fireEvent.keyDown(commentEditor, {
      key: "Enter",
    })

    const [comment] = useAppStore.getState().comments
    expect(comment).toMatchObject({
      targetType: "workItem",
      targetId: "item_1",
      mentionUserIds: ["user_2"],
    })
    expect(comment.content).toContain('data-id="user_2"')
  })
})
