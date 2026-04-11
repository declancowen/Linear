import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

type LoginPageProps = {
  searchParams: Promise<{
    next?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const auth = await withAuth()
  const params = await searchParams
  const nextPath = params.next?.trim() || "/inbox"

  if (auth.user) {
    const { authContext } = await ensureAuthenticatedAppContext(
      auth.user,
      auth.organizationId
    )

    redirect(authContext?.currentWorkspace ? nextPath : "/onboarding")
  }

  return <AuthEntryScreen mode="login" nextPath={nextPath} />
}
