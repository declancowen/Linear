"use client"

import { buildAppDestination, buildAuthPageHref } from "@/lib/auth-routing"

function buildLogoutHref(returnTo?: string) {
  return returnTo
    ? `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/logout"
}

function resolveLogoutHref(returnTo?: string) {
  const logoutHref = buildLogoutHref(returnTo)

  if (
    window.electronApp?.isElectron &&
    window.location.protocol === "file:"
  ) {
    return `#${buildAuthPageHref("login", { nextPath: returnTo })}`
  }

  return window.electronApp?.isElectron
    ? buildAppDestination(logoutHref)
    : logoutHref
}

async function clearDesktopAuthToken() {
  try {
    await window.electronApp?.clearDesktopAuthToken?.()
  } catch {}
}

function submitLogoutFormNow(returnTo: string) {
  if (typeof document === "undefined") {
    return
  }

  const form = document.createElement("form")
  form.method = "POST"
  form.action = resolveLogoutHref(returnTo)
  document.body.appendChild(form)
  form.submit()
}

export function submitLogoutForm(returnTo: string) {
  void clearDesktopAuthToken().finally(() => {
    if (
      window.electronApp?.isElectron &&
      window.location.protocol === "file:"
    ) {
      window.location.assign(resolveLogoutHref(returnTo))
      return
    }

    submitLogoutFormNow(returnTo)
  })
}

export function navigateToLogout(returnTo?: string) {
  if (typeof window === "undefined") {
    return
  }

  void clearDesktopAuthToken().finally(() => {
    window.location.assign(resolveLogoutHref(returnTo))
  })
}
