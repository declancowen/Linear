import {
  buildAuthPageHref,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import { redirectToRoute } from "@/lib/server/route-response"
import {
  mapWorkOSAccountError,
  resetWorkOSPassword,
} from "@/lib/server/workos"

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
    return redirectToRoute(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: "That password reset link is missing its token.",
      })
    )
  }

  if (!newPassword) {
    return redirectToRoute(
      request,
      buildResetPasswordPageHref({
        token,
        nextPath,
        error: "Enter a new password.",
      })
    )
  }

  if (newPassword !== confirmPassword) {
    return redirectToRoute(
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

    return redirectToRoute(
      request,
      buildAuthPageHref("login", {
        nextPath,
        notice: "Password updated. Sign in with your new password.",
      })
    )
  } catch (error) {
    return redirectToRoute(
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
