import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import {
  buildSessionResolvePath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

type SignupPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    error?: string
    notice?: string
    email?: string
    firstName?: string
    lastName?: string
  }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const nextPath = normalizeAuthNextPath(params.next)

  const auth = await withAuth()

  if (auth.user) {
    redirect(
      buildSessionResolvePath({
        mode: "signup",
        nextPath,
      })
    )
  }

  return (
    <AuthEntryScreen
      mode="signup"
      nextPath={nextPath}
      error={params.error}
      notice={params.notice}
      initialEmail={params.email}
      initialFirstName={params.firstName}
      initialLastName={params.lastName}
    />
  )
}
