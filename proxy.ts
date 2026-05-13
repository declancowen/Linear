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
import { AUTHKIT_PROXY_MATCHERS } from "@/lib/server/proxy-config"

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
  matcher: AUTHKIT_PROXY_MATCHERS,
}
