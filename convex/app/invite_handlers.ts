import { addDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import { buildTeamInviteEmailJobs } from "../../lib/email/builders"
import {
  requireTeamAdminAccess,
  requireWorkspaceAdminAccess,
} from "./access"
import { createNotification } from "./collaboration_utils"
import { insertAuditEvent } from "./audit"
import {
  assertServerToken,
  createSlug,
  createId,
  getNow,
  mergeMembershipRole,
  normalizeEmailAddress,
} from "./core"
import {
  getActiveInvitesForTeamAndEmail,
  listInvitesByBatchId,
  listInvitesByToken,
  getEffectiveRole,
  getInviteDoc,
  getTeamByJoinCode,
  getTeamDoc,
  getTeamBySlug,
  getUserByEmail,
  getUserDoc,
  getWorkspaceDoc,
  setCurrentWorkspaceForUser,
  syncWorkspaceMembershipRoleFromTeams,
} from "./data"
import { archiveInviteNotifications } from "./notifications"
import { syncTeamConversationMemberships } from "./conversations"
import { queueEmailJobs } from "./email_job_handlers"

type ServerAccessArgs = {
  serverToken: string
}

type InviteRole = "admin" | "member" | "viewer" | "guest"

type CreateInviteArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  teamIds: string[]
  email: string
  role: InviteRole
}

type TokenActionArgs = ServerAccessArgs & {
  currentUserId: string
  token: string
}

type CancelInviteArgs = ServerAccessArgs & {
  currentUserId: string
  inviteId: string
}

type JoinTeamByCodeArgs = ServerAccessArgs & {
  currentUserId: string
  code: string
}

function isPendingInvite(invite: {
  acceptedAt?: string | null
  declinedAt?: string | null
}) {
  return !invite.acceptedAt && !invite.declinedAt
}

async function createUniqueInviteBatchId(ctx: MutationCtx) {
  while (true) {
    const batchId = createId("invite_batch")

    if ((await listInvitesByBatchId(ctx, batchId)).length === 0) {
      return batchId
    }
  }
}

async function createUniqueInviteToken(ctx: MutationCtx) {
  while (true) {
    const token = createId("token")

    if ((await listInvitesByToken(ctx, token)).length === 0) {
      return token
    }
  }
}

function scopeTokenInvitesToRepresentative<
  T extends {
    id: string
    batchId?: string | null
    workspaceId: string
  },
>(invites: T[], representativeInvite: T) {
  if (representativeInvite.batchId) {
    return invites.filter(
      (invite) =>
        invite.batchId === representativeInvite.batchId &&
        invite.workspaceId === representativeInvite.workspaceId
    )
  }

  return invites.filter((invite) => invite.id === representativeInvite.id)
}

async function deleteInviteAndNotifications(
  ctx: MutationCtx,
  invite: Awaited<ReturnType<typeof getInviteDoc>>,
  actorUserId: string
) {
  if (!invite) {
    return
  }

  const inviteNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_entity", (q) =>
      q.eq("entityType", "invite").eq("entityId", invite.id)
    )
    .collect()

  for (const notification of inviteNotifications) {
    await ctx.db.delete(notification._id)
  }

  await ctx.db.delete(invite._id)

  await insertAuditEvent(ctx, {
    type: "invite.cancelled",
    actorUserId,
    subjectUserId: null,
    workspaceId: invite.workspaceId,
    teamId: invite.teamId,
    entityId: invite.id,
    summary: `Invite ${invite.id} was cancelled.`,
    details: {
      email: invite.email,
      inviteRole: invite.role,
      source: "convex",
    },
  })
}

