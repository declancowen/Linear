import { buildForgotPasswordPageHref } from "@/lib/auth-routing"
import { logProviderError } from "@/lib/server/provider-errors"
import { redirectToRoute } from "@/lib/server/route-response"
import { requestWorkOSPasswordReset } from "@/lib/server/workos"

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email") ?? "").trim()
  const nextPath = String(formData.get("next") ?? "")

  if (!email) {
    return redirectToRoute(
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
    logProviderError("Failed to request password reset", error)
  }

  return redirectToRoute(
    request,
    buildForgotPasswordPageHref({
      nextPath,
      email,
      notice:
        "If an account exists for that email, a password reset link has been sent.",
    })
  )
}
