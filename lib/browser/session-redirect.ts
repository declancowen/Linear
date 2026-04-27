"use client"

import {
  buildAuthPageHref,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

export function redirectToExpiredSessionLogin() {
  if (typeof window === "undefined") {
    return
  }

  const nextPath = normalizeAuthNextPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  )

  window.location.assign(
    buildAuthPageHref("login", {
      nextPath,
      notice: "Your session expired. Sign in again to continue.",
    })
  )
}
