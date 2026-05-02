import { NextResponse } from "next/server"

import { logProviderError } from "@/lib/server/provider-errors"

type EventOptions = {
  retryMs?: number
}

type EventStreamContext = {
  isClosed: () => boolean
  sendEvent: (event: string, payload: unknown, options?: EventOptions) => void
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

export function sleep(durationMs: number) {
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
