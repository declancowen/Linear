import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import "@/tests/lib/fixtures/detail-screen-mocks"
import { DocumentDetailScreen } from "@/components/app/screens/document-detail-screen"
import { getAnchorInternalNavigationHref } from "@/components/app/screens/document-navigation"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

const {
  applyDocumentCollaborationTitleMock,
  collaborationEditorRunMock,
  fetchDocumentDetailReadModelMock,
  fetchSnapshotMock,
  flushDocumentSyncMock,
  flushCollaborationMock,
  renameDocumentMock,
  routerPushMock,
  syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresenceMock,
  syncUpdateDocumentMock,
  syncSendDocumentMentionNotificationsMock,
  richTextContentRenderMock,
  richTextEditorRenderMock,
  useDocumentCollaborationMock,
} = vi.hoisted(() => ({
  applyDocumentCollaborationTitleMock: vi.fn(),
  collaborationEditorRunMock: vi.fn(),
  fetchDocumentDetailReadModelMock: vi.fn(),
  fetchSnapshotMock: vi.fn(),
  flushDocumentSyncMock: vi.fn(),
  flushCollaborationMock: vi.fn(),
  renameDocumentMock: vi.fn(),
  routerPushMock: vi.fn(),
  syncClearDocumentPresenceMock: vi.fn(),
  syncHeartbeatDocumentPresenceMock: vi.fn(),
  syncUpdateDocumentMock: vi.fn(),
  syncSendDocumentMentionNotificationsMock: vi.fn(),
  richTextContentRenderMock: vi.fn(),
  richTextEditorRenderMock: vi.fn(),
  useDocumentCollaborationMock: vi.fn(),
}))

vi.mock("next/link", async () => {
  const { LinkStub } = await import("@/tests/lib/fixtures/component-stubs")

  return {
    default: LinkStub,
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}))

vi.mock("@/lib/convex/client", () => ({
  fetchDocumentDetailReadModel: fetchDocumentDetailReadModelMock,
  fetchSnapshot: fetchSnapshotMock,
  syncClearDocumentPresence: syncClearDocumentPresenceMock,
  syncHeartbeatDocumentPresence: syncHeartbeatDocumentPresenceMock,
  syncSendDocumentMentionNotifications: syncSendDocumentMentionNotificationsMock,
  syncUpdateDocument: syncUpdateDocumentMock,
}))

vi.mock("@/hooks/use-document-collaboration", () => ({
  useDocumentCollaboration: useDocumentCollaborationMock,
}))

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    collaboration,
    editable,
    editorInstanceRef,
    onChange,
    onMentionCountsChange,
  }: {
    content: string | Record<string, unknown>
    collaboration?: unknown
    editable?: boolean
    editorInstanceRef?: { current: unknown }
    onChange: (content: string) => void
    onMentionCountsChange?: (
      counts: Record<string, number>,
      source: "initial" | "local" | "external"
    ) => void
  }) => {
    richTextEditorRenderMock({
      collaboration,
      content,
      editable,
    })

    if (editorInstanceRef) {
      editorInstanceRef.current = {
        chain() {
          return {
            command() {
              return {
                run: collaborationEditorRunMock,
              }
            },
          }
        },
      }
    }

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

    function buildMentionContent(userId: string, count: number) {
      return Array.from(
        { length: count },
        () =>
          `<span class="editor-mention" data-type="mention" data-id="${userId}">@sam</span>`
      ).join("")
    }

    return (
      <div
        data-testid="rich-text-editor"
        data-collaboration={String(Boolean(collaboration))}
        data-editable={String(Boolean(editable))}
      >
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
        <button
          type="button"
          onClick={() => {
            const nextContent = buildMentionContent("user_2", 4)

            onChange(nextContent)
            onMentionCountsChange?.(countMentions(nextContent), "initial")
          }}
        >
          Sync initial mentions
        </button>
        <button
          type="button"
          onClick={() => {
            const nextContent = buildMentionContent("user_2", 4)

            onChange(nextContent)
            onMentionCountsChange?.(countMentions(nextContent), "external")
          }}
        >
          Sync external mentions
        </button>
        <button
          type="button"
          onClick={() => {
            const nextContent = buildMentionContent("user_2", 5)

            syncContent(nextContent)
          }}
        >
          Insert mention after sync
        </button>
      </div>
    )
  },
}))

