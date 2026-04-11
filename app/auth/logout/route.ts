import { signOut } from "@workos-inc/authkit-nextjs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const returnTo = new URL("/login", url.origin).toString()

  await signOut({ returnTo })
}