export async function createInviteHandler(
  ctx: MutationCtx,
  args: CreateInviteArgs
) {
  assertServerToken(args.serverToken)
  const teamIds = [
    ...new Set(args.teamIds.map((teamId) => teamId.trim()).filter(Boolean)),
  ]

  if (teamIds.length === 0) {
    throw new Error("Invite batch must include at least one team")
  }

  const loadedTeams = await Promise.all(
    teamIds.map((teamId) => getTeamDoc(ctx, teamId))
  )
  const [primaryTeam] = loadedTeams

  if (!primaryTeam || loadedTeams.some((team) => !team)) {
    throw new Error("Team not found")
  }

  const teams = loadedTeams.filter(
    (
      team
    ): team is NonNullable<(typeof loadedTeams)[number]> => team !== null
  )

  if (teams.some((team) => team.workspaceId !== primaryTeam.workspaceId)) {
    throw new Error("Invites must target teams in the same workspace")
  }

  for (const team of teams) {
    const role = await getEffectiveRole(ctx, team.id, args.currentUserId)

    if (role !== "admin" && role !== "member") {
      throw new Error("Only admins and members can invite")
    }
  }

  const batchId = await createUniqueInviteBatchId(ctx)
  const batchToken = await createUniqueInviteToken(ctx)
  const expiresAt = addDays(new Date(), 7).toISOString()
  const normalizedEmail = normalizeEmailAddress(args.email)
  const invitedUser = await getUserByEmail(ctx, args.email)
  const workspace = await getWorkspaceDoc(ctx, primaryTeam.workspaceId)
  const createdInvites: Array<{
    id: string
    batchId: string
    teamId: string
    token: string
  }> = []

  for (const team of teams) {
    const invite = {
      id: createId("invite"),
      batchId,
      workspaceId: team.workspaceId,
      teamId: team.id,
      email: args.email,
      normalizedEmail,
      role: args.role,
      token: batchToken,
      joinCode: team.settings.joinCode,
      invitedBy: args.currentUserId,
      expiresAt,
      acceptedAt: null,
      declinedAt: null,
    }

    await ctx.db.insert("invites", invite)

    if (invitedUser) {
      await ctx.db.insert(
        "notifications",
        createNotification(
          invitedUser.id,
          args.currentUserId,
          `You've been invited to join ${team.name} as ${args.role}`,
          "invite",
          invite.id,
          "invite"
        )
      )
    }

    await insertAuditEvent(ctx, {
      type: "invite.created",
      actorUserId: args.currentUserId,
      subjectUserId: invitedUser?.id ?? null,
      workspaceId: team.workspaceId,
      teamId: team.id,
      entityId: invite.id,
      summary: `Invite ${invite.id} was created for ${args.email}.`,
      details: {
        email: args.email,
        inviteRole: args.role,
        source: "convex",
      },
    })

    createdInvites.push({
      id: invite.id,
      batchId,
      teamId: team.id,
      token: batchToken,
    })
  }

  await queueEmailJobs(
    ctx,
    buildTeamInviteEmailJobs({
      origin: args.origin,
      invites: [
        {
          email: args.email,
          workspaceName: workspace?.name ?? "Workspace",
          teamNames: teams.map((team) => team.name),
          role: args.role,
          inviteToken: batchToken,
        },
      ],
    })
  )

  return {
    batchId,
    token: batchToken,
    inviteIds: createdInvites.map((invite) => invite.id),
    invites: createdInvites,
    workspaceName: workspace?.name ?? "Workspace",
  }
}

export async function cancelInviteHandler(
  ctx: MutationCtx,
  args: CancelInviteArgs
) {
  assertServerToken(args.serverToken)
  const invite = await getInviteDoc(ctx, args.inviteId)

  if (!invite) {
    throw new Error("Invite not found")
  }

  if (invite.acceptedAt) {
    throw new Error("Invite has already been accepted")
  }

  if (invite.declinedAt) {
    throw new Error("Invite has been declined")
  }

  let canCancelViaWorkspace = true

  try {
    await requireWorkspaceAdminAccess(ctx, invite.workspaceId, args.currentUserId)
  } catch {
    canCancelViaWorkspace = false
  }

  if (!canCancelViaWorkspace) {
    await requireTeamAdminAccess(
      ctx,
      invite.teamId,
      args.currentUserId,
      "Only team admins can cancel invites"
    )
  }

  const pendingInvites = canCancelViaWorkspace
    ? (
        invite.batchId ? await listInvitesByBatchId(ctx, invite.batchId) : [invite]
      ).filter(
        (entry) =>
          entry.workspaceId === invite.workspaceId && isPendingInvite(entry)
      )
    : [invite]

  for (const relatedInvite of pendingInvites) {
    await deleteInviteAndNotifications(ctx, relatedInvite, args.currentUserId)
  }

  const [team, workspace] = await Promise.all([
    getTeamDoc(ctx, invite.teamId),
    getWorkspaceDoc(ctx, invite.workspaceId),
  ])

  return {
    inviteId: invite.id,
    cancelledInviteIds: pendingInvites.map((entry) => entry.id),
    teamName: team?.name ?? null,
    workspaceName: workspace?.name ?? null,
  }
}

