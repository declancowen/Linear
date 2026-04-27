import { afterEach, describe, expect, it, vi } from "vitest"

import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"

type EventListener = (...args: unknown[]) => void

const providerState = vi.hoisted(() => ({
  latest: null as MockYPartyKitProvider | null,
}))

const yState = vi.hoisted(() => ({
  latestDoc: null as MockDoc | null,
}))

class MockDoc {
  fragmentLength: number
  fragmentHtml: string
  destroyed = false

  constructor(fragmentLength = 0, fragmentHtml = "") {
    this.fragmentLength = fragmentLength
    this.fragmentHtml = fragmentHtml
    yState.latestDoc = this
  }

  getXmlFragment() {
    return {
      length: this.fragmentLength,
      toString: () => this.fragmentHtml,
    }
  }

  destroy() {
    this.destroyed = true
  }
}

class MockAwareness {
  private states = new Map<number, unknown>()
  private localState: unknown = null
  private listeners = new Map<string, Set<EventListener>>()

  getStates() {
    return new Map(this.states)
  }

  getLocalState() {
    return this.localState
  }

  on(event: string, listener: EventListener) {
    const listeners = this.listeners.get(event) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: string, listener: EventListener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }

  setLocalState(nextState: unknown) {
    this.localState = nextState
    this.states.set(0, nextState)
  }

  setRemoteState(clientId: number, nextState: unknown) {
    this.states.set(clientId, nextState)
  }
}

class MockYPartyKitProvider {
  awareness = new MockAwareness()
  synced = false
  wsconnected = false
  options?: Record<string, unknown>
  private listeners = new Map<string, Set<EventListener>>()

  constructor(
    _host: string,
    _room: string,
    _doc: unknown,
    options?: Record<string, unknown>
  ) {
    this.options = options
    providerState.latest = this
  }

  on(event: string, listener: EventListener) {
    const listeners = this.listeners.get(event) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: string, listener: EventListener) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args)
    }
  }

  connect() {}

  disconnect() {}

  destroy() {}
}

vi.mock("y-partykit/provider", () => ({
  default: MockYPartyKitProvider,
}))

vi.mock("@tiptap/y-tiptap", () => ({
  yDocToProsemirrorJSON: vi.fn(() => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  })),
}))

vi.mock("yjs", () => ({
  Doc: MockDoc,
  encodeStateVector: vi.fn(() => Uint8Array.from([1, 2, 3])),
  encodeStateAsUpdate: vi.fn(() => Uint8Array.from([1, 2, 3])),
}))

