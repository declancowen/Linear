import { act, renderHook, waitFor } from "@testing-library/react"
import type { JSONContent } from "@tiptap/core"
import { StrictMode, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_COLLABORATION_LIMITS } from "@/lib/collaboration/limits"
import type {
  CollaborationStatusChange,
  CollaborationTransportSession,
} from "@/lib/collaboration/transport"

const bootstrapContentJson: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Hello",
        },
      ],
    },
  ],
}

const openDocumentCollaborationSessionMock = vi.hoisted(() => vi.fn())
const createPartyKitCollaborationAdapterMock = vi.hoisted(() => vi.fn())
const isCollaborationEnabledMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportCollaborationSessionDiagnostic: vi.fn(),
  reportRealtimeFallbackDiagnostic: vi.fn(),
}))

vi.mock("@/lib/collaboration/adapters/partykit", () => ({
  createPartyKitCollaborationAdapter: createPartyKitCollaborationAdapterMock,
}))

vi.mock("@/lib/collaboration/client-session", () => ({
  openDocumentCollaborationSession: openDocumentCollaborationSessionMock,
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  isCollaborationEnabled: isCollaborationEnabledMock,
}))

function createSession() {
  const provider = {
    wsconnected: true,
    on: vi.fn(),
    off: vi.fn(),
  }

  const session: CollaborationTransportSession<
    {
      userId: string
      sessionId: string
      name: string
      avatarUrl: string | null
      color: string | null
      typing: boolean
      activeBlockId: string | null
      cursor: { anchor: number; head: number } | null
      selection: { anchor: number; head: number } | null
      cursorSide: "before" | "after" | null
    },
    {
      doc: never
      provider: typeof provider
    }
  > = {
    binding: {
      doc: {} as never,
      provider,
    },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    updateLocalAwareness: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    onStatusChange: vi.fn(() => vi.fn()),
    onAwarenessChange: vi.fn(() => vi.fn()),
  }

  return session
}

function createOpenSessionResult(
  session: ReturnType<typeof createSession>,
  bootstrapOverrides: Record<string, unknown> = {}
) {
  return {
    bootstrap: {
      roomId: "doc:document_1",
      documentId: "document_1",
      token: "token",
      serviceUrl: "https://collab.example.com",
      role: "editor" as const,
      sessionId: "session_1",
      protocolVersion: 1,
      schemaVersion: 1,
      limits: DEFAULT_COLLABORATION_LIMITS,
      expiresAt: Date.now() + 60_000,
      bodySource: "convex-html" as const,
      contentJson: bootstrapContentJson,
      ...bootstrapOverrides,
    },
    session,
  }
}

function mockOpenSession(
  session: ReturnType<typeof createSession>,
  bootstrapOverrides: Record<string, unknown> = {}
) {
  openDocumentCollaborationSessionMock.mockResolvedValue(
    createOpenSessionResult(session, bootstrapOverrides)
  )
}

function mockMigratedOpenSession(session: ReturnType<typeof createSession>) {
  mockOpenSession(session, {
    bodySource: "cloudflare-yjs",
    contentJson: bootstrapContentJson,
    contentHtml: "<p>Hello</p>",
  })
}

function delaySessionConnect(session: ReturnType<typeof createSession>) {
  let resolveConnect: (() => void) | null = null

  session.connect = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveConnect = resolve
      })
  )

  return {
    resolve() {
      act(() => {
        resolveConnect?.()
      })
    },
  }
}

function createSameUserAwareness(activeBlockId = "paragraph:1") {
  const baseAwareness = {
    userId: "user_1",
    name: "Alex",
    avatarUrl: "https://example.com/avatar.png",
    color: "#123456",
    typing: false,
    cursor: null,
    selection: null,
    cursorSide: null,
  }

  return {
    local: {
      ...baseAwareness,
      sessionId: "session_1",
      activeBlockId: "paragraph:1",
    },
    remote: [
      {
        ...baseAwareness,
        sessionId: "session_2",
        activeBlockId,
      },
    ],
  }
}

