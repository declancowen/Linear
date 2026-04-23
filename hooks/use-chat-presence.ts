"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { COLLABORATION_PARTY_NAME } from "@/lib/collaboration/constants"
import { syncCreateChatPresenceSession } from "@/lib/convex/client/chat-presence"
import { RouteMutationError } from "@/lib/convex/client/shared"

export type ChatPresenceParticipant = {
  userId: string
  sessionId: string
  typing: boolean
}

const CHAT_PRESENCE_RECONNECT_BASE_DELAY_MS = 1_000
const CHAT_PRESENCE_RECONNECT_MAX_DELAY_MS = 5_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function buildChatPresenceSocketUrl(
  serviceUrl: string,
  roomId: string,
  token: string
) {
  const parsedServiceUrl = new URL(serviceUrl)
  const prefix = parsedServiceUrl.pathname.replace(/\/$/, "")
  const protocol = parsedServiceUrl.protocol === "https:" ? "wss:" : "ws:"
  const socketUrl = new URL(
    `${prefix}/parties/${COLLABORATION_PARTY_NAME}/${encodeURIComponent(roomId)}`,
    `${protocol}//${parsedServiceUrl.host}`
  )

  socketUrl.searchParams.set("token", token)

  return socketUrl.toString()
}

function parseChatPresenceSnapshot(
  payload: unknown
): ChatPresenceParticipant[] | null {
  if (!isRecord(payload) || payload.type !== "presence_snapshot") {
    return null
  }

  if (!Array.isArray(payload.participants)) {
    return null
  }

  const participants: ChatPresenceParticipant[] = []

  for (const participant of payload.participants) {
    if (
      !isRecord(participant) ||
      typeof participant.userId !== "string" ||
      typeof participant.sessionId !== "string" ||
      typeof participant.typing !== "boolean"
    ) {
      return null
    }

    participants.push({
      userId: participant.userId,
      sessionId: participant.sessionId,
      typing: participant.typing,
    })
  }

  return participants
}

function shouldRetryChatPresenceError(error: unknown) {
  if (!(error instanceof RouteMutationError)) {
    return true
  }

  if (error.status === 0) {
    return true
  }

  return error.status >= 500
}

export function useChatPresence(input: {
  conversationId: string | null
  currentUserId: string | null
  enabled?: boolean
}) {
  const [snapshot, setSnapshot] = useState<{
    conversationId: string | null
    participants: ChatPresenceParticipant[]
  }>({
    conversationId: null,
    participants: [],
  })
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible"
  )
  const socketRef = useRef<WebSocket | null>(null)
  const desiredTypingRef = useRef(false)
  const lastSentTypingRef = useRef(false)
  const isEnabled = Boolean(
    input.enabled && input.conversationId && input.currentUserId && isPageVisible
  )

  useEffect(() => {
    const handleVisibilityChange = () => {
      const nextVisible = document.visibilityState === "visible"
      setIsPageVisible(nextVisible)

      if (!nextVisible) {
        desiredTypingRef.current = false
        lastSentTypingRef.current = false
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!isEnabled || !input.conversationId) {
      return
    }

    const conversationId = input.conversationId

    let cancelled = false
    let reconnectTimeoutId: number | null = null
    let reconnectAttempt = 0
    let activeSocket: WebSocket | null = null

    function clearReconnectTimeout() {
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId)
        reconnectTimeoutId = null
      }
    }

    function closeActiveSocket() {
      const socket = activeSocket

      activeSocket = null

      if (socketRef.current === socket) {
        socketRef.current = null
      }

      if (!socket) {
        return
      }

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close()
      }
    }

    function scheduleReconnect() {
      if (cancelled) {
        return
      }

      clearReconnectTimeout()
      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = null
        void openSocket()
      }, Math.min(
        CHAT_PRESENCE_RECONNECT_MAX_DELAY_MS,
        CHAT_PRESENCE_RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt
      ))
      reconnectAttempt += 1
    }

    async function openSocket() {
      clearReconnectTimeout()
      closeActiveSocket()

      try {
        const session = await syncCreateChatPresenceSession(conversationId)

        if (cancelled) {
          return
        }

        const socket = new WebSocket(
          buildChatPresenceSocketUrl(
            session.serviceUrl,
            session.roomId,
            session.token
          )
        )

        activeSocket = socket
        socketRef.current = socket

        socket.addEventListener("open", () => {
          if (cancelled || activeSocket !== socket) {
            socket.close()
            return
          }

          reconnectAttempt = 0

          if (desiredTypingRef.current) {
            socket.send(JSON.stringify({ type: "typing", typing: true }))
            lastSentTypingRef.current = true
          }
        })

        socket.addEventListener("message", (event) => {
          if (cancelled || typeof event.data !== "string") {
            return
          }

          let payload: unknown

          try {
            payload = JSON.parse(event.data)
          } catch {
            return
          }

          const nextParticipants = parseChatPresenceSnapshot(payload)

          if (!nextParticipants) {
            return
          }

          setSnapshot({
            conversationId,
            participants: nextParticipants,
          })
        })

        socket.addEventListener("close", () => {
          if (activeSocket === socket) {
            activeSocket = null
          }

          if (socketRef.current === socket) {
            socketRef.current = null
          }

          lastSentTypingRef.current = false
          setSnapshot({
            conversationId: null,
            participants: [],
          })

          if (!cancelled) {
            scheduleReconnect()
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setSnapshot({
          conversationId: null,
          participants: [],
        })

        if (shouldRetryChatPresenceError(error)) {
          scheduleReconnect()
        }
      }
    }

    void openSocket()

    return () => {
      cancelled = true
      clearReconnectTimeout()
      closeActiveSocket()
      desiredTypingRef.current = false
      lastSentTypingRef.current = false
      setSnapshot({
        conversationId: null,
        participants: [],
      })
    }
  }, [input.conversationId, isEnabled])

  const setTyping = useCallback((typing: boolean) => {
    desiredTypingRef.current = typing

    const socket = socketRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    if (lastSentTypingRef.current === typing) {
      return
    }

    socket.send(JSON.stringify({ type: "typing", typing }))
    lastSentTypingRef.current = typing
  }, [])

  return {
    participants:
      isEnabled && snapshot.conversationId === input.conversationId
        ? snapshot.participants
        : [],
    setTyping,
  }
}
