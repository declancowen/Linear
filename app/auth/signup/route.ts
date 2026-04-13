import { NextResponse } from "next/server"

import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildAuthPageHref,
  getAppOrigin,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getAppOrigin()), {
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
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))

  return redirectTo(
    request,
    buildAuthPageHref("signup", {
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
  const nextPath = normalizeAuthNextPath(String(formData.get("next") ?? ""))

  if (!firstName || !lastName || !email || !password) {
    return redirectTo(
      request,
      buildAuthPageHref("signup", {
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
      buildAuthPageHref("login", {
        nextPath,
        email,
        notice: "Account created. Sign in to continue.",
      })
    )
  } catch (error) {
    return redirectTo(
      request,
      buildAuthPageHref("signup", {
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
