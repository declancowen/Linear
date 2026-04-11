import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next") ?? "/inbox"
  const signInUrl = await getSignInUrl({
    returnTo: next,
  })

  redirect(signInUrl)
}
