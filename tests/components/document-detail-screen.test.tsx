import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

const {
  routerPushMock,
  syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresenceMock,
  syncSendDocumentMentionNotificationsMock,
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  syncClearDocumentPresenceMock: vi.fn(),
  syncHeartbeatDocumentPresenceMock: vi.fn(),
  syncSendDocumentMentionNotificationsMock: vi.fn(),
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
    push: routerPushMock,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncClearDocumentPresence: syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresence: syncHeartbeatDocumentPresenceMock,
  syncSendDocumentMentionNotifications: syncSendDocumentMentionNotificationsMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    onMentionInserted,
  }: {
    content: string
    onChange: (content: string) => void
    onMentionInserted?: (candidate: { id: string }) => void
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange(
          [
            content,
            '<span class="editor-mention" data-type="mention" data-id="user_2">@sam</span>',
          ].join("")
        )
        onMentionInserted?.({ id: "user_2" })
      }}
    >
      Insert mention
    </button>
  ),
}))

vi.mock("@/components/app/screens/helpers", () => ({
  canEditDocumentInUi: () => true,
  getDocumentPresenceSessionId: () => "session_1",
}))

vi.mock("@/components/app/screens/document-ui", () => ({
  DocumentPresenceAvatarGroup: () => null,
}))

vi.mock("@/components/app/screens/shared", () => ({
  MissingState: ({ title }: { title: string }) => <div>{title}</div>,
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: ReactNode
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}))

vi.mock("@phosphor-icons/react", () => ({
  Trash: () => null,
}))

const currentUser = {
  id: "user_1",
  name: "Alex",
  handle: "alex",
  email: "alex@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Founder",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const mentionedUser = {
  id: "user_2",
  name: "Sam",
  handle: "sam",
  email: "sam@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Engineer",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

describe("DocumentDetailScreen", () => {
  beforeEach(() => {
    routerPushMock.mockReset()
    syncClearDocumentPresenceMock.mockReset()
    syncHeartbeatDocumentPresenceMock.mockReset()
    syncSendDocumentMentionNotificationsMock.mockReset()
    syncClearDocumentPresenceMock.mockResolvedValue(undefined)
    syncHeartbeatDocumentPresenceMock.mockResolvedValue([])
    syncSendDocumentMentionNotificationsMock.mockResolvedValue({
      ok: true,
      recipientCount: 1,
      mentionCount: 1,
    })
    window.history.replaceState({ page: "doc" }, "", "/docs/doc_1")

    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: currentUser.id,
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "acme",
          name: "Acme",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: currentUser.id,
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "admin",
        },
        {
          workspaceId: "workspace_1",
          userId: mentionedUser.id,
          role: "member",
        },
      ],
      teams: [],
      teamMemberships: [],
      users: [currentUser, mentionedUser],
      documents: [
        {
          id: "doc_1",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Launch Notes",
          content:
            '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span></p>',
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-17T10:00:00.000Z",
          updatedAt: "2026-04-17T10:00:00.000Z",
        },
      ],
    })
  })

  it("opens the exit dialog when browser history navigation is attempted with pending mentions", async () => {
    const historyBackSpy = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined)

    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))

    expect(screen.getByText("Send mention notifications")).toBeInTheDocument()
    expect(
      screen.getByText(
        "1 mention across 1 person are ready to send for this document."
      )
    ).toBeInTheDocument()

    await act(async () => {
      window.history.replaceState({ page: "docs" }, "", "/workspace/docs")
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: { page: "docs" } })
      )
    })

    expect(window.location.pathname).toBe("/docs/doc_1")
    await waitFor(() => {
      expect(
        screen.getByText("Exit before sending notifications?")
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Skip notifications" }))

    expect(historyBackSpy).toHaveBeenCalledTimes(1)

    historyBackSpy.mockRestore()
  })
})
