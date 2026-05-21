import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setMockDesktopAuthBridge } from "@/tests/lib/fixtures/electron-app"

class EventSourceMock {
  static instances: EventSourceMock[] = []

  onerror: ((event: Event) => void) | null = null

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit
  ) {
    EventSourceMock.instances.push(this)
  }

  addEventListener() {}

  removeEventListener() {}

  close() {}
}

describe("authenticated event source", () => {
  const originalElectronApp = window.electronApp

  beforeEach(() => {
    vi.resetModules()
    EventSourceMock.instances = []
  })

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("uses native EventSource for normal web sessions", async () => {
    vi.stubGlobal("EventSource", EventSourceMock)
    const { createAuthenticatedEventSource } = await import(
      "@/lib/browser/authenticated-event-source"
    )

    createAuthenticatedEventSource("/api/events/scoped", {
      withCredentials: true,
    })

    expect(EventSourceMock.instances).toHaveLength(1)
    expect(EventSourceMock.instances[0]).toMatchObject({
      options: {
        withCredentials: true,
      },
      url: "/api/events/scoped",
    })
  })

  it("uses fetch with Electron bearer auth for desktop sessions", async () => {
    vi.stubGlobal("EventSource", undefined)
    setMockDesktopAuthBridge()

    const encoder = new TextEncoder()
    const controllerRef: {
      current: ReadableStreamDefaultController<Uint8Array> | null
    } = {
      current: null,
    }
    const stream = new ReadableStream<Uint8Array>({
      start(nextController) {
        controllerRef.current = nextController
      },
    })
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
      })
    )
    const { createAuthenticatedEventSource } = await import(
      "@/lib/browser/authenticated-event-source"
    )
    const source = createAuthenticatedEventSource("/api/events/scoped")
    const onReady = vi.fn()

    source.addEventListener("ready", onReady)

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const requestInit = fetchMock.mock.calls[0]?.[1]
    const headers = requestInit?.headers

    expect(requestInit).toMatchObject({
      credentials: "include",
    })
    expect(headers).toBeInstanceOf(Headers)
    expect((headers as Headers).get("Authorization")).toBe(
      "Bearer desktop_token"
    )

    controllerRef.current?.enqueue(
      encoder.encode('event: ready\ndata: {"versions":[]}\n\n')
    )

    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          data: '{"versions":[]}',
        })
      )
    })

    source.close()
  })
})
