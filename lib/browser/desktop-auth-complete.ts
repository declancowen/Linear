"use client"

import { buildPublicApiUrl } from "@/lib/api/public-url"
import {
  buildAuthPageHref,
  normalizeAuthNextPath,
  parseAuthMode,
} from "@/lib/auth-routing"

type DesktopSessionResponse = {
  expiresAt: number
  token: string
}

type DesktopAuthSearchParams = {
  get: (name: string) => string | null
}

type DesktopAuthCompleteOptions = {
  setDesktopAuthToken?: (token: string) => Promise<unknown> | unknown
}

type DesktopAuthCompleteResult =
  | {
      href: string
      kind: "redirect"
    }
  | {
      kind: "authenticated"
      nextPath: string
    }

async function exchangeDesktopTicket(ticket: string) {
  const response = await fetch(buildPublicApiUrl("/api/auth/desktop/session"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket }),
  })

  if (!response.ok) {
    throw new Error("Desktop authentication failed")
  }

  return response.json() as Promise<DesktopSessionResponse>
}

function buildExpiredDesktopAuthRedirect(nextPath: string) {
  return buildAuthPageHref("login", {
    error: "Desktop authentication expired. Sign in again.",
    nextPath,
  })
}

export async function completeDesktopAuthFromSearchParams(
  searchParams: DesktopAuthSearchParams,
  options: DesktopAuthCompleteOptions = {}
): Promise<DesktopAuthCompleteResult> {
  const nextPath = normalizeAuthNextPath(searchParams.get("next"))
  const error = searchParams.get("error")
  const mode = parseAuthMode(searchParams.get("mode")) ?? "login"

  if (error) {
    return {
      href: buildAuthPageHref(mode, {
        error,
        nextPath,
        email: searchParams.get("email"),
        firstName: searchParams.get("firstName"),
        lastName: searchParams.get("lastName"),
      }),
      kind: "redirect",
    }
  }

  const ticket = searchParams.get("ticket")

  if (!ticket) {
    return {
      href: buildExpiredDesktopAuthRedirect(nextPath),
      kind: "redirect",
    }
  }

  try {
    const session = await exchangeDesktopTicket(ticket)
    await options.setDesktopAuthToken?.(session.token)

    return {
      kind: "authenticated",
      nextPath,
    }
  } catch {
    return {
      href: buildExpiredDesktopAuthRedirect(nextPath),
      kind: "redirect",
    }
  }
}
