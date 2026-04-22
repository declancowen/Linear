import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CollaborationTransportSession } from "@/lib/collaboration/transport"

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

  const session: CollaborationTransportSession<{
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
    cursorRect: { left: number; top: number; height: number } | null
  }, {
    provider: typeof provider
  }> = {
    binding: {
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

    openDocumentCollaborationSessionMock.mockResolvedValue({
      bootstrap: {
        roomId: "doc:document_1",
        documentId: "document_1",
        token: "token",
        serviceUrl: "https://collab.example.com",
        role: "editor",
        sessionId: "session_1",
      },
      session,
    })

    const { useDocumentCollaboration } = await import(
      "@/hooks/use-document-collaboration"
    )

    const { rerender } = renderHook(
      ({
        avatarImageUrl,
      }: {
        avatarImageUrl: string | null
      }) =>
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

  it("clears stale collaboration state before re-enabling the same document", async () => {
    const firstSession = createSession()

    let resolveSecondOpen: ((value: {
      bootstrap: {
        roomId: string
        documentId: string
        token: string
        serviceUrl: string
        role: "editor"
        sessionId: string
      }
      session: ReturnType<typeof createSession>
    }) => void) | null = null

    openDocumentCollaborationSessionMock
      .mockResolvedValueOnce({
        bootstrap: {
          roomId: "doc:document_1",
          documentId: "document_1",
          token: "token-1",
          serviceUrl: "https://collab.example.com",
          role: "editor",
          sessionId: "session_1",
        },
        session: firstSession,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondOpen = resolve
          })
      )

    const { useDocumentCollaboration } = await import(
      "@/hooks/use-document-collaboration"
    )

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
})
