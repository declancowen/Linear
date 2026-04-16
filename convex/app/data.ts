import type { MutationCtx, QueryCtx } from "../_generated/server"

import { normalizeEmailAddress } from "./core"

export type AppCtx = MutationCtx | QueryCtx

export async function getWorkspaceDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getTeamDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getUserDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("users")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getTeamMembershipDoc(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  return ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()
}

export async function getUserAppState(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("userAppStates")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
}

export async function isWorkspaceOwner(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspace = await getWorkspaceDoc(ctx, workspaceId)
  return workspace?.createdBy === userId
}

export async function getProjectDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("projects")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getUserByEmail(ctx: AppCtx, email: string) {
  const normalizedEmail = normalizeEmailAddress(email)
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .unique()

  if (user && !user.accountDeletedAt && !user.accountDeletionPendingAt) {
    return user
  }

  const legacyUsers = await ctx.db.query("users").collect()

  return (
    legacyUsers.find(
      (entry) =>
        !entry.accountDeletedAt &&
        !entry.accountDeletionPendingAt &&
        normalizeEmailAddress(entry.email) === normalizedEmail
    ) ?? null
  )
}

export async function getUserByWorkOSUserId(ctx: AppCtx, workosUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .unique()
}

function getAuthLifecycleError(
  user:
    | {
        accountDeletedAt?: string | null
        accountDeletionPendingAt?: string | null
      }
    | null
    | undefined
) {
  if (user?.accountDeletedAt) {
    return "This account has been deleted"
  }

  if (user?.accountDeletionPendingAt) {
    return "This account is being deleted"
  }

  return null
}

export async function resolveActiveUserByIdentity(
  ctx: AppCtx,
  input: {
    workosUserId?: string | null
    email?: string | null
  }
) {
  if (input.workosUserId) {
    const byWorkosId = await getUserByWorkOSUserId(ctx, input.workosUserId)
    const lifecycleError = getAuthLifecycleError(byWorkosId)

    if (lifecycleError) {
      throw new Error(lifecycleError)
    }

    if (byWorkosId) {
      return byWorkosId
    }
  }

  if (input.email) {
    const byEmail = await getUserByEmail(ctx, input.email)
    const lifecycleError = getAuthLifecycleError(byEmail)

    if (lifecycleError) {
      throw new Error(lifecycleError)
    }

    return byEmail
  }

  return null
}

export async function listWorkspaceTeams(ctx: AppCtx, workspaceId: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()
}

export async function listWorkspacesOwnedByUser(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .collect()
}

export async function getWorkItemDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workItems")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getDocumentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getCommentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("comments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getConversationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("conversations")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getCallDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("calls")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getChannelPostDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("channelPosts")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getAttachmentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("attachments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getViewDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("views")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getNotificationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("notifications")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getInviteByTokenDoc(ctx: AppCtx, token: string) {
  return ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique()
}

export async function getPendingInvitesForEmail(ctx: AppCtx, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const invites = (await ctx.db.query("invites").collect()).filter((invite) => {
    if (invite.email.trim().toLowerCase() !== normalizedEmail) {
      return false
    }

    if (invite.acceptedAt || invite.declinedAt) {
      return false
    }

    return true
  })

  return Promise.all(
    invites.map(async (invite) => {
      const team = await getTeamDoc(ctx, invite.teamId)
      const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)

      return {
        invite: {
          id: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          acceptedAt: invite.acceptedAt,
          declinedAt: invite.declinedAt ?? null,
          joinCode: invite.joinCode,
        },
        team: team
          ? {
              id: team.id,
              slug: team.slug,
              name: team.name,
              summary: team.settings.summary,
              joinCode: team.settings.joinCode,
            }
          : null,
        workspace: workspace
          ? {
              id: workspace.id,
              slug: workspace.slug,
              name: workspace.name,
              logoUrl: workspace.logoUrl,
            }
          : null,
      }
    })
  )
}

