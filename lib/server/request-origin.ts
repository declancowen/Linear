import { headers } from "next/headers"

import { getAppOrigin, getConfiguredAppOrigin } from "@/lib/auth-routing"

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function readHeaderValue(value: string | null) {
  const trimmed = value
    ?.split(",")[0]
    ?.trim()

  return trimmed ? trimmed : null
}

export async function resolveServerOrigin() {
  const configuredOrigin = getConfiguredAppOrigin()

  if (configuredOrigin) {
    return configuredOrigin
  }

  try {
    const requestHeaders = await headers()
    const directOrigin = readHeaderValue(requestHeaders.get("origin"))

    if (directOrigin) {
      return trimTrailingSlash(directOrigin)
    }

    const host =
      readHeaderValue(requestHeaders.get("x-forwarded-host")) ??
      readHeaderValue(requestHeaders.get("host"))
    const protocol =
      readHeaderValue(requestHeaders.get("x-forwarded-proto")) ?? "https"

    if (host) {
      return trimTrailingSlash(`${protocol}://${host}`)
    }
  } catch {
    // The helper is also used in unit tests and non-request contexts.
  }

  return getAppOrigin()
}
