import { afterEach, describe, expect, it, vi } from "vitest"

import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import type { CollaborationSessionBootstrap } from "@/lib/collaboration/transport"

type EventListener = (...args: unknown[]) => void

const providerState = vi.hoisted(() => ({
  latest: null as MockYPartyKitProvider | null,
}))

const yState = vi.hoisted(() => ({
  latestDoc: null as MockDoc | null,
}))

class MockEventListeners {
  private listeners = new Map<string, Set<EventListener>>()

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
}

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

class MockAwareness extends MockEventListeners {
  private states = new Map<number, unknown>()
  private localState: unknown = null

  getStates() {
    return new Map(this.states)
  }

  getLocalState() {
    return this.localState
  }

  setLocalState(nextState: unknown) {
    this.localState = nextState
    this.states.set(0, nextState)
  }

  setRemoteState(clientId: number, nextState: unknown) {
    this.states.set(clientId, nextState)
  }
}

class MockYPartyKitProvider extends MockEventListeners {
  awareness = new MockAwareness()
  synced = false
  wsconnected = false
  options?: Record<string, unknown>

  constructor(
    _host: string,
    _room: string,
    _doc: unknown,
    options?: Record<string, unknown>
  ) {
    super()
    this.options = options
    providerState.latest = this
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

function createDocumentSessionBootstrap(
  overrides: Partial<CollaborationSessionBootstrap> = {}
): CollaborationSessionBootstrap {
  return {
    roomId: "doc:doc_1",
    documentId: "doc_1",
    token: "token_1",
    serviceUrl: "http://127.0.0.1:1999",
    role: "editor",
    ...overrides,
  }
}

function createFreshBootstrapMock(
  overrides: Partial<CollaborationSessionBootstrap> = {}
) {
  return vi.fn().mockResolvedValue(
    createDocumentSessionBootstrap({
      token: "token_2",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      ...overrides,
    })
  )
}

function createOkFlushFetchMock() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: vi.fn().mockResolvedValue(""),
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function createDocumentAdapter() {
  const { createPartyKitCollaborationAdapter } =
    await import("@/lib/collaboration/adapters/partykit")

  return createPartyKitCollaborationAdapter()
}

async function createDocumentSession(
  overrides: Partial<CollaborationSessionBootstrap> = {}
) {
  const adapter = await createDocumentAdapter()
  const session = adapter.openDocumentSession(
    createDocumentSessionBootstrap(overrides)
  )

  return { adapter, session }
}

function trackSessionConnect(
  session: Awaited<ReturnType<typeof createDocumentSession>>["session"]
) {
  let resolved = false
  const promise = session.connect().then(() => {
    resolved = true
  })

  return {
    promise,
    get resolved() {
      return resolved
    },
  }
}

function collectSessionStatuses(
  session: Awaited<ReturnType<typeof createDocumentSession>>["session"]
) {
  const statuses: unknown[] = []

  session.onStatusChange((change) => {
    statuses.push(change)
  })

  return statuses
}

async function expectConnectionResolvesAfterSync(
  connection: ReturnType<typeof trackSessionConnect>
) {
  await Promise.resolve()
  expect(connection.resolved).toBe(false)

  providerState.latest?.emit("synced", true)
  await connection.promise

  expect(connection.resolved).toBe(true)
}

describe("PartyKit collaboration adapter", () => {
  afterEach(() => {
    providerState.latest = null
    yState.latestDoc = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("waits for the first synced event before resolving the session connection", async () => {
    const { session } = await createDocumentSession()
    const connection = trackSessionConnect(session)

    await expectConnectionResolvesAfterSync(connection)
  })

  it("does not resolve the session before the first synced event", async () => {
    const { session } = await createDocumentSession()
    const connection = trackSessionConnect(session)

    providerState.latest!.wsconnected = true
    providerState.latest?.emit("status", { status: "connected" })

    await expectConnectionResolvesAfterSync(connection)
  })

  it("does not reject the initial connection on a transient connection error before sync", async () => {
    const { session } = await createDocumentSession()
    const connection = trackSessionConnect(session)

    providerState.latest?.emit("connection-error", new Error("transient"))

    await expectConnectionResolvesAfterSync(connection)
  })

  it("maps plain websocket close reasons to structured status changes", async () => {
    const { session } = await createDocumentSession()
    const statuses = collectSessionStatuses(session)

    providerState.latest?.emit("connection-error", {
      reason: "collaboration_conflict_reload_required",
      code: 4499,
    })

    expect(statuses.at(-1)).toMatchObject({
      state: "errored",
      reason: "This document changed elsewhere. Reload to continue editing.",
      code: "collaboration_conflict_reload_required",
      reloadRequired: true,
    })
  })

  it("maps websocket close codes when provider events omit a reason", async () => {
    const { session } = await createDocumentSession()
    const statuses = collectSessionStatuses(session)

    providerState.latest?.emit("connection-error", {
      code: 4499,
    })

    expect(statuses.at(-1)).toMatchObject({
      state: "errored",
      reason: "This document changed elsewhere. Reload to continue editing.",
      code: "collaboration_conflict_reload_required",
      reloadRequired: true,
    })
  })

  it("does not emit an errored status when the initial sync is merely late", async () => {
    vi.useFakeTimers()

    const { session } = await createDocumentSession()
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
    const { session } = await createDocumentSession({
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

    const adapter = await createDocumentAdapter()

    expect(() =>
      adapter.openDocumentSession(createDocumentSessionBootstrap())
    ).not.toThrow()
  })

  it("emits current awareness state immediately when subscribing", async () => {
    const { session } = await createDocumentSession()

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
    const { session } = await createDocumentSession()

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
    const getFreshBootstrap = createFreshBootstrapMock()

    await createDocumentSession({
      expiresAt: Math.floor(Date.now() / 1000) + 5,
      getFreshBootstrap,
    })

    const params = await (
      providerState.latest?.options?.params as () => Promise<{
        token: string
        protocolVersion: string
        schemaVersion: string
      }>
    )()

    expect(getFreshBootstrap).toHaveBeenCalledTimes(1)
    expect(params).toEqual({
      token: "token_2",
      protocolVersion: String(COLLABORATION_PROTOCOL_VERSION),
      schemaVersion: String(RICH_TEXT_COLLABORATION_SCHEMA_VERSION),
    })
  })

  it("refreshes an expiring token before a manual flush", async () => {
    const getFreshBootstrap = createFreshBootstrapMock()
    const fetchMock = createOkFlushFetchMock()
    const { session } = await createDocumentSession({
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
    const getFreshBootstrap = createFreshBootstrapMock()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            ok: false,
            code: "collaboration_room_mismatch",
            message: "Collaboration room mismatch",
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      })
    vi.stubGlobal("fetch", fetchMock)

    const { session } = await createDocumentSession({
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
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Authorization: "Bearer token_2",
          "Content-Type": "application/json",
        },
      })
    )
  })

  it("surfaces manual flush failures without retrying a room sync fence", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(""),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { session } = await createDocumentSession()

    await expect(session.flush()).rejects.toThrow(
      "Failed to flush collaboration state"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("includes optional work-item metadata in the manual flush payload", async () => {
    const fetchMock = createOkFlushFetchMock()
    const { session } = await createDocumentSession()

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
    const fetchMock = createOkFlushFetchMock()
    const { session } = await createDocumentSession()

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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue("Document not found"),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { session } = await createDocumentSession()
    const disconnectSpy = vi.spyOn(providerState.latest!, "disconnect")

    await expect(session.flush()).rejects.toThrow("Document not found")
    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("destroys the Y.Doc when the session disconnects", async () => {
    const { session } = await createDocumentSession()

    expect(yState.latestDoc?.destroyed).toBe(false)

    session.disconnect("test")

    expect(yState.latestDoc?.destroyed).toBe(true)
  })
})
