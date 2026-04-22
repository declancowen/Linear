import {
  applyResponseHeaders,
  authkit,
  partitionAuthkitHeaders,
} from "@workos-inc/authkit-nextjs"
import { NextResponse, type NextRequest } from "next/server"

import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/server/security-headers"

const isProduction = process.env.NODE_ENV === "production"
const authkitRedirectUri =
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? process.env.WORKOS_REDIRECT_URI

export default async function proxy(request: NextRequest) {
  const { headers: authkitHeaders } = await authkit(request, {
    redirectUri: authkitRedirectUri,
  })
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    request,
    authkitHeaders
  )

  const nonce = generateCspNonce()
  requestHeaders.set("x-nonce", nonce)

  const response = applyResponseHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    responseHeaders
  )

  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({
      isProduction,
      nonce,
    })
  )

  return response
}

export const config = {
  matcher: [
    "/",
    "/callback",
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/forgot-password",
    "/auth/google",
    "/auth/login",
    "/auth/reset-password",
    "/auth/session",
    "/auth/signup",
    "/auth/verify-email",
    // Leave logout outside AuthKit proxy so middleware cannot refresh the session.
    "/inbox",
    "/invites",
    "/assigned",
    "/chats",
    "/settings/:path*",
    "/onboarding",
    "/workspace/:path*",
    "/team/:path*",
    "/projects/:path*",
    "/items/:path*",
    "/docs/:path*",
    "/join/:path*",
    "/api/account/:path*",
    "/api/attachments/:path*",
    "/api/calls/:path*",
    "/api/collaboration/:path*",
    "/api/invites/:path*",
    "/api/labels/:path*",
    "/api/channel-posts/:path*",
    "/api/channels/:path*",
    "/api/chats/:path*",
    "/api/comments/:path*",
    "/api/documents/:path*",
    "/api/events/:path*",
    "/api/items/:path*",
    "/api/notifications/:path*",
    "/api/projects/:path*",
    "/api/profile/:path*",
    "/api/read-models/:path*",
    "/api/snapshot/:path*",
    "/api/settings-images/:path*",
    "/api/teams/:path*",
    "/api/views/:path*",
    "/api/workspaces/:path*",
    "/api/workspace/:path*",
  ],
}
