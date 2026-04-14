import { withAuth } from "@workos-inc/authkit-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AuthEmailVerificationScreen } from "@/components/app/auth-email-verification-screen"
import {
  buildAuthPageHref,
  buildSessionResolvePath,
  normalizeAuthNextPath,
  parseAuthMode,
} from "@/lib/auth-routing"
import {
  parsePendingEmailVerificationState,
  pendingEmailVerificationCookieName,
} from "@/lib/auth-email-verification"

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string
    error?: string
    mode?: string
    next?: string
    notice?: string
  }>
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams
  const nextPath = normalizeAuthNextPath(params.next)
  const mode = parseAuthMode(params.mode) ?? "login"
  const cookieStore = await cookies()
  const verificationState = parsePendingEmailVerificationState(
    cookieStore.get(pendingEmailVerificationCookieName)?.value
  )

  if (!verificationState) {
    const auth = await withAuth()

    if (auth.user) {
      redirect(
        buildSessionResolvePath({
          mode,
          nextPath,
        })
      )
    }
  }

  if (!verificationState) {
    redirect(
      buildAuthPageHref(mode, {
        nextPath,
        email: params.email,
        error: "Your verification session expired. Sign in again.",
      })
    )
  }

  return (
    <AuthEmailVerificationScreen
      mode={verificationState.mode}
      nextPath={verificationState.nextPath}
      email={verificationState.email}
      error={params.error}
      notice={params.notice}
    />
  )
}
