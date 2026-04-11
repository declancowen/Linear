import { getSignUpUrl } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next") ?? "/inbox"
  const signUpUrl = await getSignUpUrl({
    returnTo: next,
  })

  redirect(signUpUrl)
}
