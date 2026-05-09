import { NextResponse } from "next/server"

import { logProviderError } from "@/lib/server/provider-errors"

type EventOptions = {
  retryMs?: number
}

type EventStreamContext = {
  isClosed: () => boolean
  sendEvent: (event: string, payload: unknown, options?: EventOptions) => void
}

type PollingEventStreamOptions = {
  heartbeatIntervalMs: number
  maxDurationMs: number
  pollIntervalMs: number
  poll: () => Promise<"changed" | "stop" | void>
}

const EVENT_STREAM_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
  "X-Accel-Buffering": "no",
}

function formatServerSentEvent(
  event: string,
  payload: unknown,
  options?: EventOptions
) {
  return `${options?.retryMs ? `retry: ${options.retryMs}\n` : ""}event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

export function createServerSentEventResponse(
  event: string,
  payload: unknown,
  options?: EventOptions
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(formatServerSentEvent(event, payload, options))
      )
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: EVENT_STREAM_HEADERS,
  })
}

export function createEventStreamResponse(
  request: Request,
  errorLabel: string,
  run: (context: EventStreamContext) => Promise<void>
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const close = () => {
        if (closed) {
          return
        }

        closed = true

        try {
          controller.close()
        } catch {}
      }

      const sendEvent = (
        event: string,
        payload: unknown,
        options?: EventOptions
      ) => {
        if (closed) {
          return
        }

        controller.enqueue(
          encoder.encode(formatServerSentEvent(event, payload, options))
        )
      }

      const isClosed = () => closed || request.signal.aborted

      request.signal.addEventListener("abort", close)

      void (async () => {
        try {
          await run({
            isClosed,
            sendEvent,
          })
        } catch (error) {
          logProviderError(errorLabel, error)
        } finally {
          request.signal.removeEventListener("abort", close)
          close()
        }
      })()
    },
  })

  return new NextResponse(stream, {
    headers: EVENT_STREAM_HEADERS,
  })
}

export async function runPollingEventStream(
  context: EventStreamContext,
  options: PollingEventStreamOptions
) {
  let lastHeartbeatAt = Date.now()
  const startedAt = Date.now()

  while (!context.isClosed()) {
    if (Date.now() - startedAt >= options.maxDurationMs) {
      break
    }

    await sleep(options.pollIntervalMs)

    if (context.isClosed()) {
      break
    }

    const result = await options.poll()

    if (result === "stop") {
      break
    }

    if (result === "changed") {
      lastHeartbeatAt = Date.now()
      continue
    }

    if (Date.now() - lastHeartbeatAt >= options.heartbeatIntervalMs) {
      context.sendEvent("ping", {
        timestamp: new Date().toISOString(),
      })
      lastHeartbeatAt = Date.now()
    }
  }
}