export async function acceptInviteHandler(
  ctx: MutationCtx,
  args: TokenActionArgs
) {
  assertServerToken(args.serverToken)
  const tokenInvites = await listInvitesByToken(ctx, args.token)
  const firstPendingInvite = tokenInvites.find(isPendingInvite)
  const firstAcceptedInvite = tokenInvites.find((invite) =>
    Boolean(invite.acceptedAt)
  )
  const representativeInvite = firstPendingInvite ?? firstAcceptedInvite ?? null

  if (!representativeInvite) {
    throw new Error("Invite not found")
  }

  const scopedTokenInvites = scopeTokenInvitesToRepresentative(
    tokenInvites,
    representativeInvite
  )
  const pendingInvites = scopedTokenInvites.filter(isPendingInvite)
  const acceptedInvites = scopedTokenInvites.filter((invite) =>
    Boolean(invite.acceptedAt)
  )

  if (
    pendingInvites.length === 0 &&
    scopedTokenInvites.every((invite) => invite.declinedAt)
  ) {
    throw new Error("Invite has been declined")
  }

  if (pendingInvites.length === 0) {
    const team =
      acceptedInvites.length === 1
        ? await getTeamDoc(ctx, acceptedInvites[0].teamId)
        : null
    const workspace = await getWorkspaceDoc(ctx, representativeInvite.workspaceId)
    return {
      teamSlug: team?.slug ?? null,
      workspaceId: representativeInvite.workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      workosOrganizationId: workspace?.workosOrganizationId ?? null,
    }
  }

  let fallbackRole: InviteRole | null = null

  for (const invite of pendingInvites) {
    const existingMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", invite.teamId).eq("userId", args.currentUserId)
      )
      .unique()
    const resolvedRole = mergeMembershipRole(
      existingMembership?.role,
      invite.role
    )

    if (existingMembership) {
      if (existingMembership.role !== resolvedRole) {
        await ctx.db.patch(existingMembership._id, {
          role: resolvedRole,
        })
      }
    } else {
      await ctx.db.insert("teamMemberships", {
        teamId: invite.teamId,
        userId: args.currentUserId,
        role: resolvedRole,
      })
    }

    await syncTeamConversationMemberships(ctx, invite.teamId)

    await ctx.db.patch(invite._id, {
      acceptedAt: getNow(),
    })

    await insertAuditEvent(ctx, {
      type: "invite.accepted",
      actorUserId: args.currentUserId,
      subjectUserId: args.currentUserId,
      workspaceId: invite.workspaceId,
      teamId: invite.teamId,
      entityId: invite.id,
      summary: `Invite ${invite.id} was accepted.`,
      details: {
        inviteRole: invite.role,
        source: "convex",
      },
    })

    fallbackRole = mergeMembershipRole(fallbackRole, invite.role)
  }

  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: representativeInvite.workspaceId,
    userId: args.currentUserId,
    fallbackRole: fallbackRole ?? representativeInvite.role,
  })

  const team =
    pendingInvites.length === 1
      ? await getTeamDoc(ctx, pendingInvites[0].teamId)
      : null
  const workspace = await getWorkspaceDoc(ctx, representativeInvite.workspaceId)
  await setCurrentWorkspaceForUser(ctx, args.currentUserId, representativeInvite.workspaceId)

  await archiveInviteNotifications(ctx, {
    userId: args.currentUserId,
    inviteIds: pendingInvites.map((invite) => invite.id),
  })

  return {
    teamSlug: team?.slug ?? null,
    workspaceId: representativeInvite.workspaceId,
    workspaceSlug: workspace?.slug ?? null,
    workosOrganizationId: workspace?.workosOrganizationId ?? null,
  }
}