vi.mock("@/components/app/rich-text-content", async () => {
  const { createRichTextContentStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    RichTextContent: createRichTextContentStub(richTextContentRenderMock),
  }
})

vi.mock("@/components/app/screens/helpers", () => ({
  canEditDocumentInUi: () => true,
  getDocumentPresenceSessionId: () => "session_1",
}))

async function withDocumentVisibilityState(
  visibilityState: DocumentVisibilityState,
  run: () => Promise<void>
) {
  const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState"
  )

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  })

  try {
    await run()
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
}

async function dispatchVisibilityChange() {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

vi.mock("@/components/app/screens/document-ui", async () => {
  const { DocumentPresenceAvatarGroupStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    DocumentPresenceAvatarGroup: DocumentPresenceAvatarGroupStub,
  }
})

vi.mock("@/components/app/screens/shared", async () => {
  const { MissingStateStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    MissingState: MissingStateStub,
  }
})

vi.mock("@/components/ui/button", async () => {
  const { ButtonStub } = await import("@/tests/lib/fixtures/component-stubs")

  return {
    Button: ButtonStub,
  }
})

vi.mock("@/components/ui/input", async () => {
  const { InputStub } = await import("@/tests/lib/fixtures/component-stubs")

  return {
    Input: InputStub,
  }
})

vi.mock("@/components/ui/sidebar", async () => {
  const { SidebarTriggerStub } = await import(
    "@/tests/lib/fixtures/component-stubs"
  )

  return {
    SidebarTrigger: SidebarTriggerStub,
  }
})

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

function queueMentionAfterSync(syncButtonName: string) {
  fireEvent.click(screen.getByRole("button", { name: syncButtonName }))
  expect(screen.queryByText("Send mention notifications")).toBeNull()
  fireEvent.click(
    screen.getByRole("button", {
      name: "Insert mention after sync",
    })
  )
}

function expectSentDocumentMention() {
  expect(syncSendDocumentMentionNotificationsMock).toHaveBeenCalledWith(
    "doc_1",
    [
      {
        userId: "user_2",
        count: 1,
      },
    ]
  )
}

async function waitForSentDocumentMention() {
  await waitFor(() => {
    expectSentDocumentMention()
  })
}

function renderAndSendDocumentMention() {
  render(<DocumentDetailScreen documentId="doc_1" />)
  fireEvent.click(screen.getByRole("button", { name: "Insert mention" }))
  fireEvent.click(screen.getByRole("button", { name: "Send notifications" }))
}

describe("document internal link navigation", () => {
  function createAnchor(href: string) {
    const anchor = document.createElement("a")
    anchor.setAttribute("href", href)
    return anchor
  }

  it("keeps only same-origin document links eligible for client navigation", () => {
    expect(getAnchorInternalNavigationHref(createAnchor(""))).toBeNull()
    expect(getAnchorInternalNavigationHref(createAnchor("#section"))).toBeNull()
    expect(
      getAnchorInternalNavigationHref(createAnchor("mailto:a@example.com"))
    ).toBeNull()
    expect(
      getAnchorInternalNavigationHref(createAnchor("tel:+15555550100"))
    ).toBeNull()
    expect(
      getAnchorInternalNavigationHref(createAnchor("https://example.com/docs"))
    ).toBeNull()
    expect(
      getAnchorInternalNavigationHref(
        createAnchor("/docs/doc_1?comment=comment_1#thread")
      )
    ).toBe("/docs/doc_1?comment=comment_1#thread")
  })
})

describe("DocumentDetailScreen", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    window.sessionStorage.clear()
    collaborationEditorRunMock.mockReset()
    collaborationEditorRunMock.mockReturnValue(true)
    fetchDocumentDetailReadModelMock.mockReset()
    fetchDocumentDetailReadModelMock.mockResolvedValue({})
    fetchSnapshotMock.mockReset()
    flushDocumentSyncMock.mockReset()
    flushCollaborationMock.mockReset()
    flushCollaborationMock.mockResolvedValue(undefined)
    renameDocumentMock.mockReset()
    applyDocumentCollaborationTitleMock.mockReset()
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
    richTextContentRenderMock.mockReset()
    richTextEditorRenderMock.mockReset()
    useDocumentCollaborationMock.mockReset()
    useDocumentCollaborationMock.mockReturnValue({
      bootstrapContent: null,
      editorCollaboration: null,
      collaboration: null,
      flush: flushCollaborationMock,
      lifecycle: "legacy",
      viewers: [],
    })
    window.history.replaceState({ page: "doc" }, "", "/docs/doc_1")

    useAppStore.setState({
      ...createEmptyState(),
      applyDocumentCollaborationTitle: applyDocumentCollaborationTitleMock,
      flushDocumentSync: flushDocumentSyncMock,
      renameDocument: renameDocumentMock,
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

  it("falls back to collaboration title persistence when collaborative title updates cannot update an h1 heading", async () => {
    collaborationEditorRunMock.mockReturnValue(false)
    useDocumentCollaborationMock.mockReturnValue({
      bootstrapContent: null,
      editorCollaboration: {} as never,
      collaboration: {} as never,
      flush: flushCollaborationMock,
      lifecycle: "attached",
      viewers: [],
    })

    render(<DocumentDetailScreen documentId="doc_1" />)

    fireEvent.click(screen.getByRole("button", { name: "Launch Notes" }))

    const input = screen.getByPlaceholderText(
      "Untitled document"
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: {
        value: "Renamed without heading",
      },
    })
    fireEvent.blur(input)

    expect(applyDocumentCollaborationTitleMock).toHaveBeenCalledWith(
      "doc_1",
      "Renamed without heading"
    )
    expect(flushCollaborationMock).toHaveBeenCalledWith({
      kind: "document-title",
      documentTitle: "Renamed without heading",
    })
    expect(renameDocumentMock).not.toHaveBeenCalled()
  })

  it("locks collaborative documents into a stable preview shell while bootstrapping", async () => {
    const bootstrapContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Boot content",
            },
          ],
        },
      ],
    }

    useDocumentCollaborationMock.mockReturnValue({
      bootstrapContent,
      editorCollaboration: {
        binding: {
          doc: {},
          provider: {},
        },
        localUser: {
          userId: "user_1",
          sessionId: "session_1",
          name: "Alex",
          avatarUrl: null,
          color: "#000000",
          typing: false,
          activeBlockId: null,
          cursor: null,
          selection: null,
          cursorSide: null,
        },
      },
      collaboration: null,
      flush: flushCollaborationMock,
      lifecycle: "bootstrapping",
      viewers: [],
    })

    render(<DocumentDetailScreen documentId="doc_1" />)

    expect(useDocumentCollaborationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc_1",
      })
    )
    expect(screen.queryByTestId("rich-text-editor")).toBeNull()
    expect(screen.getByTestId("rich-text-content")).toBeInTheDocument()
    expect(richTextEditorRenderMock).not.toHaveBeenCalled()
    expect(richTextContentRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content:
          "<p><span class=\"editor-mention\" data-type=\"mention\" data-id=\"user_2\">@sam</span></p>",
      })
    )
  })

  it("shows the initial collaboration sync modal only once per document session", async () => {
    useDocumentCollaborationMock.mockReturnValue({
      bootstrapContent: null,
      editorCollaboration: {
        binding: {
          doc: {},
          provider: {},
        },
        localUser: {
          userId: "user_1",
          sessionId: "session_1",
          name: "Alex",
          avatarUrl: null,
          color: "#000000",
          typing: false,
          activeBlockId: null,
          cursor: null,
          selection: null,
          cursorSide: null,
        },
      },
      collaboration: null,
      flush: flushCollaborationMock,
      lifecycle: "bootstrapping",
      viewers: [],
    })

    const { unmount } = render(<DocumentDetailScreen documentId="doc_1" />)

    expect(
      screen.getByText(
        "Loading the latest document state. Editing will unlock automatically in a moment."
      )
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        window.sessionStorage.getItem(
          "linear:collaboration:document-sync-modal-seen:doc_1"
        )
      ).toBe("true")
    })

    unmount()
    render(<DocumentDetailScreen documentId="doc_1" />)

    expect(
      screen.queryByText(
        "Loading the latest document state. Editing will unlock automatically in a moment."
      )
    ).toBeNull()
  })

  it("starts and clears document presence for editable documents", async () => {
    const { unmount } = render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1",
        null
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
        "session_1",
        null
      )
    })

    syncHeartbeatDocumentPresenceMock.mockClear()

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1",
        null
      )
    })
  })

  it("can transition from a missing document to a loaded document without hook-order errors", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    fetchDocumentDetailReadModelMock.mockResolvedValue({
      documents: [
        {
          id: "doc_async",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Async Doc",
          content: "<p>Hello</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-17T10:00:00.000Z",
          updatedAt: "2026-04-17T10:00:00.000Z",
        },
      ],
    })

    useAppStore.setState({
      ...useAppStore.getState(),
      documents: [],
    })

    render(<DocumentDetailScreen documentId="doc_async" />)

    expect(screen.getByText("Loading document...")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Async Doc" })).toBeInTheDocument()
    })

    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        typeof message === "string" &&
        message.includes("change in the order of Hooks called by DocumentDetailScreen")
      )
    ).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it("clears document presence when the page becomes hidden", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1",
        null
      )
    })

    syncClearDocumentPresenceMock.mockClear()

    await withDocumentVisibilityState("hidden", async () => {
      await dispatchVisibilityChange()
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
  })

  it("does not resume document presence while hidden when connectivity returns", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    await waitFor(() => {
      expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledWith(
        "doc_1",
        "session_1",
        null
      )
    })

    await withDocumentVisibilityState("hidden", async () => {
      await dispatchVisibilityChange()
      syncHeartbeatDocumentPresenceMock.mockClear()

      await act(async () => {
        window.dispatchEvent(new Event("online"))
      })

      expect(syncHeartbeatDocumentPresenceMock).not.toHaveBeenCalled()
    })
  })

  it("does not restart heartbeat polling after leaving with an in-flight heartbeat", async () => {
    vi.useFakeTimers()

    let resolveHeartbeat: ((viewers: []) => void) | null = null
    syncHeartbeatDocumentPresenceMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHeartbeat = resolve as (viewers: []) => void
        })
    )

    render(<DocumentDetailScreen documentId="doc_1" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(syncHeartbeatDocumentPresenceMock).toHaveBeenCalledTimes(1)

    await withDocumentVisibilityState("hidden", async () => {
      await dispatchVisibilityChange()
      syncHeartbeatDocumentPresenceMock.mockClear()

      await act(async () => {
        resolveHeartbeat?.([])
        await Promise.resolve()
      })

      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })

      expect(syncHeartbeatDocumentPresenceMock).not.toHaveBeenCalled()
    })
  })

  it("does not show stale viewers when a hidden in-flight heartbeat resolves", async () => {
    let resolveHeartbeat:
      | ((viewers: Array<{ name: string; userId: string; avatarUrl: string; lastSeenAt: string }>) => void)
      | null = null
    syncHeartbeatDocumentPresenceMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHeartbeat = resolve as typeof resolveHeartbeat
        })
    )

    render(<DocumentDetailScreen documentId="doc_1" />)

    await act(async () => {
      await Promise.resolve()
    })

    await withDocumentVisibilityState("hidden", async () => {
      await dispatchVisibilityChange()
      await act(async () => {
        resolveHeartbeat?.([
          {
            userId: "workos_2",
            name: "Sam",
            avatarUrl: "SS",
            lastSeenAt: new Date().toISOString(),
          },
        ])
        await Promise.resolve()
      })

      expect(screen.queryByText("Sam")).not.toBeInTheDocument()
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

  it("does not include externally synced mentions in a later notification batch", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    queueMentionAfterSync("Sync external mentions")

    expect(
      screen.getByText(
        "1 mention across 1 person are ready to send for this document."
      )
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Send notifications" }))

    await waitForSentDocumentMention()
  })

  it("does not include initially hydrated mentions in a later notification batch", async () => {
    render(<DocumentDetailScreen documentId="doc_1" />)

    queueMentionAfterSync("Sync initial mentions")

    fireEvent.click(screen.getByRole("button", { name: "Send notifications" }))

    await waitForSentDocumentMention()
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

    renderAndSendDocumentMention()
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
    renderAndSendDocumentMention()

    await waitFor(() => {
      expect(flushDocumentSyncMock).toHaveBeenCalledWith("doc_1")
    })
    expectSentDocumentMention()
    expect(flushDocumentSyncMock.mock.invocationCallOrder[0]).toBeLessThan(
      syncSendDocumentMentionNotificationsMock.mock.invocationCallOrder[0]
    )
  })
})
