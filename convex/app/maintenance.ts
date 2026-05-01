import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  assertServerToken,
  mergeMembershipRole,
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

type MembershipRole = "admin" | "member" | "viewer" | "guest"

type WorkspaceMembershipBackfillInput = {
  workspaces: Array<{
    id: string
    createdBy?: string | null
  }>
  teams: Array<{
    id: string
    workspaceId: string
  }>
  teamMemberships: Array<{
    teamId: string
    userId: string
    role: MembershipRole
  }>
  workspaceMemberships: Array<{
    workspaceId: string
    userId: string
    role: MembershipRole
  }>
}

type WorkspaceMembershipRecord = {
  workspaceId: string
  userId: string
  role: MembershipRole
}

type WorkspaceMembershipBackfillStatus = {
  memberships: {
    expected: number
    existing: number
    missing: number
    staleRole: number
    remaining: number
  }
  remaining: {
    total: number
  }
}

function getWorkspaceMembershipKey(workspaceId: string, userId: string) {
  return `${workspaceId}:${userId}`
}

function createWorkspaceMembershipRecord(
  workspaceId: string,
  userId: string,
  role: MembershipRole
): WorkspaceMembershipRecord {
  return {
    workspaceId,
    userId,
    role,
  }
}

function compareWorkspaceMemberships(
  left: WorkspaceMembershipRecord,
  right: WorkspaceMembershipRecord
) {
  if (left.workspaceId !== right.workspaceId) {
    return left.workspaceId.localeCompare(right.workspaceId)
  }

  return left.userId.localeCompare(right.userId)
}

export function buildWorkspaceMembershipBackfillPlan(
  input: WorkspaceMembershipBackfillInput
) {
  const workspaceByTeamId = new Map(
    input.teams.map((team) => [team.id, team.workspaceId] as const)
  )
  const expectedMembershipByKey = new Map<string, WorkspaceMembershipRecord>()

  for (const workspace of input.workspaces) {
    const ownerUserId = workspace.createdBy ?? null

    if (!ownerUserId) {
      continue
    }

    expectedMembershipByKey.set(
      getWorkspaceMembershipKey(workspace.id, ownerUserId),
      createWorkspaceMembershipRecord(workspace.id, ownerUserId, "admin")
    )
  }

  for (const membership of input.teamMemberships) {
    const workspaceId = workspaceByTeamId.get(membership.teamId)

    if (!workspaceId) {
      continue
    }

    const membershipKey = getWorkspaceMembershipKey(
      workspaceId,
      membership.userId
    )
    const currentMembership = expectedMembershipByKey.get(membershipKey) ?? null
    const nextRole = mergeMembershipRole(
      currentMembership?.role ?? null,
      membership.role
    )

    expectedMembershipByKey.set(
      membershipKey,
      createWorkspaceMembershipRecord(workspaceId, membership.userId, nextRole)
    )
  }

  const expectedMemberships = [...expectedMembershipByKey.values()].sort(
    compareWorkspaceMemberships
  )

  const actualRoleByMembershipKey = new Map(
    input.workspaceMemberships.map((membership) => [
      getWorkspaceMembershipKey(membership.workspaceId, membership.userId),
      membership.role,
    ])
  )

  const missingMemberships: WorkspaceMembershipRecord[] = []
  const staleRoleMemberships: WorkspaceMembershipRecord[] = []

  for (const membership of expectedMemberships) {
    const actualRole =
      actualRoleByMembershipKey.get(
        getWorkspaceMembershipKey(membership.workspaceId, membership.userId)
      ) ?? null

    if (!actualRole) {
      missingMemberships.push(membership)
      continue
    }

    if (actualRole !== membership.role) {
      staleRoleMemberships.push(membership)
    }
  }

  const status: WorkspaceMembershipBackfillStatus = {
    memberships: {
      expected: expectedMemberships.length,
      existing: input.workspaceMemberships.length,
      missing: missingMemberships.length,
      staleRole: staleRoleMemberships.length,
      remaining: missingMemberships.length + staleRoleMemberships.length,
    },
    remaining: {
      total: missingMemberships.length + staleRoleMemberships.length,
    },
  }

  return {
    expectedMemberships,
    missingMemberships,
    staleRoleMemberships,
    status,
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
      total:
        remainingTeams + remainingUsers + remainingInvites + remainingLabels,
    },
  }
}

