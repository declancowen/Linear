import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  displayProperties,
  groupFields,
  orderingFields,
} from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  toggleViewDisplayPropertyServer,
  toggleViewFilterValueServer,
  toggleViewHiddenValueServer,
  updateViewConfigServer,
} from "@/lib/server/convex"

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
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = viewMutationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid view request" }, { status: 400 })
  }

  try {
    const { viewId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    switch (parsed.data.action) {
      case "updateConfig":
        await updateViewConfigServer({
          currentUserId: ensuredUser.userId,
          viewId,
          ...parsed.data.patch,
        })
        break
      case "toggleDisplayProperty":
        await toggleViewDisplayPropertyServer({
          currentUserId: ensuredUser.userId,
          viewId,
          property: parsed.data.property,
        })
        break
      case "toggleHiddenValue":
        await toggleViewHiddenValueServer({
          currentUserId: ensuredUser.userId,
          viewId,
          key: parsed.data.key,
          value: parsed.data.value,
        })
        break
      case "toggleFilterValue":
        await toggleViewFilterValueServer({
          currentUserId: ensuredUser.userId,
          viewId,
          key: parsed.data.key,
          value: parsed.data.value,
        })
        break
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update view",
      },
      { status: 500 }
    )
  }
}
