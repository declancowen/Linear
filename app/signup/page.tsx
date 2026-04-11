import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

type SignupPageProps = {
  searchParams: Promise<{
    next?: string
  }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const auth = await withAuth()
  const params = await searchParams
  const nextPath = params.next?.trim() || "/onboarding"

  if (auth.user) {
    const { authContext } = await ensureAuthenticatedAppContext(
      auth.user,
      auth.organizationId
    )

    redirect(authContext?.currentWorkspace ? nextPath : "/onboarding")
  }

  return <AuthEntryScreen mode="signup" nextPath={nextPath} />
}
