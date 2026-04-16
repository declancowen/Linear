import type { MutationCtx } from "../_generated/server"

import { assertServerToken, getNow } from "./core"
import {
  assertWorkspaceLabelIds,
  requireViewMutationAccess,
  resolveViewWorkspaceId,
} from "./work_helpers"

type ServerAccessArgs = {
  serverToken: string
}

type ViewConfigArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  layout?: "list" | "board" | "timeline"
  grouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
  subGrouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
    | null
  ordering?:
    | "priority"
    | "updatedAt"
    | "createdAt"
    | "dueDate"
    | "targetDate"
    | "title"
  showCompleted?: boolean
}

type ViewDisplayPropertyArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  property:
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
}

type ViewHiddenValueArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}

type ViewFilterValueArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  key:
    | "status"
    | "priority"
    | "assigneeIds"
    | "projectIds"
    | "itemTypes"
    | "labelIds"
  value: string
}

type ClearViewFiltersArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
}

export async function updateViewConfigHandler(
  ctx: MutationCtx,
  args: ViewConfigArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  await ctx.db.patch(view._id, {
    layout: args.layout ?? view.layout,
    grouping: args.grouping ?? view.grouping,
    subGrouping:
      args.subGrouping === undefined ? view.subGrouping : args.subGrouping,
    ordering: args.ordering ?? view.ordering,
    filters:
      args.showCompleted === undefined
        ? view.filters
        : {
            ...view.filters,
            showCompleted: args.showCompleted,
          },
    updatedAt: getNow(),
  })
}

export async function toggleViewDisplayPropertyHandler(
  ctx: MutationCtx,
  args: ViewDisplayPropertyArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const nextDisplayProps = view.displayProps.includes(args.property)
    ? view.displayProps.filter((value: string) => value !== args.property)
    : [...view.displayProps, args.property]

  await ctx.db.patch(view._id, {
    displayProps: nextDisplayProps,
    updatedAt: getNow(),
  })
}

export async function toggleViewHiddenValueHandler(
  ctx: MutationCtx,
  args: ViewHiddenValueArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const current = view.hiddenState[args.key]
  const nextValues = current.includes(args.value)
    ? current.filter((entry: string) => entry !== args.value)
    : [...current, args.value]

  await ctx.db.patch(view._id, {
    hiddenState: {
      ...view.hiddenState,
      [args.key]: nextValues,
    },
    updatedAt: getNow(),
  })
}

export async function toggleViewFilterValueHandler(
  ctx: MutationCtx,
  args: ViewFilterValueArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const current = [...(view.filters[args.key] as string[])]
  const next = current.includes(args.value)
    ? current.filter((entry) => entry !== args.value)
    : [...current, args.value]

  if (args.key === "labelIds" && next.length > 0) {
    const workspaceId = await resolveViewWorkspaceId(ctx, view, args.currentUserId)

    if (!workspaceId) {
      throw new Error("Workspace not found")
    }

    await assertWorkspaceLabelIds(ctx, workspaceId, next)
  }

  await ctx.db.patch(view._id, {
    filters: {
      ...view.filters,
      [args.key]: next,
    },
    updatedAt: getNow(),
  })
}

export async function clearViewFiltersHandler(
  ctx: MutationCtx,
  args: ClearViewFiltersArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  await ctx.db.patch(view._id, {
    filters: {
      ...view.filters,
      status: [],
      priority: [],
      assigneeIds: [],
      projectIds: [],
      itemTypes: [],
      labelIds: [],
    },
    updatedAt: getNow(),
  })
}
