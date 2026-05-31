import { NextRequest } from "next/server"

import {
  customPropertyDefinitionSchema,
  type AppSnapshot,
} from "@/lib/domain/types"
import {
  getCustomPropertyScopeType,
  isCustomPropertyDefinitionVisibleToUser,
} from "@/lib/domain/labels"
import {
  bumpScopedReadModelVersionsServer,
  createCustomPropertyDefinitionServer,
} from "@/lib/server/convex"
import { getSnapshotServer } from "@/lib/server/convex"
import { handleCustomPropertyRouteError } from "@/lib/server/custom-property-route-utils"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { resolveCustomPropertyDefinitionReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

type AuthenticatedSession = Exclude<
  Awaited<ReturnType<typeof requireSession>>,
  Response
>

type CustomPropertyListContext = {
  session: AuthenticatedSession
  teamId: string
}

type CustomPropertyCreateContext = {
  currentUserId: string
  parsed: Exclude<
    Awaited<ReturnType<typeof parseCreateCustomPropertyRequest>>,
    Response
  >
  session: AuthenticatedSession
}

async function requireCustomPropertySession() {
  return requireSession()
}

function requireTeamId(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId")

  if (!teamId) {
    return jsonError("teamId is required", 400, {
      code: "CUSTOM_PROPERTIES_TEAM_REQUIRED",
    })
  }

  return teamId
}

async function getCustomPropertiesSnapshot(session: AuthenticatedSession) {
  return (await getSnapshotServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
  })) as AppSnapshot
}

function assertCanAccessCustomPropertyTeam(
  snapshot: AppSnapshot,
  teamId: string
) {
  const canAccessTeam = snapshot.teams.some((team) => team.id === teamId)

  if (!canAccessTeam) {
    return jsonError("You do not have access to this team", 403, {
      code: "CUSTOM_PROPERTY_ACCESS_DENIED",
    })
  }

  return null
}

async function requireCustomPropertyListContext(
  request: NextRequest
): Promise<CustomPropertyListContext | Response> {
  const session = await requireCustomPropertySession()

  if (isRouteResponse(session)) {
    return session
  }

  const teamId = requireTeamId(request)

  if (isRouteResponse(teamId)) {
    return teamId
  }

  return {
    session,
    teamId,
  }
}

async function listCustomProperties(context: CustomPropertyListContext) {
  try {
    const snapshot = await getCustomPropertiesSnapshot(context.session)
    const accessError = assertCanAccessCustomPropertyTeam(
      snapshot,
      context.teamId
    )

    if (accessError) {
      return accessError
    }

    const definitions = snapshot.customPropertyDefinitions ?? []

    return jsonOk({
      ok: true,
      properties: definitions.filter(
        (definition) =>
          definition.teamId === context.teamId &&
          !definition.isArchived &&
          getCustomPropertyScopeType(definition) === "team" &&
          isCustomPropertyDefinitionVisibleToUser(
            definition,
            snapshot.currentUserId
          )
      ),
    })
  } catch (error) {
    return handleCustomPropertyRouteError(
      error,
      "Failed to list custom properties",
      "CUSTOM_PROPERTY_LIST_FAILED"
    )
  }
}

export async function GET(request: NextRequest) {
  const context = await requireCustomPropertyListContext(request)

  if (isRouteResponse(context)) {
    return context
  }

  return listCustomProperties(context)
}

async function parseCreateCustomPropertyRequest(request: NextRequest) {
  return parseJsonBody(
    request,
    customPropertyDefinitionSchema,
    "Invalid custom property payload"
  )
}

async function requireCustomPropertyCreateContext(
  request: NextRequest
): Promise<CustomPropertyCreateContext | Response> {
  const session = await requireCustomPropertySession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseCreateCustomPropertyRequest(request)

  if (isRouteResponse(parsed)) {
    return parsed
  }

  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  return {
    currentUserId: appContext.ensuredUser.userId,
    parsed,
    session,
  }
}

async function createCustomProperty(context: CustomPropertyCreateContext) {
  try {
    const result = await createCustomPropertyDefinitionServer({
      currentUserId: context.currentUserId,
      teamId: context.parsed.teamId,
      scopeType: "team",
      targetType: context.parsed.targetType,
      name: context.parsed.name,
      icon: context.parsed.icon,
      type: context.parsed.type,
      options: context.parsed.options,
    })
    const scopeKeys =
      await resolveCustomPropertyDefinitionReadModelScopeKeysServer(
        context.session,
        context.parsed.teamId
      )
    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({
      ok: true,
      property: result?.property ?? null,
    })
  } catch (error) {
    return handleCustomPropertyRouteError(
      error,
      "Failed to create custom property",
      "CUSTOM_PROPERTY_CREATE_FAILED"
    )
  }
}

export async function POST(request: NextRequest) {
  const context = await requireCustomPropertyCreateContext(request)

  if (isRouteResponse(context)) {
    return context
  }

  return createCustomProperty(context)
}
