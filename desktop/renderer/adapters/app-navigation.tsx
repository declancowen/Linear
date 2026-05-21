"use client"

import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  useMemo,
  useSyncExternalStore,
} from "react"

type NavigateMode = "push" | "replace"

const DEFAULT_DESKTOP_ROUTE = "/workspace/projects"

const subscribers = new Set<() => void>()

function emitRouteChange() {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function subscribeToLocationChange(callback: () => void) {
  subscribers.add(callback)
  window.addEventListener("popstate", callback)
  window.addEventListener("hashchange", callback)

  return () => {
    subscribers.delete(callback)
    window.removeEventListener("popstate", callback)
    window.removeEventListener("hashchange", callback)
  }
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
}

function isExternalHref(href: string) {
  try {
    const parsed = new URL(href, window.location.href)

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:"
    ) && parsed.origin !== window.location.origin
  } catch {
    return false
  }
}

function normalizeRoutePath(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return DEFAULT_DESKTOP_ROUTE
  }

  try {
    const parsed = new URL(trimmed, "https://desktop.local")

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  }
}

function getHashRoute() {
  const hash = window.location.hash

  if (!hash || hash === "#") {
    return DEFAULT_DESKTOP_ROUTE
  }

  return normalizeRoutePath(hash.slice(1))
}

function getBrowserRoute() {
  if (window.location.protocol === "file:") {
    return getHashRoute()
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getServerRoute() {
  return DEFAULT_DESKTOP_ROUTE
}

function getPathnameFromRoute(route: string) {
  return new URL(route, "https://desktop.local").pathname
}

function getSearchFromRoute(route: string) {
  return new URL(route, "https://desktop.local").search
}

function navigateToRoute(href: string, mode: NavigateMode) {
  if (isExternalHref(href)) {
    window.location.assign(href)
    return
  }

  const route = normalizeRoutePath(href)

  if (window.location.protocol === "file:") {
    const nextHash = `#${route}`

    if (mode === "replace") {
      window.location.replace(nextHash)
      return
    }

    window.location.hash = nextHash
    return
  }

  const nextUrl = `${route}`

  if (mode === "replace") {
    window.history.replaceState(null, "", nextUrl)
  } else {
    window.history.pushState(null, "", nextUrl)
  }

  emitRouteChange()
}

export const AppLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    replace?: boolean
  }
>(function AppLink({ href, onClick, replace, target, ...props }, ref) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      isModifiedClick(event) ||
      target
    ) {
      return
    }

    if (isExternalHref(href)) {
      return
    }

    event.preventDefault()
    navigateToRoute(href, replace ? "replace" : "push")
  }

  return <a ref={ref} href={href} target={target} onClick={handleClick} {...props} />
})

export function useAppPathname() {
  const route = useSyncExternalStore(
    subscribeToLocationChange,
    getBrowserRoute,
    getServerRoute
  )

  return getPathnameFromRoute(route)
}

export function useAppRouter() {
  return useMemo(
    () => ({
      back() {
        window.history.back()
      },
      forward() {
        window.history.forward()
      },
      prefetch() {},
      push(href: string) {
        navigateToRoute(href, "push")
      },
      refresh() {
        emitRouteChange()
      },
      replace(href: string) {
        navigateToRoute(href, "replace")
      },
    }),
    []
  )
}

export function useAppSearchParams() {
  const route = useSyncExternalStore(
    subscribeToLocationChange,
    getBrowserRoute,
    getServerRoute
  )

  return new URLSearchParams(getSearchFromRoute(route))
}

export type AppRouter = ReturnType<typeof useAppRouter>
export type AppSearchParams = ReturnType<typeof useAppSearchParams>
