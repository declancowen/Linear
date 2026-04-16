import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  assertServerToken,
  normalizeEmailAddress,
  normalizeJoinCode,
} from "./core"

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
  remaining: {
    total: number
  }
}

function getNormalizedLookupStatus(input: {
  teams: Array<{
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
    remaining: {
      total: remainingTeams + remainingUsers + remainingInvites,
    },
  }
}

async function loadLookupTables(ctx: MutationCtx | QueryCtx) {
  const [teams, users, invites] = await Promise.all([
    ctx.db.query("teams").collect(),
    ctx.db.query("users").collect(),
    ctx.db.query("invites").collect(),
  ])

  return {
    teams,
    users,
    invites,
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

  const status = getNormalizedLookupStatus(await loadLookupTables(ctx))

  return {
    patched: {
      ...patched,
      total: patched.teams + patched.users + patched.invites,
    },
    remaining: status.remaining,
    status,
  }
}
