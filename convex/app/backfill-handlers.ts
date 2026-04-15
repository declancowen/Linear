import type { MutationCtx } from "../_generated/server"

import {
  normalizeStoredWorkItemType,
  type StoredWorkItemType,
} from "../../lib/domain/types"
import { defaultUserPreferences, assertServerToken } from "./core"
import { getTeamDoc } from "./data"
import { normalizeTeam, normalizeViewDefinition } from "./normalization"
import { ensureTeamWorkViews } from "./work-helpers"

type ServerAccessArgs = {
  serverToken: string
}

export async function backfillChatMessageKindsHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)
  const chatMessages = await ctx.db.query("chatMessages").collect()
  let updatedCount = 0

  for (const message of chatMessages) {
    if (message.kind) {
      continue
    }

    await ctx.db.patch(message._id, {
      kind: "text",
    })
    updatedCount += 1
  }

  return {
    updatedCount,
    totalCount: chatMessages.length,
  }
}

export async function backfillUserPreferenceThemesHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)
  const users = await ctx.db.query("users").collect()
  let updatedCount = 0

  for (const user of users) {
    if (user.preferences?.theme) {
      continue
    }

    await ctx.db.patch(user._id, {
      preferences: {
        ...defaultUserPreferences,
        ...user.preferences,
      },
    })
    updatedCount += 1
  }

  return {
    updatedCount,
    totalCount: users.length,
  }
}

export async function backfillWorkItemModelHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)
  const teams = await ctx.db.query("teams").collect()
  const normalizedTeams = teams.map(normalizeTeam)
  const workItems = await ctx.db.query("workItems").collect()
  let updatedTeamCount = 0
  let updatedWorkItemCount = 0
  let updatedViewCount = 0

  for (const team of teams) {
    const normalizedTeam = normalizeTeam(team)

    if (
      normalizedTeam.icon === team.icon &&
      JSON.stringify(normalizedTeam.settings) === JSON.stringify(team.settings)
    ) {
      continue
    }

    await ctx.db.patch(team._id, {
      icon: normalizedTeam.icon,
      settings: normalizedTeam.settings,
    })
    updatedTeamCount += 1
  }

  for (const team of teams) {
    updatedViewCount += await ensureTeamWorkViews(ctx, await getTeamDoc(ctx, team.id))
  }

  for (const item of workItems) {
    const experience =
      normalizedTeams.find((team) => team.id === item.teamId)?.settings
        .experience ?? "software-development"
    const normalizedType = normalizeStoredWorkItemType(
      item.type as StoredWorkItemType,
      experience,
      {
        parentId: item.parentId,
      }
    )

    if (normalizedType === item.type) {
      continue
    }

    await ctx.db.patch(item._id, {
      type: normalizedType,
    })
    updatedWorkItemCount += 1
  }

  const views = await ctx.db.query("views").collect()

  for (const view of views) {
    const normalizedView = normalizeViewDefinition(
      {
        ...view,
        filters: {
          ...view.filters,
          itemTypes: view.filters.itemTypes as StoredWorkItemType[],
        },
      },
      normalizedTeams
    )

    if (
      JSON.stringify(normalizedView.filters.itemTypes) ===
      JSON.stringify(view.filters.itemTypes)
    ) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: {
        ...view.filters,
        itemTypes: normalizedView.filters.itemTypes,
      },
    })
    updatedViewCount += 1
  }

  return {
    updatedTeamCount,
    totalTeamCount: teams.length,
    updatedWorkItemCount,
    totalWorkItemCount: workItems.length,
    updatedViewCount,
    totalViewCount: views.length,
  }
}
