import { NextRequest } from "next/server"
import { z } from "zod"

import { isApplicationError } from "@/lib/server/application-errors"
import {
  displayProperties,
  viewConfigPatchSchema,
  viewNameMaxLength,
  viewNameMinLength,
} from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  clearViewFiltersServer,
  deleteViewServer,
  reorderViewDisplayPropertiesServer,
  renameViewServer,
  toggleViewDisplayPropertyServer,
  toggleViewFilterValueServer,
  toggleViewHiddenValueServer,
  updateViewConfigServer,
} from "@/lib/server/convex"
import { resolveViewReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const viewMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateConfig"),
    patch: viewConfigPatchSchema,
  }),
  z.object({
    action: z.literal("toggleDisplayProperty"),
    property: z.enum(displayProperties),
  }),
  z.object({
    action: z.literal("reorderDisplayProperties"),
    displayProps: z.array(z.enum(displayProperties)),
  }),
  z.object({
    action: z.literal("toggleHiddenValue"),
    key: z.enum(["groups", "subgroups"]),
    value: z.string().min(1),
  }),
  z.object({
    action: z.literal("toggleFilterValue"),
    key: z.enum([
      "status",
      "priority",
      "assigneeIds",
      "creatorIds",
      "leadIds",
      "health",
      "milestoneIds",
      "relationTypes",
      "projectIds",
      "parentIds",
      "itemTypes",
      "labelIds",
      "teamIds",
    ]),
    value: z.string().min(1),
  }),
  z.object({
    action: z.literal("clearFilters"),
  }),
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(viewNameMinLength).max(viewNameMaxLength),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    viewMutationSchema,
    "Invalid view request"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { viewId } = await params
    const scopeKeys = await resolveViewReadModelScopeKeysServer(session, viewId)
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    switch (parsed.action) {
      case "updateConfig":
        await updateViewConfigServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          ...parsed.patch,
        })
        break
      case "toggleDisplayProperty":
        await toggleViewDisplayPropertyServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          property: parsed.property,
        })
        break
      case "reorderDisplayProperties":
        await reorderViewDisplayPropertiesServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          displayProps: parsed.displayProps,
        })
        break
      case "toggleHiddenValue":
        await toggleViewHiddenValueServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          key: parsed.key,
          value: parsed.value,
        })
        break
      case "toggleFilterValue":
        await toggleViewFilterValueServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          key: parsed.key,
          value: parsed.value,
        })
        break
      case "clearFilters":
        await clearViewFiltersServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
        })
        break
      case "rename":
        await renameViewServer({
          currentUserId: appContext.ensuredUser.userId,
          viewId,
          name: parsed.name,
        })
        break
    }

    const nextScopeKeys = await resolveViewReadModelScopeKeysServer(
      session,
      viewId
    )
    await bumpScopedReadModelVersionsServer({
      scopeKeys: [...new Set([...scopeKeys, ...nextScopeKeys])],
    })

    return jsonOk({ ok: true })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update view", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update view"),
      500,
      {
        code: "VIEW_UPDATE_FAILED",
      }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { viewId } = await params
    const scopeKeys = await resolveViewReadModelScopeKeysServer(session, viewId)
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await deleteViewServer({
      currentUserId: appContext.ensuredUser.userId,
      viewId,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({ ok: true })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete view", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete view"),
      500,
      {
        code: "VIEW_DELETE_FAILED",
      }
    )
  }
}
