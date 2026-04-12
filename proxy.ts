import { authkitProxy } from "@workos-inc/authkit-nextjs"

export default authkitProxy()

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/inbox",
    "/assigned",
    "/onboarding",
    "/workspace/:path*",
    "/team/:path*",
    "/projects/:path*",
    "/items/:path*",
    "/docs/:path*",
    "/join/:path*",
    "/api/invites/:path*",
    "/api/comments/:path*",
    "/api/documents/:path*",
    "/api/items/:path*",
    "/api/notifications/:path*",
    "/api/projects/:path*",
    "/api/profile/:path*",
    "/api/teams/:path*",
    "/api/views/:path*",
    "/api/workspace/:path*",
  ],
}
