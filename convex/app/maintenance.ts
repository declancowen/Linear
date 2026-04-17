import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  assertServerToken,
  normalizeEmailAddress,
  normalizeJoinCode,
} from "./core"
import {
  getUniqueLabelWorkspaceId,
  inferLabelWorkspaceIds,
} from "./label_workspace"

type ServerAccessArgs = {
  serverToken: string
}

type BackfillArgs = ServerAccessArgs & {
  limit?: number
}

type LegacyLookupStatus = {
  teams: {
    total: number
    remaining: number
  }
  users: {
    total: number
    remaining: number
  }
  invites: {
    total: number
    remaining: number
  }
  labels: {
    total: number
    remaining: number
    unresolved: number
  }
  remaining: {
    total: number
  }
}

function getNormalizedLookupStatus(input: {
  workspaces: Array<{
    id: string
  }>
  teams: Array<{
    id: string
    workspaceId: string
    joinCodeNormalized?: string | null
    settings: {
      joinCode: string
    }
  }>
  users: Array<{
    email: string
    emailNormalized?: string | null
  }>
  invites: Array<{
    email: string
    normalizedEmail?: string | null
  }>
  labels: Array<{
    id: string
    workspaceId?: string | null
  }>
  workItems: Array<{
    teamId: string
    labelIds: string[]
  }>
  views: Array<{
    scopeType: "personal" | "team" | "workspace"
    scopeId: string
    filters: {
      labelIds: string[]
      teamIds: string[]
    }
  }>
  projects: Array<{
    scopeType: "team" | "workspace"
    scopeId: string
    presentation?: {
      filters: {
        labelIds: string[]
      }
    }
  }>
}): LegacyLookupStatus {
  const remainingTeams = input.teams.filter(
    (team) =>
      (team.joinCodeNormalized ?? null) !==
      normalizeJoinCode(team.settings.joinCode)
  ).length
  const remainingUsers = input.users.filter(
    (user) =>
      (user.emailNormalized ?? null) !== normalizeEmailAddress(user.email)
  ).length
  const remainingInvites = input.invites.filter(
    (invite) =>
      (invite.normalizedEmail ?? null) !== normalizeEmailAddress(invite.email)
  ).length
  const inferredLabelWorkspaceIds = inferLabelWorkspaceIds({
    teams: input.teams.map((team) => ({
      id: team.id,
      workspaceId: team.workspaceId,
    })),
    workItems: input.workItems,
    views: input.views,
    projects: input.projects,
  })
  const onlyWorkspaceId =
    input.workspaces.length === 1 ? (input.workspaces[0]?.id ?? null) : null
  let remainingLabels = 0
  let unresolvedLabels = 0

  for (const label of input.labels) {
    const inferredWorkspaceId =
      getUniqueLabelWorkspaceId(inferredLabelWorkspaceIds.get(label.id)) ??
      onlyWorkspaceId

    if ((label.workspaceId ?? null) === inferredWorkspaceId) {
      continue
    }

    remainingLabels += 1

    if (!inferredWorkspaceId) {
      unresolvedLabels += 1
    }
  }

  return {
    teams: {
      total: input.teams.length,
      remaining: remainingTeams,
    },
    users: {
      total: input.users.length,
      remaining: remainingUsers,
    },
    invites: {
      total: input.invites.length,
      remaining: remainingInvites,
    },
    labels: {
      total: input.labels.length,
      remaining: remainingLabels,
      unresolved: unresolvedLabels,
    },
    remaining: {
      total: remainingTeams + remainingUsers + remainingInvites + remainingLabels,
    },
  }
}

async function loadLookupTables(ctx: MutationCtx | QueryCtx) {
  const [workspaces, teams, users, invites, labels, workItems, views, projects] =
    await Promise.all([
      ctx.db.query("workspaces").collect(),
      ctx.db.query("teams").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("invites").collect(),
      ctx.db.query("labels").collect(),
      ctx.db.query("workItems").collect(),
      ctx.db.query("views").collect(),
      ctx.db.query("projects").collect(),
    ])

  return {
    workspaces,
    teams,
    users,
    invites,
    labels,
    workItems,
    views,
    projects,
  }
}

export async function getLegacyLookupBackfillStatusHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  return getNormalizedLookupStatus(await loadLookupTables(ctx))
}

export async function backfillLegacyLookupFieldsHandler(
  ctx: MutationCtx,
  args: BackfillArgs
) {
  assertServerToken(args.serverToken)

  const batchLimit = Math.max(1, Math.min(args.limit ?? 250, 1000))
  const tables = await loadLookupTables(ctx)
  const patched = {
    teams: 0,
    users: 0,
    invites: 0,
    labels: 0,
  }
  let remainingCapacity = batchLimit

  for (const team of tables.teams) {
    if (remainingCapacity <= 0) {
      break
    }

    const normalizedJoinCode = normalizeJoinCode(team.settings.joinCode)

    if ((team.joinCodeNormalized ?? null) === normalizedJoinCode) {
      continue
    }

    await ctx.db.patch(team._id, {
      joinCodeNormalized: normalizedJoinCode,
    })
    patched.teams += 1
    remainingCapacity -= 1
  }

  for (const user of tables.users) {
    if (remainingCapacity <= 0) {
      break
    }

    const normalizedEmail = normalizeEmailAddress(user.email)

    if ((user.emailNormalized ?? null) === normalizedEmail) {
      continue
    }

    await ctx.db.patch(user._id, {
      emailNormalized: normalizedEmail,
    })
    patched.users += 1
    remainingCapacity -= 1
  }

  for (const invite of tables.invites) {
    if (remainingCapacity <= 0) {
      break
    }

    const normalizedEmail = normalizeEmailAddress(invite.email)

    if ((invite.normalizedEmail ?? null) === normalizedEmail) {
      continue
    }

    await ctx.db.patch(invite._id, {
      normalizedEmail,
    })
    patched.invites += 1
    remainingCapacity -= 1
  }

  const inferredLabelWorkspaceIds = inferLabelWorkspaceIds({
    teams: tables.teams.map((team) => ({
      id: team.id,
      workspaceId: team.workspaceId,
    })),
    workItems: tables.workItems.map((workItem) => ({
      teamId: workItem.teamId,
      labelIds: workItem.labelIds,
    })),
    views: tables.views.map((view) => ({
      scopeType: view.scopeType,
      scopeId: view.scopeId,
      filters: {
        labelIds: view.filters.labelIds,
        teamIds: view.filters.teamIds,
      },
    })),
    projects: tables.projects.map((project) => ({
      scopeType: project.scopeType,
      scopeId: project.scopeId,
      presentation: project.presentation
        ? {
            filters: {
              labelIds: project.presentation.filters.labelIds,
            },
          }
        : undefined,
    })),
  })
  const onlyWorkspaceId =
    tables.workspaces.length === 1 ? (tables.workspaces[0]?.id ?? null) : null

  for (const label of tables.labels) {
    if (remainingCapacity <= 0) {
      break
    }

    const inferredWorkspaceId =
      getUniqueLabelWorkspaceId(inferredLabelWorkspaceIds.get(label.id)) ??
      onlyWorkspaceId

    if (!inferredWorkspaceId) {
      continue
    }

    if ((label.workspaceId ?? null) === inferredWorkspaceId) {
      continue
    }

    await ctx.db.patch(label._id, {
      workspaceId: inferredWorkspaceId,
    })
    patched.labels += 1
    remainingCapacity -= 1
  }

  const status = getNormalizedLookupStatus(await loadLookupTables(ctx))

  return {
    patched: {
      ...patched,
      total:
        patched.teams + patched.users + patched.invites + patched.labels,
    },
    remaining: status.remaining,
    status,
  }
}
