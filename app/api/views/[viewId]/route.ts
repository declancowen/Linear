import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  displayProperties,
  groupFields,
  orderingFields,
  viewNameMaxLength,
  viewNameMinLength,
  workItemTypes,
} from "@/lib/domain/types"
import {
  clearViewFiltersServer,
  deleteViewServer,
  reorderViewDisplayPropertiesServer,
  renameViewServer,
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
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const viewMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateConfig"),
    patch: z.object({
      layout: z.enum(["list", "board", "timeline"]).optional(),
      grouping: z.enum(groupFields).optional(),
      subGrouping: z.enum(groupFields).nullable().optional(),
      ordering: z.enum(orderingFields).optional(),
      itemLevel: z.enum(workItemTypes).nullable().optional(),
      showChildItems: z.boolean().optional(),
      showCompleted: z.boolean().optional(),
    }),
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

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
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
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await deleteViewServer({
      currentUserId: appContext.ensuredUser.userId,
      viewId,
    })

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
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
