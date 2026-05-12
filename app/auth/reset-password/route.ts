import {
  buildAuthPageHref,
  buildResetPasswordPageHref,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import { redirectToRoute } from "@/lib/server/route-response"
import {
  mapWorkOSAccountError,
  resetWorkOSPassword,
} from "@/lib/server/workos"

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
