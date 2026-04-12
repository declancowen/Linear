import { NextResponse } from "next/server"

import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildPortalPageHref,
  getPortalOrigin,
  normalizePortalAuthNextPath,
  parsePortalAppId,
} from "@/lib/portal"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getPortalOrigin()), {
    status: request.method === "POST" ? 303 : 307,
  })
}

function mapSignupError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return "An account already exists for that email."
  }

  return "We couldn't create that account."
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const appId = parsePortalAppId(url.searchParams.get("app"))
  const nextPath = normalizePortalAuthNextPath(url.searchParams.get("next"), appId)

  return redirectTo(
    request,
    buildPortalPageHref("signup", {
      appId,
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const appId = parsePortalAppId(String(formData.get("app") ?? ""))
  const nextPath = normalizePortalAuthNextPath(
    String(formData.get("next") ?? ""),
    appId
  )

  if (!firstName || !lastName || !email || !password) {
    return redirectTo(
      request,
      buildPortalPageHref("signup", {
        appId,
        nextPath,
        email,
        error: "Complete every field to create your account.",
        notice: null,
      }) +
        `&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(
          lastName
        )}`
    )
  }

  try {
    await getWorkOSClient().userManagement.createUser({
      email,
      password,
      firstName,
      lastName,
    })

    return redirectTo(
      request,
      buildPortalPageHref("login", {
        appId,
        nextPath,
        email,
        notice: "Account created. Sign in to continue.",
      })
    )
  } catch (error) {
    return redirectTo(
      request,
      buildPortalPageHref("signup", {
        appId,
        nextPath,
        email,
        error: mapSignupError(error),
      }) +
        `&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(
          lastName
        )}`
    )
  }
}
