import { useEffect, useRef, type MutableRefObject } from "react"

import type { AppRouter } from "@/lib/browser/app-navigation"

import { getAnchorInternalNavigationHref } from "./document-navigation"

export type PendingMentionExitTarget =
  | {
      kind: "href"
      href: string
    }
  | {
      kind: "history"
    }
  | null

function isPlainPrimaryNavigationClick(event: MouseEvent) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

function getPendingMentionNavigationAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest("a[href]")

  if (
    !(anchor instanceof HTMLAnchorElement) ||
    anchor.hasAttribute("download") ||
    (anchor.target && anchor.target !== "_self")
  ) {
    return null
  }

  return anchor
}

function getCurrentNavigationHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getPendingMentionNavigationHref(event: MouseEvent) {
  if (!isPlainPrimaryNavigationClick(event)) {
    return null
  }

  const anchor = getPendingMentionNavigationAnchor(event.target)

  if (!anchor) {
    return null
  }

  const nextHref = getAnchorInternalNavigationHref(anchor)

  return nextHref && nextHref !== getCurrentNavigationHref() ? nextHref : null
}

export function usePendingMentionBeforeUnload(
  hasPendingMentionNotifications: boolean
) {
  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasPendingMentionNotifications])
}

export function usePendingMentionLinkNavigationGuard({
  hasPendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  hasPendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingMentionExitTarget) => void
}) {
  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handleClick(event: MouseEvent) {
      const nextHref = getPendingMentionNavigationHref(event)

      if (!nextHref) {
        return
      }

      event.preventDefault()
      setPendingExitTarget({
        kind: "href",
        href: nextHref,
      })
      setExitDialogOpen(true)
    }

    window.document.addEventListener("click", handleClick, true)

    return () => {
      window.document.removeEventListener("click", handleClick, true)
    }
  }, [hasPendingMentionNotifications, setExitDialogOpen, setPendingExitTarget])
}

export function usePendingMentionHistoryNavigationGuard({
  allowHistoryExitRef,
  currentRouteHrefRef,
  currentRouteStateRef,
  hasPendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  allowHistoryExitRef: MutableRefObject<boolean>
  currentRouteHrefRef: MutableRefObject<string | null>
  currentRouteStateRef: MutableRefObject<unknown>
  hasPendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingMentionExitTarget) => void
}) {
  useEffect(() => {
    if (!hasPendingMentionNotifications) {
      return
    }

    function handlePopState() {
      if (allowHistoryExitRef.current) {
        allowHistoryExitRef.current = false
        return
      }

      const currentHref = currentRouteHrefRef.current

      if (!currentHref) {
        return
      }

      const nextHref = getCurrentNavigationHref()

      if (nextHref === currentHref) {
        return
      }

      window.history.pushState(currentRouteStateRef.current, "", currentHref)
      setPendingExitTarget({
        kind: "history",
      })
      setExitDialogOpen(true)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [
    allowHistoryExitRef,
    currentRouteHrefRef,
    currentRouteStateRef,
    hasPendingMentionNotifications,
    setExitDialogOpen,
    setPendingExitTarget,
  ])
}

export function usePendingMentionRouteRefs(currentEntityId: string | null) {
  const currentRouteHrefRef = useRef<string | null>(null)
  const currentRouteStateRef = useRef<unknown>(null)

  useEffect(() => {
    currentRouteHrefRef.current = getCurrentNavigationHref()
    currentRouteStateRef.current = window.history.state
  }, [currentEntityId])

  return {
    currentRouteHrefRef,
    currentRouteStateRef,
  }
}

export function completePendingMentionExit({
  allowHistoryExitRef,
  closeExitDialog,
  pendingExitTarget,
  router,
}: {
  allowHistoryExitRef: MutableRefObject<boolean>
  closeExitDialog: () => void
  pendingExitTarget: PendingMentionExitTarget
  router: AppRouter
}) {
  const nextTarget = pendingExitTarget
  closeExitDialog()

  if (!nextTarget) {
    return
  }

  if (nextTarget.kind === "href") {
    router.push(nextTarget.href)
    return
  }

  allowHistoryExitRef.current = true
  window.history.back()
}

export function updatePendingMentionExitDialogOpen({
  open,
  sendingMentionNotifications,
  setExitDialogOpen,
  setPendingExitTarget,
}: {
  open: boolean
  sendingMentionNotifications: boolean
  setExitDialogOpen: (open: boolean) => void
  setPendingExitTarget: (target: PendingMentionExitTarget) => void
}) {
  if (sendingMentionNotifications) {
    return
  }

  setExitDialogOpen(open)

  if (!open) {
    setPendingExitTarget(null)
  }
}
