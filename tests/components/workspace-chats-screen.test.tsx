import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { WorkspaceChatsScreen } from "@/components/app/collaboration-screens/workspace-chats-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

const useScopedReadModelRefreshMock = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: useScopedReadModelRefreshMock,
}))

vi.mock("@/lib/convex/client", () => ({
  fetchConversationListReadModel: vi.fn(),
  fetchConversationThreadReadModel: vi.fn(),
}))

vi.mock("@/components/app/collaboration-screens/chat-thread", () => ({
  ChatThread: () => <div>Chat thread</div>,
}))

vi.mock("@/components/app/collaboration-screens/call-invite-launcher", () => ({
  CallInviteLauncher: () => null,
}))

vi.mock("@/components/app/collaboration-screens/shared-ui", () => ({
  ChatHeaderActions: ({
    detailsAction,
  }: {
    detailsAction?: ReactNode
  }) => <div>{detailsAction}</div>,
  DetailsSidebarToggle: () => null,
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: string
    description: string
    action?: ReactNode
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {action}
    </div>
  ),
  MembersSidebar: () => null,
  PageHeader: ({
    title,
    actions,
  }: {
    title: string
    actions?: ReactNode
  }) => (
    <div>
      <div>{title}</div>
      {actions}
    </div>
  ),
  SurfaceSidebarContent: () => null,
}))

vi.mock("@/components/app/collaboration-screens/workspace-chat-ui", () => ({
  WORKSPACE_CHAT_LIST_DEFAULT_WIDTH: 256,
  WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY: "workspace-chat-list-width",
  clampWorkspaceChatListWidth: (value: number) => value,
  ConversationList: () => <div>Conversation list</div>,
  CreateWorkspaceChatDialog: () => null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<"button"> & { children?: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe("WorkspaceChatsScreen", () => {
  beforeEach(() => {
    useScopedReadModelRefreshMock.mockReset()
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: false,
      refreshing: true,
    })

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      users: [
        {
          id: "user_1",
          name: "Alex Example",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Engineer",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          accountDeletionPendingAt: null,
          accountDeletedAt: null,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
      workspaces: [
        {
          id: "workspace_1",
          slug: "workspace-1",
          name: "Workspace 1",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_1",
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
    })
  })

  it("shows a loading state before the first conversation list fetch completes", () => {
    render(<WorkspaceChatsScreen />)

    expect(screen.getByText("Loading chats...")).toBeInTheDocument()
    expect(screen.queryByText("No chats yet")).not.toBeInTheDocument()
  })

  it("shows the empty state after the conversation list has loaded", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })

    render(<WorkspaceChatsScreen />)

    expect(screen.getByText("No chats yet")).toBeInTheDocument()
    expect(screen.queryByText("Loading chats...")).not.toBeInTheDocument()
  })
})
