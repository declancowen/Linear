import { NextResponse } from "next/server"

import {
  buildAuthPageHref,
  getAppOrigin,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import {
  mapWorkOSAccountError,
  resetWorkOSPassword,
} from "@/lib/server/workos"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getAppOrigin()), {
    status: request.method === "POST" ? 303 : 307,
  })
}

function buildResetPasswordPageHref(input: {
  token: string
  nextPath?: string | null
  error?: string | null
  notice?: string | null
}) {
  const url = new URL("/reset-password", "https://teams.placeholder")

  if (input.token) {
    url.searchParams.set("token", input.token)
  }

  if (input.nextPath) {
    url.searchParams.set("next", input.nextPath)
  }

  if (input.error) {
    url.searchParams.set("error", input.error)
  }

  if (input.notice) {
    url.searchParams.set("notice", input.notice)
  }

  return `${url.pathname}${url.search}`
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const token = String(formData.get("token") ?? "").trim()
  const newPassword = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const nextPath = normalizeAuthNextPath(String(formData.get("next") ?? ""))

  if (!token) {
    return redirectTo(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: "That password reset link is missing its token.",
      })
    )
  }

  if (!newPassword) {
    return redirectTo(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: "Enter a new password.",
      })
    )
  }

  if (newPassword !== confirmPassword) {
    return redirectTo(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: "The passwords do not match.",
      })
    )
  }

  try {
    await resetWorkOSPassword({
      token,
      newPassword,
    })

    return redirectTo(
      request,
      buildAuthPageHref("login", {
        nextPath,
        notice: "Password updated. Sign in with your new password.",
      })
    )
  } catch (error) {
    return redirectTo(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: mapWorkOSAccountError(
          error,
          "We couldn't reset your password."
        ),
      })
    )
  }
}