async function renderCollaborationHook(
  options: {
    avatarImageUrl?: string | null
    enabled?: boolean
  } = {}
) {
  const { useDocumentCollaboration } =
    await import("@/hooks/use-document-collaboration")

  return renderHook(() =>
    useDocumentCollaboration({
      documentId: "document_1",
      enabled: options.enabled ?? true,
      currentUser: {
        id: "user_1",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl:
          options.avatarImageUrl ?? "https://example.com/avatar.png",
      },
    })
  )
}

type CollaborationHookResult = Awaited<
  ReturnType<typeof renderCollaborationHook>
>["result"]

function captureSessionStatusChanges(
  session: ReturnType<typeof createSession>
) {
  let statusListener: ((change: CollaborationStatusChange) => void) | null =
    null

  session.onStatusChange = vi.fn((listener) => {
    statusListener = listener
    return vi.fn()
  })

  return {
    emit(change: CollaborationStatusChange) {
      act(() => {
        statusListener?.(change)
      })
    },
  }
}

function captureSessionAwarenessChanges(
  session: ReturnType<typeof createSession>
) {
  let awarenessListener:
    | Parameters<typeof session.onAwarenessChange>[0]
    | null = null

  session.onAwarenessChange = vi.fn((listener) => {
    awarenessListener = listener
    return vi.fn()
  })

  return {
    emit(change: Parameters<NonNullable<typeof awarenessListener>>[0]) {
      act(() => {
        awarenessListener?.(change)
      })
    },
  }
}

async function expectBootstrappingCollaboration(
  result: CollaborationHookResult,
  options: {
    expectBootstrapContent?: boolean
  } = {}
) {
  await waitFor(() => {
    expect(result.current.lifecycle).toBe("bootstrapping")
    expect(result.current.editorCollaboration).not.toBeNull()
    if (options.expectBootstrapContent) {
      expect(result.current.bootstrapContent).toEqual(bootstrapContentJson)
    }
    expect(result.current.collaboration).toBeNull()
  })
}

async function expectAttachedCollaboration(result: CollaborationHookResult) {
  await waitFor(() => {
    expect(result.current.lifecycle).toBe("attached")
    expect(result.current.editorCollaboration).not.toBeNull()
    expect(result.current.collaboration).not.toBeNull()
  })
}

async function expectMigratedCollaborationHidden(
  result: CollaborationHookResult
) {
  await waitFor(() => {
    expect(result.current.lifecycle).toBe("bootstrapping")
    expect(result.current.bootstrapContent).toBeNull()
    expect(result.current.editorCollaboration).toBeNull()
    expect(result.current.collaboration).toBeNull()
  })
}

