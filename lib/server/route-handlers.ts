import type { output, ZodTypeAny } from "zod"
import { z } from "zod"

import {
  type ApplicationError,
  isApplicationError,
} from "@/lib/server/application-errors"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  type AuthenticatedSession,
  requireAppContext,
  requireConvexUser,
  requireSession,
  type RequiredAppContext,
  type RequiredConvexAuthContext,
} from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
} from "@/lib/server/route-response"
import {
  type AuthenticatedAppUser,
  toAuthenticatedAppUser,
} from "@/lib/workos/auth"

export const reactionPayloadSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
})

export const mentionNotificationsPayloadSchema = z.object({
  mentions: z.array(
    z.object({
      userId: z.string().trim().min(1),
      count: z.number().int().positive().max(1000),
    })
  ),
})

export const presencePayloadSchema = z.object({
  action: z.enum(["heartbeat", "leave"]),
  sessionId: z.string().trim().min(8).max(128),
  activeBlockId: z.string().trim().min(1).max(256).nullable().optional(),
})

export const inviteTokenPayloadSchema = z.object({
  token: z.string().min(1),
})

export function createPresenceHeartbeatInput(input: {
  authContext: RequiredConvexAuthContext
  authenticatedUser: AuthenticatedAppUser
  parsed: output<typeof presencePayloadSchema>
}) {
  return {
    currentUserId: input.authContext.currentUser.id,
    workosUserId: input.authenticatedUser.workosUserId,
    email: input.authenticatedUser.email,
    name: input.authContext.currentUser.name,
    avatarUrl: input.authContext.currentUser.avatarUrl,
    avatarImageUrl: input.authContext.currentUser.avatarImageUrl ?? null,
    activeBlockId: input.parsed.activeBlockId ?? null,
    sessionId: input.parsed.sessionId,
  }
}

type JsonRouteErrorInput<TParsed> = {
  session: AuthenticatedSession
  parsed: TParsed
}

type JsonRouteOptions<TSchema extends ZodTypeAny, TContext> = {
  schema: TSchema
  invalidMessage: string
  failureLogLabel: string
  failureMessage: string
  failureCode?: string
  resolveContext: (session: AuthenticatedSession) => Promise<TContext | Response>
  handle: (input: {
    session: AuthenticatedSession
    context: TContext
    parsed: output<TSchema>
  }) => Promise<Response> | Response
  handleApplicationError?: (
    error: ApplicationError,
    input: JsonRouteErrorInput<output<TSchema>>
  ) => Response | undefined
}

async function handleJsonRoute<TSchema extends ZodTypeAny, TContext>(
  request: Request,
  options: JsonRouteOptions<TSchema, TContext>
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    options.schema,
    options.invalidMessage
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const context = await options.resolveContext(session)

    if (isRouteResponse(context)) {
      return context
    }

    return await options.handle({
      session,
      context,
      parsed,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      const handled = options.handleApplicationError?.(error, {
        session,
        parsed,
      })

      return handled ?? jsonApplicationError(error)
    }

    logProviderError(options.failureLogLabel, error)
    const details = options.failureCode
      ? {
          code: options.failureCode,
        }
      : undefined

    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      details
    )
  }
}

export async function handleAppContextJsonRoute<TSchema extends ZodTypeAny>(
  request: Request,
  options: {
    schema: TSchema
    invalidMessage: string
    failureLogLabel: string
    failureMessage: string
    failureCode?: string
    handle: (input: {
      session: AuthenticatedSession
      appContext: RequiredAppContext
      parsed: output<TSchema>
    }) => Promise<Response> | Response
  }
) {
  return handleJsonRoute(request, {
    ...options,
    resolveContext: requireAppContext,
    handle({ session, context, parsed }) {
      return options.handle({
        session,
        appContext: context,
        parsed,
      })
    },
  })
}

export async function handleAuthenticatedJsonRoute<TSchema extends ZodTypeAny>(
  request: Request,
  options: {
    schema: TSchema
    invalidMessage: string
    failureLogLabel: string
    failureMessage: string
    failureCode?: string
    handle: (input: {
      session: AuthenticatedSession
      parsed: output<TSchema>
    }) => Promise<Response> | Response
    handleApplicationError?: (
      error: ApplicationError,
      input: JsonRouteErrorInput<output<TSchema>>
    ) => Response | undefined
  }
) {
  return handleJsonRoute(request, {
    ...options,
    async resolveContext() {
      return null
    },
    handle({ session, parsed }) {
      return options.handle({
        session,
        parsed,
      })
    },
  })
}

export async function handleAppContextRoute(options: {
  failureLogLabel: string
  failureMessage: string
  failureCode?: string
  handle: (input: {
    session: AuthenticatedSession
    appContext: RequiredAppContext
  }) => Promise<Response> | Response
  handleApplicationError?: (
    error: ApplicationError,
    input: {
      session: AuthenticatedSession
    }
  ) => Response | undefined
}) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    return await options.handle({
      session,
      appContext,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      const handled = options.handleApplicationError?.(error, {
        session,
      })

      return handled ?? jsonApplicationError(error)
    }

    logProviderError(options.failureLogLabel, error)
    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      options.failureCode
        ? {
            code: options.failureCode,
          }
        : undefined
    )
  }
}

export async function handleConvexUserJsonRoute<TSchema extends ZodTypeAny>(
  request: Request,
  options: {
    schema: TSchema
    invalidMessage: string
    failureLogLabel: string
    failureMessage: string
    failureCode?: string
    handle: (input: {
      session: AuthenticatedSession
      authContext: RequiredConvexAuthContext
      authenticatedUser: AuthenticatedAppUser
      parsed: output<TSchema>
    }) => Promise<Response> | Response
    handleApplicationError?: (
      error: ApplicationError,
      input: JsonRouteErrorInput<output<TSchema>>
    ) => Response | undefined
  }
) {
  return handleJsonRoute(request, {
    ...options,
    async resolveContext(session) {
      const authContext = await requireConvexUser(session)

      if (isRouteResponse(authContext)) {
        return authContext
      }

      return {
        authContext,
        authenticatedUser: toAuthenticatedAppUser(
          session.user,
          session.organizationId
        ),
      }
    },
    handle({ session, context, parsed }) {
      return options.handle({
        session,
        authContext: context.authContext,
        authenticatedUser: context.authenticatedUser,
        parsed,
      })
    },
  })
}