export async function getActiveInvitesForTeamAndEmail(
  ctx: AppCtx,
  input: {
    teamId: string
    email: string
  }
) {
  const normalizedEmail = input.email.trim().toLowerCase()
  const now = Date.now()

  return (await ctx.db.query("invites").collect()).filter((invite) => {
    if (invite.teamId !== input.teamId) {
      return false
    }

    if (invite.email.trim().toLowerCase() !== normalizedEmail) {
      return false
    }

    if (invite.acceptedAt || invite.declinedAt) {
      return false
    }

    return new Date(invite.expiresAt).getTime() >= now
  })
}

export async function getAppConfig(ctx: AppCtx) {
  const configs = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", "singleton"))
    .collect()

  if (configs.length === 0) {
    return null
  }

  return configs.reduce((selected, config) =>
    (config.snapshotVersion ?? 0) > (selected.snapshotVersion ?? 0)
      ? config
      : selected
  )
}

export async function getOrCreateAppConfig(ctx: MutationCtx) {
  const config = await getAppConfig(ctx)

  if (config) {
    return config
  }

  const configId = await ctx.db.insert("appConfig", {
    key: "singleton",
    snapshotVersion: 0,
  })

  const nextConfig = await ctx.db.get(configId)

  if (!nextConfig) {
    throw new Error("Failed to initialize app config")
  }

  return nextConfig
}

export async function setCurrentWorkspaceForUser(
  ctx: MutationCtx,
  userId: string,
  workspaceId: string
) {
  const existingState = await getUserAppState(ctx, userId)

  if (existingState) {
    await ctx.db.patch(existingState._id, {
      currentWorkspaceId: workspaceId,
    })
    return
  }

  await ctx.db.insert("userAppStates", {
    userId,
    currentWorkspaceId: workspaceId,
  })
}

export function resolvePreferredWorkspaceId(input: {
  selectedWorkspaceId?: string | null
  accessibleWorkspaceIds: Iterable<string>
  fallbackWorkspaceIds?: Array<string | null | undefined>
}) {
  const accessibleWorkspaceIds = new Set(input.accessibleWorkspaceIds)

  if (
    input.selectedWorkspaceId &&
    accessibleWorkspaceIds.has(input.selectedWorkspaceId)
  ) {
    return input.selectedWorkspaceId
  }

  for (const workspaceId of input.fallbackWorkspaceIds ?? []) {
    if (workspaceId && accessibleWorkspaceIds.has(workspaceId)) {
      return workspaceId
    }
  }

  return null
}

export function isDefinedString(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && value.length > 0
}

export async function getWorkspaceRoleMapForUser(ctx: AppCtx, userId: string) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const teams = await ctx.db.query("teams").collect()
  const workspaces = await ctx.db.query("workspaces").collect()
  const workspaceRoleMap = memberships.reduce<
    Record<string, Array<(typeof memberships)[number]["role"]>>
  >((accumulator, membership) => {
    const team = teams.find((entry) => entry.id === membership.teamId)
    if (!team) {
      return accumulator
    }

    accumulator[team.workspaceId] = [
      ...(accumulator[team.workspaceId] ?? []),
      membership.role,
    ]

    return accumulator
  }, {})

  for (const workspace of workspaces) {
    if (workspace.createdBy !== userId) {
      continue
    }

    const ownedRoles = new Set<(typeof memberships)[number]["role"]>([
      ...(workspaceRoleMap[workspace.id] ?? []),
      "admin",
    ])

    workspaceRoleMap[workspace.id] = [...ownedRoles]
  }

  return workspaceRoleMap
}

export async function bootstrapFirstAuthenticatedUser(
  ctx: MutationCtx,
  userId: string
) {
  void ctx
  void userId
  return false
}

export async function getEffectiveRole(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const membership = await getTeamMembershipDoc(ctx, teamId, userId)

  return membership?.role ?? null
}

export async function isTeamMember(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const membership = await getTeamMembershipDoc(ctx, teamId, userId)

  return Boolean(membership)
}
