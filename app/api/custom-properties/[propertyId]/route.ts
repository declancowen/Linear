import { NextRequest } from "next/server"

import { customPropertyDefinitionPatchSchema } from "@/lib/domain/types"
import {
  archiveCustomPropertyDefinitionServer,
  bumpScopedReadModelVersionsServer,
  updateCustomPropertyDefinitionServer,
} from "@/lib/server/convex"
import { getWorkIndexScopeKeys } from "@/lib/scoped-sync/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import { handleCustomPropertyRouteError } from "@/lib/server/custom-property-route-utils"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonOk } from "@/lib/server/route-response"

async function resolvePropertyTeamId(
  session: Exclude<Awaited<ReturnType<typeof requireSession>>, Response>,
  propertyId: string
) {
  const snapshot = (await getSnapshotServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
  })) as AppSnapshot

  return (
    snapshot.customPropertyDefinitions.find(
      (definition) => definition.id === propertyId
    )?.teamId ?? null
  )
}

async function bumpPropertyReadModel(teamId: string | null) {
  if (!teamId) {
    return
  }

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkIndexScopeKeys("team", teamId),
  })
}

async function runPropertyMutation({
  code,
  logMessage,
  mutate,
  propertyId,
  session,
}: {
  code: string
  logMessage: string
  mutate: (currentUserId: string) => Promise<unknown>
  propertyId: string
  session: Exclude<Awaited<ReturnType<typeof requireSession>>, Response>
}) {
  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const teamId = await resolvePropertyTeamId(session, propertyId)
    await mutate(appContext.ensuredUser.userId)
    await bumpPropertyReadModel(teamId)

    return jsonOk({ ok: true })
  } catch (error) {
    return handleCustomPropertyRouteError(error, logMessage, code)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    customPropertyDefinitionPatchSchema,
    "Invalid custom property update payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  const { propertyId } = await params

  return runPropertyMutation({
    code: "CUSTOM_PROPERTY_UPDATE_FAILED",
    logMessage: "Failed to update custom property",
    mutate: (currentUserId) =>
      updateCustomPropertyDefinitionServer({
        currentUserId,
        propertyId,
        patch: parsed,
      }),
    propertyId,
    session,
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { propertyId } = await params

  return runPropertyMutation({
    code: "CUSTOM_PROPERTY_DELETE_FAILED",
    logMessage: "Failed to delete custom property",
    mutate: (currentUserId) =>
      archiveCustomPropertyDefinitionServer({
        currentUserId,
        propertyId,
      }),
    propertyId,
    session,
  })
}
