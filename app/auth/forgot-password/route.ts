import { NextResponse } from "next/server"

import { getAppOrigin } from "@/lib/auth-routing"
import { requestWorkOSPasswordReset } from "@/lib/server/workos"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getAppOrigin()), {
    status: request.method === "POST" ? 303 : 307,
  })
}

function buildForgotPasswordPageHref(input: {
  nextPath: string
  email: string
  error?: string | null
  notice?: string | null
}) {
  const url = new URL("/forgot-password", "https://teams.placeholder")

  if (input.nextPath) {
    url.searchParams.set("next", input.nextPath)
  }

  if (input.email) {
    url.searchParams.set("email", input.email)
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
  const email = String(formData.get("email") ?? "").trim()
  const nextPath = String(formData.get("next") ?? "")

  if (!email) {
    return redirectTo(
      request,
      buildForgotPasswordPageHref({
        nextPath,
        email,
        error: "Enter the email you use to sign in.",
      })
    )
  }

  try {
    await requestWorkOSPasswordReset(email)
  } catch (error) {
    console.error("Failed to request password reset", error)
  }

  return redirectTo(
    request,
    buildForgotPasswordPageHref({
      nextPath,
      email,
      notice:
        "If an account exists for that email, a password reset link has been sent.",
    })
  )
}