describe("useDocumentCollaboration", () => {
  beforeEach(() => {
    vi.resetModules()
    openDocumentCollaborationSessionMock.mockReset()
    createPartyKitCollaborationAdapterMock.mockReset()
    isCollaborationEnabledMock.mockReset()

    isCollaborationEnabledMock.mockReturnValue(true)
    createPartyKitCollaborationAdapterMock.mockReturnValue({})
  })

  it("updates local awareness in place when avatar data changes", async () => {
    const session = createSession()

    mockOpenSession(session)

    const { useDocumentCollaboration } =
      await import("@/hooks/use-document-collaboration")

    const { rerender } = renderHook(
      ({ avatarImageUrl }: { avatarImageUrl: string | null }) =>
        useDocumentCollaboration({
          documentId: "document_1",
          enabled: true,
          currentUser: {
            id: "user_1",
            name: "Alex",
            avatarUrl: "",
            avatarImageUrl,
          },
        }),
      {
        initialProps: {
          avatarImageUrl: "https://example.com/avatar-1.png",
        },
      }
    )

    await waitFor(() => {
      expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(1)
      expect(session.connect).toHaveBeenCalledTimes(1)
    })

    expect(session.updateLocalAwareness).toHaveBeenCalledTimes(1)

    rerender({
      avatarImageUrl: "https://example.com/avatar-2.png",
    })

    await waitFor(() => {
      expect(session.updateLocalAwareness).toHaveBeenCalledTimes(2)
    })

    expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(1)
    expect(session.disconnect).not.toHaveBeenCalled()
    expect(session.flush).not.toHaveBeenCalled()
    expect(session.updateLocalAwareness).toHaveBeenLastCalledWith(
      expect.objectContaining({
        avatarUrl: "https://example.com/avatar-2.png",
        name: "Alex",
        userId: "user_1",
      })
    )
  })

  it("classifies expected collaboration outages and applies synced state safely", async () => {
    const { getSyncedCollaborationState, isExpectedCollaborationUnavailable } =
      await import("@/hooks/document-collaboration-state")
    const { RouteMutationError } = await import("@/lib/convex/client")
    const session = createSession()
    const bootstrap = createOpenSessionResult(session).bootstrap
    const collaborationState = {
      provider: session.binding.provider,
    }
    const current = {
      documentId: "document_1",
      error: new Error("stale"),
      hasAttachedOnce: false,
      role: null,
      connectionState: "connecting",
      session,
      editorCollaboration: null,
      collaboration: null,
      bodySource: null,
      bootstrapContent: null,
      viewers: [],
    }

    expect(
      isExpectedCollaborationUnavailable(
        new Error("Collaboration service must use HTTPS/WSS")
      )
    ).toBe(true)
    expect(
      isExpectedCollaborationUnavailable(
        new RouteMutationError("unavailable", 503)
      )
    ).toBe(true)
    expect(isExpectedCollaborationUnavailable(new Error("boom"))).toBe(false)
    expect(
      getSyncedCollaborationState(current as never, {
        bootstrap,
        bootstrapContent: bootstrapContentJson,
        collaborationState: collaborationState as never,
        session: session as never,
      })
    ).toMatchObject({
      error: null,
      hasAttachedOnce: true,
      role: "editor",
      bodySource: "convex-html",
      editorCollaboration: collaborationState,
      collaboration: collaborationState,
      bootstrapContent: bootstrapContentJson,
    })
    expect(
      getSyncedCollaborationState(current as never, {
        bootstrap,
        bootstrapContent: null,
        collaborationState: collaborationState as never,
        session: createSession() as never,
      })
    ).toBe(current)
  })

  it("does not expose Convex bootstrap content for migrated Cloudflare Yjs documents", async () => {
    const session = createSession()
    mockMigratedOpenSession(session)

    const { result } = await renderCollaborationHook()

    await waitFor(() => {
      expect(result.current.editorCollaboration).not.toBeNull()
      expect(result.current.bootstrapContent).toBeNull()
    })
  })

  it("waits for synced provider state before exposing migrated Cloudflare Yjs editor bindings", async () => {
    const session = createSession()
    const connect = delaySessionConnect(session)
    mockMigratedOpenSession(session)

    const { result } = await renderCollaborationHook()

    await expectMigratedCollaborationHidden(result)

    connect.resolve()

    await expectAttachedCollaboration(result)
  })

  it("keeps migrated Cloudflare Yjs editor bindings hidden when websocket connects before provider sync", async () => {
    const session = createSession()
    const statusChanges = captureSessionStatusChanges(session)
    const connect = delaySessionConnect(session)

    session.binding.provider.wsconnected = false
    mockMigratedOpenSession(session)

    const { result } = await renderCollaborationHook()

    await waitFor(() => expect(session.connect).toHaveBeenCalledTimes(1))
    await expectMigratedCollaborationHidden(result)

    session.binding.provider.wsconnected = true
    statusChanges.emit({
      state: "connected",
    })

    await waitFor(() =>
      expect(result.current.connectionState).toBe("connected")
    )
    await expectMigratedCollaborationHidden(result)

    connect.resolve()

    await expectAttachedCollaboration(result)
  })

  it("does not issue duplicate session bootstraps during Strict Mode effect probing", async () => {
    const session = createSession()

    mockOpenSession(session)

    const { useDocumentCollaboration } =
      await import("@/hooks/use-document-collaboration")

    renderHook(
      () =>
        useDocumentCollaboration({
          documentId: "document_1",
          enabled: true,
          currentUser: {
            id: "user_1",
            name: "Alex",
            avatarUrl: "",
            avatarImageUrl: null,
          },
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      }
    )

    await waitFor(() => {
      expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(1)
      expect(session.connect).toHaveBeenCalledTimes(1)
    })
  })

  it("clears stale collaboration state before re-enabling the same document", async () => {
    const firstSession = createSession()

    let resolveSecondOpen:
      | ((value: ReturnType<typeof createOpenSessionResult>) => void)
      | null = null

    openDocumentCollaborationSessionMock
      .mockResolvedValueOnce(createOpenSessionResult(firstSession))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondOpen = resolve
          })
      )

    const { useDocumentCollaboration } =
      await import("@/hooks/use-document-collaboration")

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useDocumentCollaboration({
          documentId: "document_1",
          enabled,
          currentUser: {
            id: "user_1",
            name: "Alex",
            avatarUrl: "",
            avatarImageUrl: "https://example.com/avatar.png",
          },
        }),
      {
        initialProps: {
          enabled: true,
        },
      }
    )

    await waitFor(() => {
      expect(result.current.mode).toBe("collaboration")
      expect(result.current.collaboration).not.toBeNull()
    })

    rerender({
      enabled: false,
    })

    await waitFor(() => {
      expect(result.current.mode).toBe("legacy")
      expect(result.current.collaboration).toBeNull()
    })

    rerender({
      enabled: true,
    })

    await waitFor(() => {
      expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(2)
      expect(result.current.lifecycle).toBe("bootstrapping")
      expect(result.current.collaboration).toBeNull()
      expect(result.current.viewers).toEqual([])
    })

    expect(firstSession.disconnect).toHaveBeenCalled()
    expect(resolveSecondOpen).not.toBeNull()
  })

  it("exposes editor collaboration state during bootstrapping before attach completes", async () => {
    const session = createSession()
    const connect = delaySessionConnect(session)

    mockOpenSession(session)

    const { result } = await renderCollaborationHook()

    await expectBootstrappingCollaboration(result, {
      expectBootstrapContent: true,
    })

    connect.resolve()

    await expectAttachedCollaboration(result)
  })

  it("keeps collaboration bootstrapping until the websocket transport is connected", async () => {
    const session = createSession()
    const statusChanges = captureSessionStatusChanges(session)

    session.binding.provider.wsconnected = false

    mockOpenSession(session)

    const { result } = await renderCollaborationHook()

    await expectBootstrappingCollaboration(result)

    session.binding.provider.wsconnected = true
    statusChanges.emit({
      state: "connected",
    })

    await expectAttachedCollaboration(result)
  })

  it("ignores unchanged awareness heartbeats from duplicate same-user sessions", async () => {
    const session = createSession()
    const awarenessChanges = captureSessionAwarenessChanges(session)

    mockOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectAttachedCollaboration(result)

    awarenessChanges.emit(createSameUserAwareness())

    await waitFor(() => {
      expect(result.current.viewers).toHaveLength(2)
    })

    const firstViewers = result.current.viewers

    awarenessChanges.emit(createSameUserAwareness())

    expect(result.current.viewers).toBe(firstViewers)

    awarenessChanges.emit(createSameUserAwareness("paragraph:2"))

    expect(result.current.viewers).not.toBe(firstViewers)
    expect(result.current.viewers[1]?.activeBlockId).toBe("paragraph:2")
  })

  it("does not attach collaboration early when initial sync times out", async () => {
    const session = createSession()

    session.connect = vi
      .fn()
      .mockRejectedValue(
        new Error("Timed out waiting for collaboration document sync")
      )

    mockOpenSession(session)

    const { result } = await renderCollaborationHook()

    await expectBootstrappingCollaboration(result)
  })

  it("keeps migrated Cloudflare Yjs documents protected when initial sync times out", async () => {
    const session = createSession()

    session.connect = vi
      .fn()
      .mockRejectedValue(
        new Error("Timed out waiting for collaboration document sync")
      )

    mockMigratedOpenSession(session)

    const { result } = await renderCollaborationHook()

    await expectMigratedCollaborationHidden(result)
    expect(result.current.mode).toBe("legacy")
    await waitFor(() => {
      expect(result.current.error).toBe(
        "Timed out waiting for collaboration document sync"
      )
    })
    expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(1)
    expect(session.disconnect).not.toHaveBeenCalledWith(
      expect.stringContaining("connect-failed")
    )
  })

  it("keeps migrated Cloudflare Yjs documents protected after exhausted connection failures", async () => {
    const session = createSession()

    session.connect = vi.fn().mockRejectedValue(new Error("Provider unavailable"))

    mockMigratedOpenSession(session)

    const { result } = await renderCollaborationHook()

    await waitFor(
      () => {
        expect(openDocumentCollaborationSessionMock).toHaveBeenCalledTimes(3)
      },
      {
        timeout: 3_000,
      }
    )
    await expectMigratedCollaborationHidden(result)
    expect(result.current.error).toBe("Provider unavailable")
    expect(result.current.mode).toBe("legacy")
  })

  it("degrades out of collaboration when an attached session disconnects", async () => {
    const session = createSession()
    const statusChanges = captureSessionStatusChanges(session)

    mockOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectAttachedCollaboration(result)

    statusChanges.emit({
      state: "disconnected",
      reason: "document-missing",
    })

    await waitFor(() => {
      expect(result.current.lifecycle).toBe("degraded")
      expect(result.current.collaboration).toBeNull()
      expect(result.current.mode).toBe("legacy")
    })
  })

  it("keeps migrated Cloudflare Yjs documents protected when an attached session disconnects", async () => {
    const session = createSession()
    const statusChanges = captureSessionStatusChanges(session)

    mockMigratedOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectAttachedCollaboration(result)

    statusChanges.emit({
      state: "disconnected",
      reason: "document-missing",
    })

    await expectMigratedCollaborationHidden(result)
    expect(result.current.mode).toBe("legacy")
  })

  it("surfaces reload-required collaboration errors from structured status changes", async () => {
    const session = createSession()
    const statusChanges = captureSessionStatusChanges(session)

    mockOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectAttachedCollaboration(result)

    statusChanges.emit({
      state: "errored",
      reason: "This page is out of date. Reload to continue editing.",
      code: "collaboration_schema_version_unsupported",
      reloadRequired: true,
    })

    await waitFor(() => {
      expect(result.current.lifecycle).toBe("degraded")
      expect(result.current.error).toBe(
        "This page is out of date. Reload to continue editing."
      )
    })
  })

  it("does not use teardown-content flush when unmounted before attach completes", async () => {
    const session = createSession()

    session.connect = vi.fn(
      () =>
        new Promise<void>(() => {
          // Keep the collaboration session in the bootstrapping state.
        })
    )

    mockOpenSession(session)
    const { result, unmount } = await renderCollaborationHook()

    await expectBootstrappingCollaboration(result, {
      expectBootstrapContent: true,
    })

    unmount()

    await waitFor(() => {
      expect(session.disconnect).toHaveBeenCalledWith("component-unmount")
    })
    expect(session.flush).not.toHaveBeenCalled()
  })

  it("does not use teardown-content flush on pagehide before attach completes", async () => {
    const session = createSession()

    session.connect = vi.fn(
      () =>
        new Promise<void>(() => {
          // Keep the collaboration session in the bootstrapping state.
        })
    )

    mockOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectBootstrappingCollaboration(result, {
      expectBootstrapContent: true,
    })

    act(() => {
      window.dispatchEvent(new Event("pagehide"))
    })

    expect(session.flush).not.toHaveBeenCalled()
  })

  it("uses teardown-content flush when the attached editor session unmounts", async () => {
    const session = createSession()

    mockOpenSession(session)
    const { unmount } = await renderCollaborationHook()

    await waitFor(() => {
      expect(session.connect).toHaveBeenCalledTimes(1)
    })

    unmount()

    await waitFor(() => {
      expect(session.flush).toHaveBeenCalledWith({
        kind: "teardown-content",
      })
      expect(session.disconnect).toHaveBeenCalledWith("component-unmount")
    })
  })

  it("uses teardown-content flush on pagehide for attached editor sessions", async () => {
    const session = createSession()

    mockOpenSession(session)
    const { result } = await renderCollaborationHook()

    await expectAttachedCollaboration(result)

    act(() => {
      window.dispatchEvent(new Event("pagehide"))
    })

    await waitFor(() => {
      expect(session.flush).toHaveBeenCalledWith({
        kind: "teardown-content",
      })
    })
  })
})
