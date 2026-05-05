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

export type RequiredConvexRouteContext = {
  authContext: RequiredConvexAuthContext
  authenticatedUser: ReturnType<typeof toAuthenticatedAppUser>
  session: AuthenticatedSession
}

export type RequiredAppRouteContext = {
  appContext: RequiredAppContext
  session: AuthenticatedSession
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

export async function requireAppRouteContext(): Promise<
  RequiredAppRouteContext | Response
> {
  const session = await requireSession()

  if (session instanceof Response) {
    return session
  }

  const appContext = await requireAppContext(session)

  if (appContext instanceof Response) {
    return appContext
  }

  return { appContext, session }
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

export async function requireConvexRouteContext(): Promise<
  RequiredConvexRouteContext | Response
> {
  const session = await requireSession()

  if (session instanceof Response) {
    return session
  }

  const authContext = await requireConvexUser(session)

  if (authContext instanceof Response) {
    return authContext
  }

  return {
    authContext,
    authenticatedUser: toAuthenticatedAppUser(
      session.user,
      session.organizationId
    ),
    session,
  }
}