describe("PartyKit collaboration adapter", () => {
  afterEach(() => {
    providerState.latest = null
    yState.latestDoc = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("waits for the first synced event before resolving the session connection", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    let resolved = false
    const connectPromise = session.connect().then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    providerState.latest?.emit("synced", true)
    await connectPromise

    expect(resolved).toBe(true)
  })

  it("does not resolve the session before the first synced event", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    let resolved = false
    const connectPromise = session.connect().then(() => {
      resolved = true
    })

    providerState.latest!.wsconnected = true
    providerState.latest?.emit("status", { status: "connected" })
    await Promise.resolve()

    expect(resolved).toBe(false)

    providerState.latest?.emit("synced", true)
    await connectPromise

    expect(resolved).toBe(true)
  })

  it("does not reject the initial connection on a transient connection error before sync", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    let resolved = false
    const connectPromise = session.connect().then(() => {
      resolved = true
    })

    providerState.latest?.emit("connection-error", new Error("transient"))
    await Promise.resolve()
    expect(resolved).toBe(false)

    providerState.latest?.emit("synced", true)
    await connectPromise

    expect(resolved).toBe(true)
  })

  it("does not emit an errored status when the initial sync is merely late", async () => {
    vi.useFakeTimers()

    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })
    const statuses: string[] = []

    session.onStatusChange(({ state }) => {
      statuses.push(state)
    })

    const connectPromise = session.connect()
    const rejection = connectPromise.catch((error) => error)
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(rejection).resolves.toMatchObject({
      message: "Timed out waiting for collaboration document sync",
    })
    expect(statuses).toEqual(["connecting", "connecting"])
  })

  it("does not pre-seed the collaboration doc from bootstrap content before sync", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
      contentJson: {
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
      },
      contentHtml: "<p>Hello</p>",
    })

    const connectPromise = session.connect()

    providerState.latest?.emit("synced", true)
    await connectPromise

    expect(yState.latestDoc?.fragmentLength ?? 0).toBe(0)
    expect(yState.latestDoc?.fragmentHtml ?? "").toBe("")
  })

  it("allows loopback ws/http transport from a localhost secure context", async () => {
    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        hostname: "localhost",
      },
      isSecureContext: true,
    })

    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()

    expect(() =>
      adapter.openDocumentSession({
        roomId: "doc:doc_1",
        documentId: "doc_1",
        token: "token_1",
        serviceUrl: "http://127.0.0.1:1999",
        role: "editor",
      })
    ).not.toThrow()
  })

  it("emits current awareness state immediately when subscribing", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    const localState = {
      user: {
        userId: "user_local",
        sessionId: "session_local",
        name: "Local User",
      },
    }
    const remoteState = {
      user: {
        userId: "user_remote",
        sessionId: "session_remote",
        name: "Remote User",
      },
    }

    providerState.latest?.awareness.setLocalState(localState)
    providerState.latest?.awareness.setRemoteState(1, remoteState)

    const listener = vi.fn()
    session.onAwarenessChange(listener)

    expect(listener).toHaveBeenCalledWith({
      local: {
        userId: "user_local",
        sessionId: "session_local",
        name: "Local User",
        avatarUrl: null,
        color: null,
        typing: false,
        activeBlockId: null,
        cursor: null,
        selection: null,
        cursorSide: null,
      },
      remote: [
        {
          userId: "user_remote",
          sessionId: "session_remote",
          name: "Remote User",
          avatarUrl: null,
          color: null,
          typing: false,
          activeBlockId: null,
          cursor: null,
          selection: null,
          cursorSide: null,
        },
      ],
    })
  })

  it("preserves semantic cursor fields when updating local awareness", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    session.updateLocalAwareness({
      userId: "user_local",
      sessionId: "session_local",
      name: "Local User",
      avatarUrl: null,
      color: "#123456",
      typing: true,
      activeBlockId: "paragraph:1",
      cursor: {
        anchor: 3,
        head: 5,
      },
      selection: {
        anchor: 3,
        head: 5,
      },
      cursorSide: "before",
    })

    expect(providerState.latest?.awareness.getLocalState()).toEqual({
      user: {
        userId: "user_local",
        sessionId: "session_local",
        name: "Local User",
        avatarUrl: null,
        color: "#123456",
        typing: true,
        activeBlockId: "paragraph:1",
        cursor: {
          anchor: 3,
          head: 5,
        },
        selection: {
          anchor: 3,
          head: 5,
        },
        cursorSide: "before",
      },
    })
  })

  it("refreshes an expiring token before provider auth params are resolved", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const getFreshBootstrap = vi.fn().mockResolvedValue({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_2",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor" as const,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })

    const adapter = createPartyKitCollaborationAdapter()
    adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
      expiresAt: Math.floor(Date.now() / 1000) + 5,
      getFreshBootstrap,
    })

    const params = await (
      providerState.latest?.options?.params as (() => Promise<{
        token: string
        protocolVersion: string
        schemaVersion: string
      }>)
    )()

    expect(getFreshBootstrap).toHaveBeenCalledTimes(1)
    expect(params).toEqual({
      token: "token_2",
      protocolVersion: String(COLLABORATION_PROTOCOL_VERSION),
      schemaVersion: String(RICH_TEXT_COLLABORATION_SCHEMA_VERSION),
    })
  })

  it("refreshes an expiring token before a manual flush", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const getFreshBootstrap = vi.fn().mockResolvedValue({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_2",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor" as const,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
      expiresAt: Math.floor(Date.now() / 1000) + 5,
      getFreshBootstrap,
    })

    await session.flush()

    expect(getFreshBootstrap).toHaveBeenCalledTimes(1)
    const [flushUrl] = fetchMock.mock.calls[0] ?? []
    expect(flushUrl).toBeInstanceOf(URL)
    expect((flushUrl as URL).searchParams.get("protocolVersion")).toBe(
      String(COLLABORATION_PROTOCOL_VERSION)
    )
    expect((flushUrl as URL).searchParams.get("schemaVersion")).toBe(
      String(RICH_TEXT_COLLABORATION_SCHEMA_VERSION)
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer token_2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "content",
        }),
      })
    )
  })

  it("forces a fresh bootstrap and retries manual flush after a room mismatch response", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const getFreshBootstrap = vi.fn().mockResolvedValue({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_2",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor" as const,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Collaboration room mismatch"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      getFreshBootstrap,
    })

    await session.flush()

    expect(getFreshBootstrap).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Authorization: "Bearer token_1",
          "Content-Type": "application/json",
        },
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Authorization: "Bearer token_2",
          "Content-Type": "application/json",
        },
      }),
    )
  })

  it("surfaces manual flush failures without retrying a room sync fence", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(""),
      })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    await expect(session.flush()).rejects.toThrow(
      "Failed to flush collaboration state"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("includes optional work-item metadata in the manual flush payload", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    await session.flush({
      kind: "work-item-main",
      workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
      workItemTitle: "Updated title",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        body: JSON.stringify({
          kind: "work-item-main",
          workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
          workItemTitle: "Updated title",
        }),
      })
    )
  })

  it("omits the room state vector for document-title-only manual flushes", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    await session.flush({
      kind: "document-title",
      documentTitle: "Updated document title",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        body: JSON.stringify({
          kind: "document-title",
          documentTitle: "Updated document title",
        }),
      })
    )
  })

  it("disconnects the session when a manual flush reports a missing document", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue("Document not found"),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })
    const disconnectSpy = vi.spyOn(providerState.latest!, "disconnect")

    await expect(session.flush()).rejects.toThrow("Document not found")
    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("destroys the Y.Doc when the session disconnects", async () => {
    const { createPartyKitCollaborationAdapter } = await import(
      "@/lib/collaboration/adapters/partykit"
    )

    const adapter = createPartyKitCollaborationAdapter()
    const session = adapter.openDocumentSession({
      roomId: "doc:doc_1",
      documentId: "doc_1",
      token: "token_1",
      serviceUrl: "http://127.0.0.1:1999",
      role: "editor",
    })

    expect(yState.latestDoc?.destroyed).toBe(false)

    session.disconnect("test")

    expect(yState.latestDoc?.destroyed).toBe(true)
  })
})
