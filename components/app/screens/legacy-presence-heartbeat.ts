"use client"

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react"

import type { DocumentPresenceViewer } from "@/lib/domain/types"

type PresenceLifecycle = "idle" | "bootstrapping" | "attached" | string

type UseLegacyPresenceHeartbeatOptions = {
  activeId: string | null
  activeBlockIdRef: MutableRefObject<string | null>
  clearErrorMessage: string
  clearPresence: (
    activeId: string,
    sessionId: string,
    options?: { keepalive?: boolean }
  ) => Promise<unknown>
  collaborationLifecycle: PresenceLifecycle
  currentUserId: string
  disabled?: boolean
  heartbeatErrorMessage: string
  heartbeatIntervalMs: number
  heartbeatPresence: (
    activeId: string,
    sessionId: string,
    activeBlockId: string | null
  ) => Promise<DocumentPresenceViewer[]>
  getSessionId: (currentUserId: string) => string
}

export function useLegacyPresenceHeartbeat({
  activeId,
  activeBlockIdRef,
  clearErrorMessage,
  clearPresence,
  collaborationLifecycle,
  currentUserId,
  disabled = false,
  heartbeatErrorMessage,
  heartbeatIntervalMs,
  heartbeatPresence,
  getSessionId,
}: UseLegacyPresenceHeartbeatOptions) {
  const [presenceViewers, setPresenceViewers] = useState<
    DocumentPresenceViewer[]
  >([])
  const sendLegacyPresenceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!activeId || disabled) {
      sendLegacyPresenceRef.current = null
      setPresenceViewers([])
      return
    }

    if (
      collaborationLifecycle === "bootstrapping" ||
      collaborationLifecycle === "attached"
    ) {
      sendLegacyPresenceRef.current = null
      setPresenceViewers([])
      return
    }

    let cancelled = false
    let presenceActive = window.document.visibilityState === "visible"
    let heartbeatTimeoutId: number | null = null
    const activePresenceId = activeId
    const sessionId = getSessionId(currentUserId)

    function clearHeartbeatTimeout() {
      if (heartbeatTimeoutId !== null) {
        window.clearTimeout(heartbeatTimeoutId)
        heartbeatTimeoutId = null
      }
    }

    function scheduleHeartbeat(delayMs: number) {
      clearHeartbeatTimeout()

      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      heartbeatTimeoutId = window.setTimeout(() => {
        void sendHeartbeat()
      }, delayMs)
    }

    async function sendHeartbeat() {
      if (
        cancelled ||
        !presenceActive ||
        window.document.visibilityState !== "visible"
      ) {
        return
      }

      try {
        const viewers = await heartbeatPresence(
          activePresenceId,
          sessionId,
          activeBlockIdRef.current
        )

        if (
          !cancelled &&
          presenceActive &&
          window.document.visibilityState === "visible"
        ) {
          setPresenceViewers(viewers)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(heartbeatErrorMessage, error)
        }
      } finally {
        scheduleHeartbeat(heartbeatIntervalMs)
      }
    }

    sendLegacyPresenceRef.current = () => {
      void sendHeartbeat()
    }

    function resumePresence() {
      if (cancelled || window.document.visibilityState !== "visible") {
        return
      }

      presenceActive = true
      void sendHeartbeat()
    }

    function leavePresence(options?: { keepalive?: boolean }) {
      presenceActive = false
      clearHeartbeatTimeout()

      if (!cancelled) {
        setPresenceViewers([])
      }

      void clearPresence(activePresenceId, sessionId, {
        keepalive: options?.keepalive,
      }).catch((error) => {
        if (!cancelled && window.document.visibilityState === "visible") {
          console.error(clearErrorMessage, error)
        }
      })
    }

    const handleVisibilityChange = () => {
      if (window.document.visibilityState === "visible") {
        resumePresence()
        return
      }

      leavePresence({ keepalive: true })
    }
    const handleWindowFocus = () => {
      resumePresence()
    }
    const handleWindowOnline = () => {
      resumePresence()
    }
    const handlePageShow = () => {
      resumePresence()
    }
    const handlePageHide = () => {
      leavePresence({ keepalive: true })
    }

    resumePresence()

    window.addEventListener("focus", handleWindowFocus)
    window.addEventListener("online", handleWindowOnline)
    window.addEventListener("pageshow", handlePageShow)
    window.document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      cancelled = true
      clearHeartbeatTimeout()
      window.removeEventListener("focus", handleWindowFocus)
      window.removeEventListener("online", handleWindowOnline)
      window.removeEventListener("pageshow", handlePageShow)
      window.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
      window.removeEventListener("pagehide", handlePageHide)
      sendLegacyPresenceRef.current = null
      void clearPresence(activePresenceId, sessionId, {
        keepalive: true,
      }).catch(() => {})
    }
  }, [
    activeBlockIdRef,
    activeId,
    clearErrorMessage,
    clearPresence,
    collaborationLifecycle,
    currentUserId,
    disabled,
    getSessionId,
    heartbeatErrorMessage,
    heartbeatIntervalMs,
    heartbeatPresence,
  ])

  return {
    presenceViewers,
    sendLegacyPresenceRef,
  }
}
