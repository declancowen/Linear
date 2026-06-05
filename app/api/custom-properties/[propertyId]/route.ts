import { NextRequest } from "next/server"

import { customPropertyDefinitionPatchSchema } from "@/lib/domain/types"
import { getCustomPropertyScopeType } from "@/lib/domain/labels"
import {
  archiveCustomPropertyDefinitionServer,
  bumpScopedReadModelVersionsServer,
  updateCustomPropertyDefinitionServer,
} from "@/lib/server/convex"
import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import { handleCustomPropertyRouteError } from "@/lib/server/custom-property-route-utils"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonOk } from "@/lib/server/route-response"
import { resolveCustomPropertyDefinitionReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

type CustomPropertyReadModelTarget =
  | {
      scopeType: "team"
      teamId: string
    }
  | {
      scopeType: "workspace"
      workspaceId: string
    }
  | {
      scopeType: "private"
      ownerId: string
      workspaceId: string
    }

async function resolvePropertyReadModelTarget(
  session: Exclude<Awaited<ReturnType<typeof requireSession>>, Response>,
  propertyId: string
): Promise<CustomPropertyReadModelTarget | null> {
  const snapshot = (await getSnapshotServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
  })) as AppSnapshot
  const definition =
    (snapshot.customPropertyDefinitions ?? []).find(
      (entry) => entry.id === propertyId
    ) ?? null

  if (!definition) {
    return null
  }

  if (getCustomPropertyScopeType(definition) === "private") {
    return {
      scopeType: "private",
      ownerId: definition.ownerId ?? definition.createdBy,
      workspaceId: definition.workspaceId,
    }
  }

  if (getCustomPropertyScopeType(definition) === "workspace") {
    return {
      scopeType: "workspace",
      workspaceId: definition.workspaceId,
    }
  }

  return definition.teamId
    ? { scopeType: "team", teamId: definition.teamId }
    : null
}

async function bumpPropertyReadModel(
  session: Exclude<Awaited<ReturnType<typeof requireSession>>, Response>,
  target: CustomPropertyReadModelTarget | null
) {
  if (!target) {
    return
  }

  const scopeKeys =
    await resolveCustomPropertyDefinitionReadModelScopeKeysServer(
      session,
      target
    )

  await bumpScopedReadModelVersionsServer({
    scopeKeys,
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

    const readModelTarget = await resolvePropertyReadModelTarget(
      session,
      propertyId
    )
    await mutate(appContext.ensuredUser.userId)
    await bumpPropertyReadModel(session, readModelTarget)

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
