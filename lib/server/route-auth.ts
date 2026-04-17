import { withAuth } from "@workos-inc/authkit-nextjs"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { ensureConvexUserReadyServer } from "@/lib/server/convex"
import { jsonError } from "@/lib/server/route-response"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

type Session = Awaited<ReturnType<typeof withAuth>>
type AppContext = Awaited<ReturnType<typeof ensureAuthenticatedAppContext>>
type ConvexAuthContext = Awaited<ReturnType<typeof ensureConvexUserReadyServer>>

export type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]>
}

export type RequiredAppContext = AppContext & {
  ensuredUser: NonNullable<AppContext["ensuredUser"]>
}

export type RequiredConvexAuthContext = NonNullable<ConvexAuthContext> & {
  currentUser: NonNullable<NonNullable<ConvexAuthContext>["currentUser"]>
}

export async function requireSession(): Promise<
  AuthenticatedSession | Response
> {
  const session = await withAuth()

  if (!session.user) {
    return jsonError("Unauthorized", 401, {
      code: "AUTH_UNAUTHORIZED",
    })
  }

  return session as AuthenticatedSession
}

export async function requireAppContext(
  session: AuthenticatedSession
): Promise<RequiredAppContext | Response> {
  const appContext = await ensureAuthenticatedAppContext(
    session.user,
    session.organizationId
  )

  if (!appContext?.ensuredUser) {
    return jsonError("User context not found", 404, {
      code: "AUTH_APP_CONTEXT_NOT_FOUND",
    })
  }

  return appContext as RequiredAppContext
}

export async function requireConvexUser(
  session: AuthenticatedSession
): Promise<RequiredConvexAuthContext | Response> {
  const authContext = await ensureConvexUserReadyServer(
    toAuthenticatedAppUser(session.user, session.organizationId)
  )

  if (!authContext?.currentUser) {
    return jsonError("User context not found", 404, {
      code: "AUTH_CONVEX_USER_NOT_FOUND",
    })
  }

  return authContext as RequiredConvexAuthContext
}
