import { addDays } from "date-fns"

import type { MutationCtx } from "../_generated/server"

import { buildTeamInviteEmailJobs } from "../../lib/email/builders"
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
  getEffectiveRole,
  getInviteByTokenDoc,
  getTeamByJoinCode,
  getTeamDoc,
  getTeamBySlug,
  getUserByEmail,
  getUserDoc,
  getWorkspaceDoc,
  setCurrentWorkspaceForUser,
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
  teamId: string
  email: string
  role: InviteRole
}

type TokenActionArgs = ServerAccessArgs & {
  currentUserId: string
  token: string
}

type JoinTeamByCodeArgs = ServerAccessArgs & {
  currentUserId: string
  code: string
}

export async function createInviteHandler(
  ctx: MutationCtx,
  args: CreateInviteArgs
) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const role = await getEffectiveRole(ctx, team.id, args.currentUserId)

  if (role !== "admin" && role !== "member") {
    throw new Error("Only admins and members can invite")
  }

  const invite = {
    id: createId("invite"),
    workspaceId: team.workspaceId,
    teamId: team.id,
    email: args.email,
    normalizedEmail: normalizeEmailAddress(args.email),
    role: args.role,
    token: createId("token"),
    joinCode: team.settings.joinCode,
    invitedBy: args.currentUserId,
    expiresAt: addDays(new Date(), 7).toISOString(),
    acceptedAt: null,
    declinedAt: null,
  }

  await ctx.db.insert("invites", invite)

  const invitedUser = await getUserByEmail(ctx, args.email)

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

  const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

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

  await queueEmailJobs(
    ctx,
    buildTeamInviteEmailJobs({
      origin: args.origin,
      invites: [
        {
          email: args.email,
          workspaceName: workspace?.name ?? "Workspace",
          teamName: team.name,
          role: args.role,
          inviteToken: invite.token,
          joinCode: invite.joinCode,
        },
      ],
    })
  )

  return {
    invite,
    teamName: team.name,
    workspaceName: workspace?.name ?? "Workspace",
  }
}

export async function acceptInviteHandler(
  ctx: MutationCtx,
  args: TokenActionArgs
) {
  assertServerToken(args.serverToken)
  const invite = await getInviteByTokenDoc(ctx, args.token)

  if (!invite) {
    throw new Error("Invite not found")
  }

  if (invite.declinedAt) {
    throw new Error("Invite has been declined")
  }

  if (invite.acceptedAt) {
    const team = await getTeamDoc(ctx, invite.teamId)
    const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)
    return {
      teamSlug: team?.slug ?? null,
      workspaceId: invite.workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      workosOrganizationId: workspace?.workosOrganizationId ?? null,
    }
  }

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

  const team = await getTeamDoc(ctx, invite.teamId)
  const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)
  await setCurrentWorkspaceForUser(ctx, args.currentUserId, invite.workspaceId)

  await archiveInviteNotifications(ctx, {
    userId: args.currentUserId,
    inviteIds: [invite.id],
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

  return {
    teamSlug: team?.slug ?? null,
    workspaceId: invite.workspaceId,
    workspaceSlug: workspace?.slug ?? null,
    workosOrganizationId: workspace?.workosOrganizationId ?? null,
  }
}

export async function declineInviteHandler(
  ctx: MutationCtx,
  args: TokenActionArgs
) {
  assertServerToken(args.serverToken)
  const invite = await getInviteByTokenDoc(ctx, args.token)

  if (!invite) {
    throw new Error("Invite not found")
  }

  if (invite.acceptedAt) {
    throw new Error("Invite has already been accepted")
  }

  if (!invite.declinedAt) {
    await ctx.db.patch(invite._id, {
      declinedAt: getNow(),
    })
  }

  await archiveInviteNotifications(ctx, {
    userId: args.currentUserId,
    inviteIds: [invite.id],
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

  return {
    inviteId: invite.id,
    declinedAt: invite.declinedAt ?? getNow(),
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
