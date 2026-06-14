import { z } from "zod"

import {
  hasBulkWorkItemPatchMutation,
  MAX_BULK_WORK_ITEM_UPDATES,
} from "@/lib/domain/work-item-inputs"
import { ApplicationError } from "@/lib/server/application-errors"
import { bulkWorkItemPatchShape } from "@/lib/server/work-item-route-schemas"
import {
  bumpScopedReadModelVersionsServer,
  bulkDeleteWorkItemsServer,
  bulkUpdateWorkItemsServer,
} from "@/lib/server/convex"
import { notifyCollaborationDocumentChangedServer } from "@/lib/server/collaboration-refresh"
import { resolveWorkItemReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { getConvexErrorMessage, logProviderError } from "@/lib/server/provider-errors"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const customPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
])

const bulkWorkItemPatchSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    ...bulkWorkItemPatchShape,
  })
  .refine(hasBulkWorkItemPatchMutation, {
    message: "At least one work item field is required",
  })

const bulkUpdateSchema = z.object({
  updates: z
    .array(
      z.union([
        z.object({
          itemId: z.string().trim().min(1),
          patch: bulkWorkItemPatchSchema,
        }),
        z.object({
          expectedUpdatedAt: z.string().datetime(),
          itemId: z.string().trim().min(1),
          customProperty: z.object({
            propertyId: z.string().trim().min(1),
            value: customPropertyValueSchema,
          }),
        }),
      ])
    )
    .min(1)
    .max(MAX_BULK_WORK_ITEM_UPDATES)
    .refine(
      (updates) =>
        new Set(updates.map((update) => update.itemId)).size === updates.length,
      { message: "Bulk updates cannot contain duplicate work items" }
    ),
})

const bulkDeleteSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().trim().min(1),
        expectedUpdatedAt: z.string().datetime(),
      })
    )
    .min(1)
    .max(MAX_BULK_WORK_ITEM_UPDATES)
    .refine(
      (items) => new Set(items.map((item) => item.itemId)).size === items.length,
      { message: "Bulk deletes cannot contain duplicate work items" }
    ),
})

export async function PATCH(request: Request) {
  const session = await requireSession()
  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    bulkUpdateSchema,
    "Invalid bulk work item update payload"
  )
  if (isRouteResponse(parsed)) {
    return parsed
  }

  const appContext = await requireAppContext(session)
  if (isRouteResponse(appContext)) {
    return appContext
  }

  try {
    const beforeScopeKeys = await Promise.all(
      parsed.updates.map((update) =>
        resolveWorkItemReadModelScopeKeysServer(session, update.itemId)
      )
    )
    await bulkUpdateWorkItemsServer({
      currentUserId: appContext.ensuredUser.userId,
      updates: parsed.updates,
    })
    try {
      const afterScopeKeys = await Promise.all(
        parsed.updates.map((update) =>
          resolveWorkItemReadModelScopeKeysServer(session, update.itemId)
        )
      )
      await bumpScopedReadModelVersionsServer({
        scopeKeys: [
          ...new Set([...beforeScopeKeys.flat(), ...afterScopeKeys.flat()]),
        ],
      })
    } catch (error) {
      logProviderError(
        "Failed to invalidate read models after bulk work item update",
        error
      )
    }

    return jsonOk({ ok: true, updatedCount: parsed.updates.length })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to bulk update work items", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to bulk update work items"),
      500,
      { code: "WORK_ITEM_BULK_UPDATE_FAILED" }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession()
  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    bulkDeleteSchema,
    "Invalid bulk work item delete payload"
  )
  if (isRouteResponse(parsed)) {
    return parsed
  }

  const appContext = await requireAppContext(session)
  if (isRouteResponse(appContext)) {
    return appContext
  }

  try {
    const scopeKeys = await Promise.all(
      parsed.items.map((item) =>
        resolveWorkItemReadModelScopeKeysServer(session, item.itemId)
      )
    )
    const result = await bulkDeleteWorkItemsServer({
      currentUserId: appContext.ensuredUser.userId,
      items: parsed.items,
    })
    try {
      await bumpScopedReadModelVersionsServer({
        scopeKeys: [...new Set(scopeKeys.flat())],
      })
      await Promise.all(
        (result?.deletedDescriptionDocIds ?? []).map((documentId) =>
          notifyCollaborationDocumentChangedServer({
            documentId,
            kind: "document-deleted",
            reason: "work-item-bulk-route-delete",
          })
        )
      )
    } catch (error) {
      logProviderError(
        "Failed to invalidate read models after bulk work item delete",
        error
      )
    }

    return jsonOk({
      ok: true,
      deletedItemIds: result?.deletedItemIds ?? [],
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to bulk delete work items", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to bulk delete work items"),
      500,
      { code: "WORK_ITEM_BULK_DELETE_FAILED" }
    )
  }
}
