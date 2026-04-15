import { cookies } from "next/headers"
import { signOut } from "@workos-inc/authkit-nextjs"

import {
  clearPendingEmailVerificationCookieOptions,
  pendingEmailVerificationCookieName,
} from "@/lib/auth-email-verification"

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
  return handleLogout(request)
}

export async function GET(request: Request) {
  return handleLogout(request)
}

async function handleLogout(request: Request) {
  const url = new URL(request.url)
  const formData = await request.formData().catch(() => null)
  const requestedReturnTo =
    url.searchParams.get("returnTo") ??
    (typeof formData?.get("returnTo") === "string"
      ? String(formData.get("returnTo"))
      : null)
  const returnTo = resolveReturnTo(url, requestedReturnTo)
  const cookieStore = await cookies()

  cookieStore.set(
    pendingEmailVerificationCookieName,
    "",
    clearPendingEmailVerificationCookieOptions
  )

  return signOut({ returnTo })
}
