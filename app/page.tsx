import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { buildSessionResolvePath } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { resolveWorkspaceEntryNavigation } from "@/lib/server/workspace-entry-navigation"

type HomePageProps = {
  searchParams: Promise<{
    validated?: string
  }>
}

export default async function Page({ searchParams }: HomePageProps) {
  const params = await searchParams
  const auth = await withAuth()

  if (auth.user && params.validated !== "1") {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath: "/?validated=1",
      })
    )
  }

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

  let workspaceRedirectPath: string | null = null

  try {
    const { navigation } = await resolveWorkspaceEntryNavigation({
      workosUserId: auth.user.id,
      email: auth.user.email ?? undefined,
      workspaceId: authContext.currentWorkspace.id,
    })

    if (navigation.kind !== "target") {
      workspaceRedirectPath = navigation.path
    }
  } catch (error) {
    console.error("Failed to resolve available workspaces", error)
  }

  if (workspaceRedirectPath) {
    redirect(workspaceRedirectPath)
  }

  redirect("/workspace/projects")
}