async function loadLookupTables(ctx: MutationCtx | QueryCtx) {
  const [
    workspaces,
    teams,
    users,
    invites,
    labels,
    workItems,
    views,
    projects,
  ] = await Promise.all([
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

async function loadWorkspaceMembershipTables(ctx: MutationCtx | QueryCtx) {
  const [workspaces, teams, teamMemberships, workspaceMemberships] =
    await Promise.all([
      ctx.db.query("workspaces").collect(),
      ctx.db.query("teams").collect(),
      ctx.db.query("teamMemberships").collect(),
      ctx.db.query("workspaceMemberships").collect(),
    ])

  return {
    workspaces,
    teams,
    teamMemberships,
    workspaceMemberships,
  }
}

type LookupTables = Awaited<ReturnType<typeof loadLookupTables>>

type BackfillPatchResult = {
  patched: number
  remainingCapacity: number
}

function getBackfillBatchLimit(args: BackfillArgs) {
  return Math.max(1, Math.min(args.limit ?? 250, 1000))
}

async function backfillTeamJoinCodes(
  ctx: MutationCtx,
  teams: LookupTables["teams"],
  remainingCapacity: number
): Promise<BackfillPatchResult> {
  let patched = 0

  for (const team of teams) {
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
    patched += 1
    remainingCapacity -= 1
  }

  return {
    patched,
    remainingCapacity,
  }
}

async function backfillUserEmails(
  ctx: MutationCtx,
  users: LookupTables["users"],
  remainingCapacity: number
): Promise<BackfillPatchResult> {
  let patched = 0

  for (const user of users) {
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
    patched += 1
    remainingCapacity -= 1
  }

  return {
    patched,
    remainingCapacity,
  }
}

async function backfillInviteEmails(
  ctx: MutationCtx,
  invites: LookupTables["invites"],
  remainingCapacity: number
): Promise<BackfillPatchResult> {
  let patched = 0

  for (const invite of invites) {
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
    patched += 1
    remainingCapacity -= 1
  }

  return {
    patched,
    remainingCapacity,
  }
}

function inferLegacyLabelWorkspaceIds(tables: LookupTables) {
  return inferLabelWorkspaceIds({
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
}

async function backfillLabelWorkspaceIds(
  ctx: MutationCtx,
  tables: LookupTables,
  remainingCapacity: number
): Promise<BackfillPatchResult> {
  const inferredLabelWorkspaceIds = inferLegacyLabelWorkspaceIds(tables)
  const onlyWorkspaceId =
    tables.workspaces.length === 1 ? (tables.workspaces[0]?.id ?? null) : null
  let patched = 0

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
    patched += 1
    remainingCapacity -= 1
  }

  return {
    patched,
    remainingCapacity,
  }
}

export async function getLegacyLookupBackfillStatusHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  return getNormalizedLookupStatus(await loadLookupTables(ctx))
}

export async function getWorkspaceMembershipBackfillStatusHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  return buildWorkspaceMembershipBackfillPlan(
    await loadWorkspaceMembershipTables(ctx)
  ).status
}

export async function backfillLegacyLookupFieldsHandler(
  ctx: MutationCtx,
  args: BackfillArgs
) {
  assertServerToken(args.serverToken)

  const batchLimit = getBackfillBatchLimit(args)
  const tables = await loadLookupTables(ctx)
  const teamPatch = await backfillTeamJoinCodes(ctx, tables.teams, batchLimit)
  const userPatch = await backfillUserEmails(
    ctx,
    tables.users,
    teamPatch.remainingCapacity
  )
  const invitePatch = await backfillInviteEmails(
    ctx,
    tables.invites,
    userPatch.remainingCapacity
  )
  const labelPatch = await backfillLabelWorkspaceIds(
    ctx,
    tables,
    invitePatch.remainingCapacity
  )

  const status = getNormalizedLookupStatus(await loadLookupTables(ctx))
  const patched = {
    teams: teamPatch.patched,
    users: userPatch.patched,
    invites: invitePatch.patched,
    labels: labelPatch.patched,
  }

  return {
    patched: {
      ...patched,
      total: patched.teams + patched.users + patched.invites + patched.labels,
    },
    remaining: status.remaining,
    status,
  }
}

export async function backfillWorkspaceMembershipsHandler(
  ctx: MutationCtx,
  args: BackfillArgs
) {
  assertServerToken(args.serverToken)

  const batchLimit = Math.max(1, Math.min(args.limit ?? 250, 1000))
  const tables = await loadWorkspaceMembershipTables(ctx)
  const plan = buildWorkspaceMembershipBackfillPlan(tables)
  const workspaceMembershipDocsByKey = new Map(
    tables.workspaceMemberships.map((membership) => [
      getWorkspaceMembershipKey(membership.workspaceId, membership.userId),
      membership,
    ])
  )
  let remainingCapacity = batchLimit
  const patched = {
    inserted: 0,
    updated: 0,
  }

  for (const membership of plan.missingMemberships) {
    if (remainingCapacity <= 0) {
      break
    }

    await ctx.db.insert("workspaceMemberships", membership)
    patched.inserted += 1
    remainingCapacity -= 1
  }

  for (const membership of plan.staleRoleMemberships) {
    if (remainingCapacity <= 0) {
      break
    }

    const existingMembership = workspaceMembershipDocsByKey.get(
      getWorkspaceMembershipKey(membership.workspaceId, membership.userId)
    )

    if (!existingMembership) {
      continue
    }

    await ctx.db.patch(existingMembership._id, {
      role: membership.role,
    })
    patched.updated += 1
    remainingCapacity -= 1
  }

  const status = buildWorkspaceMembershipBackfillPlan(
    await loadWorkspaceMembershipTables(ctx)
  ).status

  return {
    patched: {
      ...patched,
      total: patched.inserted + patched.updated,
    },
    remaining: status.remaining,
    status,
  }
}
