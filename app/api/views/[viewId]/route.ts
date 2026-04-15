import { NextRequest } from "next/server"
import { z } from "zod"

import {
  displayProperties,
  groupFields,
  orderingFields,
} from "@/lib/domain/types"
import {
  clearViewFiltersServer,
  toggleViewDisplayPropertyServer,
  toggleViewFilterValueServer,
  toggleViewHiddenValueServer,
  updateViewConfigServer,
} from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const viewMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateConfig"),
    patch: z.object({
      layout: z.enum(["list", "board", "timeline"]).optional(),
      grouping: z.enum(groupFields).optional(),
      subGrouping: z.enum(groupFields).nullable().optional(),
      ordering: z.enum(orderingFields).optional(),
      showCompleted: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal("toggleDisplayProperty"),
    property: z.enum(displayProperties),
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
      "projectIds",
      "itemTypes",
      "labelIds",
    ]),
    value: z.string().min(1),
  }),
  z.object({
    action: z.literal("clearFilters"),
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
    }

    return jsonOk({ ok: true })
  } catch (error) {
    logProviderError("Failed to update view", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update view"),
      500
    )
  }
}
