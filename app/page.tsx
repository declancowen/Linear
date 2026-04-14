import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { buildSessionResolvePath } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

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

  redirect("/workspace/projects")
}
