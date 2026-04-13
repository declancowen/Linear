import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export default async function Page() {
  const auth = await withAuth()

  if (!auth.user) {
    redirect("/login")
  }

  const { authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  if (!authContext?.currentWorkspace) {
    redirect("/onboarding")
  }

  redirect("/workspace/projects")
}
