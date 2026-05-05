import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import {
  type AuthMode,
  buildSessionResolvePath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

export async function getSignedOutAuthPageContext(input: {
  mode: AuthMode
  next?: string | null
}) {
  const nextPath = normalizeAuthNextPath(input.next)
  const auth = await withAuth()

  if (auth.user) {
    redirect(
      buildSessionResolvePath({
        mode: input.mode,
        nextPath,
      })
    )
  }

  return { nextPath }
}
