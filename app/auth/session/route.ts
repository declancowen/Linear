import { refreshSession } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  buildAuthPageHref,
  buildLogoutPath,
  buildPostAuthPath,
  normalizeAuthNextPath,
  parseAuthMode,
} from "@/lib/auth-routing"

export async function GET(request: NextRequest) {
  const mode = parseAuthMode(request.nextUrl.searchParams.get("mode")) ?? "login"
  const nextPath = normalizeAuthNextPath(
    request.nextUrl.searchParams.get("next")
  )

  try {
    const auth = await refreshSession()

    if (!auth.user) {
      return NextResponse.redirect(
        new URL(
          buildAuthPageHref(mode, {
            nextPath,
          }),
          request.url
        )
      )
    }

    return NextResponse.redirect(
      new URL(buildPostAuthPath(nextPath), request.url)
    )
  } catch {
    return NextResponse.redirect(
      new URL(
        buildLogoutPath(
          buildAuthPageHref(mode, {
            nextPath,
            notice: "Your session expired. Sign in again.",
          })
        ),
        request.url
      )
    )
  }
}
