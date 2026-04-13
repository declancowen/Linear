import { signOut } from "@workos-inc/authkit-nextjs"

function resolveReturnTo(requestUrl: URL, requestedReturnTo: string | null) {
  const fallbackReturnTo = new URL("/login", requestUrl.origin)

  if (!requestedReturnTo) {
    return fallbackReturnTo.toString()
  }

  try {
    const target = new URL(requestedReturnTo, requestUrl.origin)

    if (target.origin !== requestUrl.origin) {
      return fallbackReturnTo.toString()
    }

    return target.toString()
  } catch {
    return fallbackReturnTo.toString()
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const formData = await request.formData().catch(() => null)
  const requestedReturnTo =
    url.searchParams.get("returnTo") ??
    (typeof formData?.get("returnTo") === "string"
      ? String(formData.get("returnTo"))
      : null)
  const returnTo = resolveReturnTo(url, requestedReturnTo)

  await signOut({ returnTo })
}
