import type { MutationCtx, QueryCtx } from "../_generated/server"

import { normalizeWorkItemKeyNumberPadding } from "../../lib/domain/work-item-key"
import {
  assertServerToken,
  mergeMembershipRole,
  normalizeEmailAddress,
  normalizeJoinCode,
} from "./core"
import {
  getUniqueLabelWorkspaceId,
  inferLabelWorkspaceIds,
  type LabelWorkspaceInferenceInput,
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

type WorkItemKeyBackfillStatus = {
  workItems: {
    total: number
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

type NormalizedLookupStatusInput = Pick<
  LabelWorkspaceInferenceInput,
  "projects" | "views" | "workItems"
> & {
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
}

function countTeamsWithOutdatedNormalizedJoinCodes(
  teams: NormalizedLookupStatusInput["teams"]
) {
  return teams.filter(
    (team) =>
      (team.joinCodeNormalized ?? null) !==
      normalizeJoinCode(team.settings.joinCode)
  ).length
}

function countUsersWithOutdatedNormalizedEmails(
  users: NormalizedLookupStatusInput["users"]
) {
  return users.filter(
    (user) =>
      (user.emailNormalized ?? null) !== normalizeEmailAddress(user.email)
  ).length
}

function countInvitesWithOutdatedNormalizedEmails(
  invites: NormalizedLookupStatusInput["invites"]
) {
  return invites.filter(
    (invite) =>
      (invite.normalizedEmail ?? null) !== normalizeEmailAddress(invite.email)
  ).length
}

function createLabelWorkspaceInferenceInput(input: NormalizedLookupStatusInput) {
  return {
    teams: input.teams.map((team) => ({
      id: team.id,
      workspaceId: team.workspaceId,
    })),
    workItems: input.workItems,
    views: input.views,
    projects: input.projects,
  }
}

function getOnlyWorkspaceId(workspaces: NormalizedLookupStatusInput["workspaces"]) {
  return workspaces.length === 1 ? (workspaces[0]?.id ?? null) : null
}

function getInferredLabelWorkspaceId(input: {
  inferredLabelWorkspaceIds: Map<string, Set<string>>
  labelId: string
  onlyWorkspaceId: string | null
}) {
  return (
    getUniqueLabelWorkspaceId(input.inferredLabelWorkspaceIds.get(input.labelId)) ??
    input.onlyWorkspaceId
  )
}

function getLabelWorkspaceNormalizationState(input: {
  inferredLabelWorkspaceIds: Map<string, Set<string>>
  label: NormalizedLookupStatusInput["labels"][number]
  onlyWorkspaceId: string | null
}) {
  const inferredWorkspaceId = getInferredLabelWorkspaceId({
    inferredLabelWorkspaceIds: input.inferredLabelWorkspaceIds,
    labelId: input.label.id,
    onlyWorkspaceId: input.onlyWorkspaceId,
  })

  return {
    needsNormalization: (input.label.workspaceId ?? null) !== inferredWorkspaceId,
    unresolved: !inferredWorkspaceId,
  }
}

function countLabelsNeedingWorkspaceNormalization(
  input: NormalizedLookupStatusInput
) {
  const inferredLabelWorkspaceIds = inferLabelWorkspaceIds(
    createLabelWorkspaceInferenceInput(input)
  )
  const onlyWorkspaceId = getOnlyWorkspaceId(input.workspaces)
  let remaining = 0
  let unresolved = 0

  for (const label of input.labels) {
    const state = getLabelWorkspaceNormalizationState({
      inferredLabelWorkspaceIds,
      label,
      onlyWorkspaceId,
    })

    if (!state.needsNormalization) {
      continue
    }

    remaining += 1

    if (state.unresolved) {
      unresolved += 1
    }
  }

  return {
    remaining,
    unresolved,
  }
}

function getNormalizedLookupStatus(
  input: NormalizedLookupStatusInput
): LegacyLookupStatus {
  const remainingTeams = countTeamsWithOutdatedNormalizedJoinCodes(input.teams)
  const remainingUsers = countUsersWithOutdatedNormalizedEmails(input.users)
  const remainingInvites = countInvitesWithOutdatedNormalizedEmails(
    input.invites
  )
  const { remaining: remainingLabels, unresolved: unresolvedLabels } =
    countLabelsNeedingWorkspaceNormalization(input)

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

function getWorkItemKeyBackfillStatus(
  workItems: Array<{
    key: string
  }>
): WorkItemKeyBackfillStatus {
  const remaining = workItems.filter(
    (workItem) =>
      normalizeWorkItemKeyNumberPadding(workItem.key) !== workItem.key
  ).length

  return {
    workItems: {
      total: workItems.length,
      remaining,
    },
    remaining: {
      total: remaining,
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

async function loadWorkItems(ctx: MutationCtx | QueryCtx) {
  return ctx.db.query("workItems").collect()
}

type LookupTables = Awaited<ReturnType<typeof loadLookupTables>>
type WorkspaceMembershipTables = Awaited<
  ReturnType<typeof loadWorkspaceMembershipTables>
>

type BackfillPatchResult = {
  patched: number
  remainingCapacity: number
}

function getBackfillBatchLimit(args: BackfillArgs) {
  return Math.max(1, Math.min(args.limit ?? 250, 1000))
}

export async function backfillTeamJoinCodes(
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

export async function backfillUserEmails(
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

export async function backfillInviteEmails(
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
  const onlyWorkspaceId = getOnlyWorkspaceId(tables.workspaces)
  let patched = 0

  for (const label of tables.labels) {
    if (remainingCapacity <= 0) {
      break
    }

    const patch = getBackfillLabelWorkspacePatch({
      inferredLabelWorkspaceIds,
      label,
      onlyWorkspaceId,
    })

    if (!patch) {
      continue
    }

    await ctx.db.patch(label._id, patch)
    patched += 1
    remainingCapacity -= 1
  }

  return {
    patched,
    remainingCapacity,
  }
}

export function getBackfillLabelWorkspacePatch(input: {
  inferredLabelWorkspaceIds: Map<string, Set<string>>
  label: LookupTables["labels"][number]
  onlyWorkspaceId: string | null
}) {
  const inferredWorkspaceId =
    getUniqueLabelWorkspaceId(
      input.inferredLabelWorkspaceIds.get(input.label.id)
    ) ?? input.onlyWorkspaceId

  if (!inferredWorkspaceId) {
    return null
  }

  if ((input.label.workspaceId ?? null) === inferredWorkspaceId) {
    return null
  }

  return {
    workspaceId: inferredWorkspaceId,
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

export async function getWorkItemKeyBackfillStatusHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)

  return getWorkItemKeyBackfillStatus(await loadWorkItems(ctx))
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

export async function backfillWorkItemKeysHandler(
  ctx: MutationCtx,
  args: BackfillArgs
) {
  assertServerToken(args.serverToken)

  const batchLimit = getBackfillBatchLimit(args)
  const workItems = await loadWorkItems(ctx)
  let remainingCapacity = batchLimit
  let patched = 0

  for (const workItem of workItems) {
    if (remainingCapacity <= 0) {
      break
    }

    const normalizedKey = normalizeWorkItemKeyNumberPadding(workItem.key)

    if (normalizedKey === workItem.key) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      key: normalizedKey,
    })
    patched += 1
    remainingCapacity -= 1
  }

  const status = getWorkItemKeyBackfillStatus(await loadWorkItems(ctx))

  return {
    patched: {
      workItems: patched,
      total: patched,
    },
    remaining: status.remaining,
    status,
  }
}

async function insertMissingWorkspaceMemberships(
  ctx: MutationCtx,
  input: {
    memberships: ReturnType<
      typeof buildWorkspaceMembershipBackfillPlan
    >["missingMemberships"]
    remainingCapacity: number
  }
) {
  let inserted = 0
  let remainingCapacity = input.remainingCapacity

  for (const membership of input.memberships) {
    if (remainingCapacity <= 0) {
      break
    }

    await ctx.db.insert("workspaceMemberships", membership)
    inserted += 1
    remainingCapacity -= 1
  }

  return {
    inserted,
    remainingCapacity,
  }
}

async function updateStaleWorkspaceMembershipRoles(
  ctx: MutationCtx,
  input: {
    memberships: ReturnType<
      typeof buildWorkspaceMembershipBackfillPlan
    >["staleRoleMemberships"]
    remainingCapacity: number
    workspaceMembershipDocsByKey: Map<
      string,
      WorkspaceMembershipTables["workspaceMemberships"][number]
    >
  }
) {
  let updated = 0
  let remainingCapacity = input.remainingCapacity

  for (const membership of input.memberships) {
    if (remainingCapacity <= 0) {
      break
    }

    const existingMembership = input.workspaceMembershipDocsByKey.get(
      getWorkspaceMembershipKey(membership.workspaceId, membership.userId)
    )

    if (!existingMembership) {
      continue
    }

    await ctx.db.patch(existingMembership._id, {
      role: membership.role,
    })
    updated += 1
    remainingCapacity -= 1
  }

  return {
    remainingCapacity,
    updated,
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
  const insertResult = await insertMissingWorkspaceMemberships(ctx, {
    memberships: plan.missingMemberships,
    remainingCapacity: batchLimit,
  })
  const updateResult = await updateStaleWorkspaceMembershipRoles(ctx, {
    memberships: plan.staleRoleMemberships,
    remainingCapacity: insertResult.remainingCapacity,
    workspaceMembershipDocsByKey,
  })
  const patched = {
    inserted: insertResult.inserted,
    updated: updateResult.updated,
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
