import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import {
  buildSessionResolvePath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

type LoginPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    error?: string
    notice?: string
    email?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextPath = normalizeAuthNextPath(params.next)

  const auth = await withAuth()

  if (auth.user) {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath,
      })
    )
  }

  return (
    <AuthEntryScreen
      mode="login"
      nextPath={nextPath}
      error={params.error}
      notice={params.notice}
      initialEmail={params.email}
    />
  )
}
