import { afterEach, describe, expect, it, vi } from "vitest"

const syncCreateDocumentCollaborationSessionMock = vi.fn()
const openDocumentSessionMock = vi.fn()

vi.mock("@/lib/convex/client", () => ({
  syncCreateDocumentCollaborationSession:
    syncCreateDocumentCollaborationSessionMock,
}))

describe("collaboration client session helpers", () => {
  afterEach(() => {
    syncCreateDocumentCollaborationSessionMock.mockReset()
    openDocumentSessionMock.mockReset()
  })

  it("opens a document collaboration session through the app-owned adapter", async () => {
    const bootstrap = {
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "https://partykit.example.com",
      role: "editor" as const,
      sessionId: "session_1",
      expiresAt: 200,
      contentHtml: "<p>Hello</p>",
    }
    const session = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      updateLocalAwareness: vi.fn(),
      flush: vi.fn(),
      onStatusChange: vi.fn(() => () => {}),
      onAwarenessChange: vi.fn(() => () => {}),
    }

    syncCreateDocumentCollaborationSessionMock.mockResolvedValue(bootstrap)
    openDocumentSessionMock.mockReturnValue(session)

    const { openDocumentCollaborationSession } = await import(
      "@/lib/collaboration/client-session"
    )

    const result = await openDocumentCollaborationSession({
      documentId: "doc_1",
      adapter: {
        openDocumentSession: openDocumentSessionMock,
      },
    })

    expect(syncCreateDocumentCollaborationSessionMock).toHaveBeenCalledWith(
      "doc_1"
    )
    expect(openDocumentSessionMock).toHaveBeenCalledWith(
      expect.objectContaining(bootstrap)
    )
    expect(
      openDocumentSessionMock.mock.calls[0]?.[0]?.getFreshBootstrap
    ).toEqual(expect.any(Function))
    expect(session.connect).not.toHaveBeenCalled()
    expect(result).toEqual({
      bootstrap,
      session,
    })
  })
})
