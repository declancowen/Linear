import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

const {
  fetchSnapshotMock,
  flushDocumentSyncMock,
  routerPushMock,
  syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresenceMock,
  syncUpdateDocumentMock,
  syncSendDocumentMentionNotificationsMock,
} = vi.hoisted(() => ({
  fetchSnapshotMock: vi.fn(),
  flushDocumentSyncMock: vi.fn(),
  routerPushMock: vi.fn(),
  syncClearDocumentPresenceMock: vi.fn(),
  syncHeartbeatDocumentPresenceMock: vi.fn(),
  syncUpdateDocumentMock: vi.fn(),
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
  fetchSnapshot: fetchSnapshotMock,
  syncClearDocumentPresence: syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresence: syncHeartbeatDocumentPresenceMock,
  syncSendDocumentMentionNotifications: syncSendDocumentMentionNotificationsMock,
  syncUpdateDocument: syncUpdateDocumentMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    onMentionCountsChange,
  }: {
    content: string
    onChange: (content: string) => void
    onMentionCountsChange?: (
      counts: Record<string, number>,
      source: "initial" | "local" | "external"
    ) => void
  }) => {
    function countMentions(nextContent: string) {
      const counts: Record<string, number> = {}
      const matches = nextContent.matchAll(/data-id="([^"]+)"/g)

      for (const match of matches) {
        const userId = match[1]

        if (!userId) {
          continue
        }

        counts[userId] = (counts[userId] ?? 0) + 1
      }

      return counts
    }

    function syncContent(nextContent: string) {
      onChange(nextContent)
      onMentionCountsChange?.(countMentions(nextContent), "local")
    }

    return (
      <>
        <button
          type="button"
          onClick={() => {
            const nextContent = [
              content,
              '<span class="editor-mention" data-type="mention" data-id="user_2">@sam</span>',
            ].join("")

            syncContent(nextContent)
          }}
        >
          Insert mention
        </button>
        <button
          type="button"
          onClick={() => {
            const nextContent = [
              content,
              '<span class="editor-mention" data-type="mention" data-id="user_1">@alex</span>',
            ].join("")

            syncContent(nextContent)
          }}
        >
          Insert self mention
        </button>
        <button
          type="button"
          onClick={() => {
            syncContent("<p></p>")
          }}
        >
          Clear mentions
        </button>
      </>
    )
  },
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
    fetchSnapshotMock.mockReset()
    flushDocumentSyncMock.mockReset()
    routerPushMock.mockReset()
    syncClearDocumentPresenceMock.mockReset()
    syncHeartbeatDocumentPresenceMock.mockReset()
    syncUpdateDocumentMock.mockReset()
    syncSendDocumentMentionNotificationsMock.mockReset()
    fetchSnapshotMock.mockResolvedValue(null)
    flushDocumentSyncMock.mockResolvedValue(undefined)
    syncClearDocumentPresenceMock.mockResolvedValue(undefined)
    syncHeartbeatDocumentPresenceMock.mockResolvedValue([])
    syncUpdateDocumentMock.mockResolvedValue(undefined)
    syncSendDocumentMentionNotificationsMock.mockResolvedValue({
      ok: true,
      recipientCount: 1,
      mentionCount: 1,
    })
    window.history.replaceState({ page: "doc" }, "", "/docs/doc_1")

    useAppStore.setState({
      ...createEmptyState(),
      flushDocumentSync: flushDocumentSyncMock,
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

  it("starts and clears document presence for editable documents", async () => {
    const { unmount } = render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1"
      )
    })

    unmount()

    await waitFor(() => {
      expect(syncClearDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1",
        {
          keepalive: true,
        }
      )
    })
  })

  it("refreshes document presence when the window regains focus", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1"
      )
    })

    syncHeartbeatDocumentPresenceMock.mockClear()

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1"
      )
    })
  })

  it("clears document presence when the page becomes hidden", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1"
      )
    })

    syncClearDocumentPresenceMock.mockClear()

    const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    )

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })

    try {
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"))
      })

      await waitFor(() => {
        expect(syncClearDocumentPresenceMock).toHaveBeenCalledWith(
          "doc_1",
          "session_1",
          {
            keepalive: true,
          }
        )
      })
    } finally {
      if (visibilityStateDescriptor) {
        Object.defineProperty(
          document,
          "visibilityState",
          visibilityStateDescriptor
        )
      } else {
        Reflect.deleteProperty(document, "visibilityState")
      }
    }
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

  it("hides the notification bar when all queued mentions are removed", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))

    expect(screen.getByText("Send mention notifications")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear mentions" }))

    await waitFor(() => {
      expect(
        screen.queryByText("Send mention notifications")
      ).not.toBeInTheDocument()
    })
  })

  it("ignores self mentions when another pending mention is already queued", () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))
    fireEvent.click(screen.getByRole("button", { name: "Insert self mention" }))

    expect(
      screen.getByText(
        "1 mention across 1 person are ready to send for this document."
      )
    ).toBeInTheDocument()
  })

  it("keeps later mentions queued when an earlier send completes", async () => {
    let resolveSend:
      | ((value: { ok: boolean; recipientCount: number; mentionCount: number }) => void)
      | null = null

    syncSendDocumentMentionNotificationsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )

    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))
    fireEvent.click(screen.getByRole("button", { name: "Send notifications" }))
    await waitFor(() => {
      expect(syncSendDocumentMentionNotificationsMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))

    await act(async () => {
      resolveSend?.({
        ok: true,
        recipientCount: 1,
        mentionCount: 1,
      })
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          "1 mention across 1 person are ready to send for this document."
        )
      ).toBeInTheDocument()
    })
  })

  it("flushes pending document sync before sending mention notifications", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))
    fireEvent.click(screen.getByRole("button", { name: "Send notifications" }))

    await waitFor(() => {
      expect(flushDocumentSyncMock).toHaveBeenCalledWith("doc_1")
    })
    expect(syncSendDocumentMentionNotificationsMock).toHaveBeenCalledWith(
      "doc_1",
      [
        {
          userId: "user_2",
          count: 1,
        },
      ]
    )
    expect(flushDocumentSyncMock.mock.invocationCallOrder[0]).toBeLessThan(
      syncSendDocumentMentionNotificationsMock.mock.invocationCallOrder[0]
    )
  })
})