export async function declineInviteHandler(
  ctx: MutationCtx,
  args: TokenActionArgs
) {
  assertServerToken(args.serverToken)
  const tokenInvites = await listInvitesByToken(ctx, args.token)
  const representativeInvite =
    tokenInvites.find(isPendingInvite) ?? tokenInvites[0] ?? null

  if (!representativeInvite) {
    throw new Error("Invite not found")
  }

  const scopedTokenInvites = scopeTokenInvitesToRepresentative(
    tokenInvites,
    representativeInvite
  )
  const pendingInvites = scopedTokenInvites.filter(isPendingInvite)

  if (scopedTokenInvites.some((invite) => invite.acceptedAt)) {
    throw new Error("Invite has already been accepted")
  }

  const declinedAt = getNow()

  for (const invite of pendingInvites) {
    await ctx.db.patch(invite._id, {
      declinedAt,
    })

    await insertAuditEvent(ctx, {
      type: "invite.declined",
      actorUserId: args.currentUserId,
      subjectUserId: args.currentUserId,
      workspaceId: invite.workspaceId,
      teamId: invite.teamId,
      entityId: invite.id,
      summary: `Invite ${invite.id} was declined.`,
      details: {
        inviteRole: invite.role,
        source: "convex",
      },
    })
  }

  await archiveInviteNotifications(ctx, {
    userId: args.currentUserId,
    inviteIds: pendingInvites.map((invite) => invite.id),
  })

  return {
    inviteId: pendingInvites[0]?.id ?? representativeInvite.id,
    declinedAt,
  }
}

export async function joinTeamByCodeHandler(
  ctx: MutationCtx,
  args: JoinTeamByCodeArgs
) {
  assertServerToken(args.serverToken)
  const team =
    (await getTeamDoc(ctx, args.code)) ??
    (await getTeamBySlug(ctx, createSlug(args.code))) ??
    (await getTeamByJoinCode(ctx, args.code))

  if (!team) {
    throw new Error("Join code not found")
  }

  const currentUser = await getUserDoc(ctx, args.currentUserId)

  if (!currentUser) {
    throw new Error("User not found")
  }

  const existingMembership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", team.id).eq("userId", args.currentUserId)
    )
    .unique()
  const matchingInvites = await getActiveInvitesForTeamAndEmail(ctx, {
    teamId: team.id,
    email: currentUser.email,
  })
  let invitedRole: InviteRole | null = null

  for (const invite of matchingInvites) {
    invitedRole = mergeMembershipRole(invitedRole, invite.role)
  }

  const resolvedRole = mergeMembershipRole(
    existingMembership?.role,
    invitedRole ?? "viewer"
  )

  if (existingMembership) {
    if (existingMembership.role !== resolvedRole) {
      await ctx.db.patch(existingMembership._id, {
        role: resolvedRole,
      })
    }
  } else {
    await ctx.db.insert("teamMemberships", {
      teamId: team.id,
      userId: args.currentUserId,
      role: resolvedRole,
    })
  }

  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: team.workspaceId,
    userId: args.currentUserId,
    fallbackRole: resolvedRole,
  })

  await syncTeamConversationMemberships(ctx, team.id)

  if (matchingInvites.length > 0) {
    const acceptedAt = getNow()

    await Promise.all(
      matchingInvites.map((invite) =>
        ctx.db.patch(invite._id, {
          acceptedAt,
        })
      )
    )
  }

  await setCurrentWorkspaceForUser(ctx, args.currentUserId, team.workspaceId)

  if (matchingInvites.length > 0) {
    await archiveInviteNotifications(ctx, {
      userId: args.currentUserId,
      inviteIds: matchingInvites.map((invite) => invite.id),
    })
  }

  const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

  return {
    role: resolvedRole,
    teamSlug: team.slug,
    workspaceId: team.workspaceId,
    workspaceSlug: workspace?.slug ?? null,
    workspaceName: workspace?.name ?? "Workspace",
    workosOrganizationId: workspace?.workosOrganizationId ?? null,
  }
}
