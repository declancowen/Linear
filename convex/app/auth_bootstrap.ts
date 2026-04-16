import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type TeamExperienceType,
} from "../../lib/domain/types"
import {
  assertServerToken,
  createHandle,
  createId,
  createSlug,
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
  matchesTeamAccessIdentifier,
  normalizeJoinCode,
  normalizeTeamIcon,
} from "./core"
import {
  bootstrapFirstAuthenticatedUser,
  getAppConfig,
  getInviteByTokenDoc,
  getPendingInvitesForEmail,
  getTeamDoc,
  getUserAppState,
  getUserByEmail,
  getUserByWorkOSUserId,
  getUserDoc,
  getWorkspaceDoc,
  getWorkspaceRoleMapForUser,
  isDefinedString,
  resolvePreferredWorkspaceId,
  setCurrentWorkspaceForUser,
} from "./data"
import { resolveUserFromServerArgs } from "./server_users"
import { syncTeamConversationMemberships } from "./conversations"
import { ensureTeamWorkViews } from "./work_helpers"
import {
  normalizeDocument,
  normalizeTeam,
  normalizeTeamFeatures,
  normalizeTeamWorkflowSettings,
  normalizeViewDefinition,
  normalizeWorkItem,
  resolveUserSnapshot,
  resolveUserStatus,
  resolveWorkspaceSnapshot,
} from "./normalization"

type Role = "guest" | "viewer" | "member" | "admin"

type ServerUserArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
}

type AuthContextArgs = {
  serverToken: string
  workosUserId: string
  email?: string
}

type EnsureUserFromAuthArgs = {
  serverToken: string
  email: string
  name: string
  avatarUrl: string
  workosUserId: string
}

type BootstrapWorkspaceUserArgs = {
  serverToken: string
  workspaceSlug: string
  teamSlug: string
  existingUserId?: string
  email: string
  name: string
  avatarUrl: string
  workosUserId: string
  role?: Role
}

type BootstrapAppWorkspaceArgs = {
  serverToken: string
  workspaceSlug: string
  workspaceName: string
  workspaceLogoUrl: string
  workspaceAccent: string
  workspaceDescription: string
  teamSlug: string
  teamName: string
  teamIcon: string
  teamSummary: string
  teamJoinCode: string
  email: string
  userName: string
  avatarUrl: string
  workosUserId: string
  teamExperience?: TeamExperienceType
  role?: Role
}

type GetInviteByTokenArgs = {
  serverToken: string
  token: string
}

type LookupTeamByJoinCodeArgs = {
  serverToken: string
  code: string
}

type ListWorkspacesForSyncArgs = {
  serverToken: string
}

export async function bootstrapAppWorkspaceHandler(
  ctx: MutationCtx,
  args: BootstrapAppWorkspaceArgs
) {
  assertServerToken(args.serverToken)
  const workspaceSlug = createSlug(args.workspaceSlug)
  const teamSlug = createSlug(args.teamSlug)
  const joinCode = normalizeJoinCode(args.teamJoinCode)

  const workspaces = await ctx.db.query("workspaces").collect()
  const teams = await ctx.db.query("teams").collect()
  const role = args.role ?? "admin"

  const workspace =
    workspaces.find((entry) => entry.slug === workspaceSlug) ?? null
  const workspaceId =
    workspace?.id ?? `workspace_${workspaceSlug.replace(/-/g, "_")}`
  const workosOrganizationId = workspace?.workosOrganizationId ?? null

  if (workspace) {
    await ctx.db.patch(workspace._id, {
      slug: workspaceSlug,
      name: args.workspaceName,
      logoUrl: args.workspaceLogoUrl,
      settings: {
        ...workspace.settings,
        accent: args.workspaceAccent,
        description: args.workspaceDescription,
      },
    })
  } else {
    await ctx.db.insert("workspaces", {
      id: workspaceId,
      slug: workspaceSlug,
      name: args.workspaceName,
      logoUrl: args.workspaceLogoUrl,
      workosOrganizationId: null,
      settings: {
        accent: args.workspaceAccent,
        description: args.workspaceDescription,
      },
    })
  }

  const team =
    teams.find(
      (entry) => entry.workspaceId === workspaceId && entry.slug === teamSlug
    ) ?? null
  const teamId = team?.id ?? `team_${teamSlug.replace(/-/g, "_")}`
  const teamExperience =
    args.teamExperience ??
    (
      team?.settings as
        | {
            experience?:
              | "software-development"
              | "issue-analysis"
              | "project-management"
              | "community"
          }
        | undefined
    )?.experience ??
    "software-development"
  const workflow = team
    ? normalizeTeamWorkflowSettings(team.settings.workflow, teamExperience)
    : createDefaultTeamWorkflowSettings(teamExperience)
  const teamIcon = normalizeTeamIcon(args.teamIcon, teamExperience)

  if (team) {
    await ctx.db.patch(team._id, {
      slug: teamSlug,
      name: args.teamName,
      icon: teamIcon,
      settings: {
        ...team.settings,
        joinCode,
        summary: args.teamSummary,
        experience: teamExperience,
        features: normalizeTeamFeatures(
          teamExperience,
          (
            team.settings as {
              features?: {
                issues: boolean
                projects: boolean
                views: boolean
                docs: boolean
                chat: boolean
                channels: boolean
              }
            }
          ).features
        ),
        workflow,
      },
    })
  } else {
    await ctx.db.insert("teams", {
      id: teamId,
      workspaceId,
      slug: teamSlug,
      name: args.teamName,
      icon: teamIcon,
      settings: {
        joinCode,
        summary: args.teamSummary,
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: teamExperience,
        features: createDefaultTeamFeatureSettings(teamExperience),
        workflow,
      },
    })
  }

  const resolvedUser =
    (await getUserByWorkOSUserId(ctx, args.workosUserId)) ??
    (await getUserByEmail(ctx, args.email))
  const userId = resolvedUser?.id ?? createId("user")

  if (resolvedUser) {
    await ctx.db.patch(resolvedUser._id, {
      email: args.email,
      name: args.userName,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(args.email),
      status: resolveUserStatus(resolvedUser.status),
      statusMessage: resolvedUser.statusMessage ?? defaultUserStatusMessage,
      hasExplicitStatus: resolvedUser.hasExplicitStatus ?? false,
      preferences: {
        ...defaultUserPreferences,
        ...resolvedUser.preferences,
      },
    })
  } else {
    await ctx.db.insert("users", {
      id: userId,
      email: args.email,
      name: args.userName,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(args.email),
      title: "Founder / Product",
      status: defaultUserStatus,
      statusMessage: defaultUserStatusMessage,
      hasExplicitStatus: false,
      preferences: defaultUserPreferences,
    })
  }

  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()

  if (membership) {
    await ctx.db.patch(membership._id, {
      role,
    })
  } else {
    await ctx.db.insert("teamMemberships", {
      teamId,
      userId,
      role,
    })
  }

  await syncTeamConversationMemberships(ctx, teamId)

  await setCurrentWorkspaceForUser(ctx, userId, workspaceId)

  await ensureTeamWorkViews(ctx, await getTeamDoc(ctx, teamId))

  return {
    workspaceId,
    workspaceSlug,
    teamId,
    teamSlug,
    userId,
    role,
    workosOrganizationId,
  }
}

export async function getSnapshotHandler(ctx: QueryCtx, args: ServerUserArgs) {
  const authenticatedUser = await resolveUserFromServerArgs(ctx, args)

  if (!authenticatedUser) {
    throw new Error("Authenticated user not found")
  }

  const workspaces = await ctx.db.query("workspaces").collect()
  const teams = await ctx.db.query("teams").collect()
  const teamMemberships = await ctx.db.query("teamMemberships").collect()
  const users = await ctx.db.query("users").collect()
  const userAppState = await getUserAppState(ctx, authenticatedUser.id)
  const currentUserId = authenticatedUser.id
  const currentUserEmail = authenticatedUser.email
  const accessibleMemberships = teamMemberships.filter(
    (membership) => membership.userId === currentUserId
  )
  const accessibleTeamIds = new Set(
    accessibleMemberships.map((membership) => membership.teamId)
  )
  const visibleTeams = teams.filter((team) => accessibleTeamIds.has(team.id))
  const accessibleWorkspaceIds = new Set<string>(
    [
      ...visibleTeams.map((team) => team.workspaceId),
      ...workspaces
        .filter((workspace) => workspace.createdBy === currentUserId)
        .map((workspace) => workspace.id),
    ].filter(Boolean)
  )
  const accessibleWorkspaceIdList = [...accessibleWorkspaceIds]
  const normalizedVisibleTeams = visibleTeams.map(normalizeTeam)
  const membershipWorkspaceId = visibleTeams[0]?.workspaceId ?? null
  const currentWorkspaceId =
    resolvePreferredWorkspaceId({
      selectedWorkspaceId: userAppState?.currentWorkspaceId ?? null,
      accessibleWorkspaceIds,
      fallbackWorkspaceIds: [
        membershipWorkspaceId,
        accessibleWorkspaceIdList[0] ?? null,
      ],
    }) ?? ""
  const visibleWorkspaces = workspaces.filter((workspace) =>
    accessibleWorkspaceIds.has(workspace.id)
  )
  const visibleTeamMemberships = teamMemberships.filter((membership) =>
    accessibleTeamIds.has(membership.teamId)
  )
  const visibleUserIds = new Set(
    visibleTeamMemberships.map((membership) => membership.userId)
  )

  if (currentUserId) {
    visibleUserIds.add(currentUserId)
  }

  const visibleProjects = (await ctx.db.query("projects").collect()).filter(
    (project) =>
      (project.scopeType === "team" &&
        accessibleTeamIds.has(project.scopeId)) ||
      (project.scopeType === "workspace" &&
        accessibleWorkspaceIds.has(project.scopeId))
  )
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const visibleWorkItems = (await ctx.db.query("workItems").collect()).filter(
    (item) => accessibleTeamIds.has(item.teamId)
  )
  const visibleWorkItemIds = new Set(
    visibleWorkItems.map((workItem) => workItem.id)
  )
  const visibleDocuments = (await ctx.db.query("documents").collect())
    .filter((document) => {
      if (
        document.kind === "team-document" ||
        document.kind === "item-description"
      ) {
        return document.teamId !== null && accessibleTeamIds.has(document.teamId)
      }

      if (document.kind === "private-document") {
        return (
          document.createdBy === currentUserId &&
          accessibleWorkspaceIds.has(document.workspaceId ?? "")
        )
      }

      return accessibleWorkspaceIds.has(document.workspaceId ?? "")
    })
    .map((document) => normalizeDocument(document, visibleTeams))
  const visibleDocumentIds = new Set(
    visibleDocuments.map((document) => document.id)
  )
  const visibleViews = (await ctx.db.query("views").collect()).filter((view) => {
    if (view.scopeType === "personal") {
      return view.scopeId === currentUserId
    }

    if (view.scopeType === "team") {
      return accessibleTeamIds.has(view.scopeId)
    }

    return accessibleWorkspaceIds.has(view.scopeId)
  })
  const visibleComments = (await ctx.db.query("comments").collect())
    .filter((comment) =>
      comment.targetType === "workItem"
        ? visibleWorkItemIds.has(comment.targetId)
        : visibleDocumentIds.has(comment.targetId)
    )
    .map((comment) => ({
      ...comment,
      mentionUserIds: comment.mentionUserIds ?? [],
      reactions: comment.reactions ?? [],
    }))
  const attachments = await Promise.all(
    (await ctx.db.query("attachments").collect())
      .filter((attachment) =>
        attachment.targetType === "workItem"
          ? visibleWorkItemIds.has(attachment.targetId)
          : visibleDocumentIds.has(attachment.targetId)
      )
      .map(async (attachment) => ({
        ...attachment,
        fileUrl: await ctx.storage.getUrl(attachment.storageId),
      }))
  )
  const visibleNotifications = currentUserId
    ? (
        await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", currentUserId))
          .collect()
      ).map((notification) => ({
        ...notification,
        archivedAt: notification.archivedAt ?? null,
      }))
    : []
  const visibleInvites = (await ctx.db.query("invites").collect()).filter(
    (invite) =>
      accessibleTeamIds.has(invite.teamId) ||
      invite.email.trim().toLowerCase() === currentUserEmail.toLowerCase()
  )
  const visibleProjectUpdates = (
    await ctx.db.query("projectUpdates").collect()
  ).filter((update) => visibleProjectIds.has(update.projectId))
  const visibleConversations = (
    await ctx.db.query("conversations").collect()
  ).filter((conversation) => {
    if (conversation.scopeType === "team") {
      return accessibleTeamIds.has(conversation.scopeId)
    }

    if (!accessibleWorkspaceIds.has(conversation.scopeId)) {
      return false
    }

    return (
      conversation.kind === "channel" ||
      conversation.participantIds.includes(currentUserId)
    )
  })
  const visibleConversationIds = new Set(
    visibleConversations.map((conversation) => conversation.id)
  )
  const visibleCalls = (await ctx.db.query("calls").collect()).filter((call) =>
    visibleConversationIds.has(call.conversationId)
  )
  const visibleChatMessages = (await ctx.db.query("chatMessages").collect())
    .filter((message) => visibleConversationIds.has(message.conversationId))
    .map((message) => ({
      ...message,
      kind: message.kind ?? "text",
      callId: message.callId ?? null,
      mentionUserIds: message.mentionUserIds ?? [],
    }))
  const visibleChannelPosts = (await ctx.db.query("channelPosts").collect())
    .filter((post) => visibleConversationIds.has(post.conversationId))
    .map((post) => ({
      ...post,
      reactions: post.reactions ?? [],
    }))
  const visibleChannelPostIds = new Set(
    visibleChannelPosts.map((post) => post.id)
  )
  const visibleChannelPostComments = (
    await ctx.db.query("channelPostComments").collect()
  )
    .filter((comment) => visibleChannelPostIds.has(comment.postId))
    .map((comment) => ({
      ...comment,
      mentionUserIds: comment.mentionUserIds ?? [],
    }))

  return {
    currentUserId,
    currentWorkspaceId,
    workspaces: await Promise.all(
      visibleWorkspaces.map((workspace) =>
        resolveWorkspaceSnapshot(ctx, workspace)
      )
    ),
    teams: normalizedVisibleTeams,
    teamMemberships: visibleTeamMemberships,
    users: await Promise.all(
      users
        .filter((user) => visibleUserIds.has(user.id))
        .map((user) => resolveUserSnapshot(ctx, user))
    ),
    labels: await ctx.db.query("labels").collect(),
    projects: visibleProjects,
    milestones: (await ctx.db.query("milestones").collect()).filter(
      (milestone) => visibleProjectIds.has(milestone.projectId)
    ),
    workItems: visibleWorkItems.map((item) =>
      normalizeWorkItem(item, normalizedVisibleTeams)
    ),
    documents: visibleDocuments,
    views: visibleViews.map((view) =>
      normalizeViewDefinition(view, normalizedVisibleTeams)
    ),
    comments: visibleComments,
    attachments,
    notifications: visibleNotifications,
    invites: visibleInvites,
    projectUpdates: visibleProjectUpdates,
    conversations: visibleConversations.map((conversation) => ({
      ...conversation,
      roomId: conversation.roomId ?? null,
      roomName: conversation.roomName ?? null,
    })),
    calls: visibleCalls.map((call) => ({
      ...call,
      roomId: call.roomId ?? null,
      roomName: call.roomName ?? null,
      endedAt: call.endedAt ?? null,
      participantUserIds: call.participantUserIds ?? [],
      lastJoinedAt: call.lastJoinedAt ?? null,
      lastJoinedBy: call.lastJoinedBy ?? null,
      joinCount: call.joinCount ?? 0,
    })),
    chatMessages: visibleChatMessages,
    channelPosts: visibleChannelPosts,
    channelPostComments: visibleChannelPostComments,
  }
}

export async function getSnapshotVersionHandler(
  ctx: QueryCtx,
  args: ServerUserArgs
) {
  const authenticatedUser = await resolveUserFromServerArgs(ctx, args)

  if (!authenticatedUser) {
    throw new Error("Authenticated user not found")
  }

  const config = await getAppConfig(ctx)

  return {
    version: config?.snapshotVersion ?? 0,
    currentUserId: authenticatedUser.id,
  }
}

export async function getAuthContextHandler(
  ctx: QueryCtx,
  args: AuthContextArgs
) {
  const user = await resolveUserFromServerArgs(ctx, args)

  if (!user) {
    return null
  }

  const workspaces = await ctx.db.query("workspaces").collect()
  const teams = await ctx.db.query("teams").collect()
  const userAppState = await getUserAppState(ctx, user.id)
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", user.id))
    .collect()
  const workspaceRoleMap = await getWorkspaceRoleMapForUser(ctx, user.id)
  const pendingInvites = await getPendingInvitesForEmail(ctx, user.email)
  const membershipWorkspaceIds = [
    ...new Set(
      memberships
        .map(
          (membership) =>
            teams.find((team) => team.id === membership.teamId)?.workspaceId
        )
        .filter(isDefinedString)
    ),
  ]
  const accessibleWorkspaceIds: string[] = [
    ...new Set([
      ...membershipWorkspaceIds,
      ...workspaces
        .filter((workspace) => workspace.createdBy === user.id)
        .map((workspace) => workspace.id),
    ]),
  ]
  const preferredWorkspaceId = resolvePreferredWorkspaceId({
    selectedWorkspaceId: userAppState?.currentWorkspaceId ?? null,
    accessibleWorkspaceIds,
    fallbackWorkspaceIds: [
      membershipWorkspaceIds[0] ?? null,
      accessibleWorkspaceIds[0] ?? null,
    ],
  })
  const currentWorkspace = preferredWorkspaceId
    ? await getWorkspaceDoc(ctx, preferredWorkspaceId)
    : null
  const pendingWorkspaceCandidates = workspaces.filter((workspace) => {
    if (workspace.createdBy !== user.id) {
      return false
    }

    return (
      !accessibleWorkspaceIds.includes(workspace.id) &&
      !teams.some((team) => team.workspaceId === workspace.id)
    )
  })
  const pendingWorkspace =
    pendingWorkspaceCandidates.find(
      (workspace) => workspace.id === userAppState?.currentWorkspaceId
    ) ??
    pendingWorkspaceCandidates[0] ??
    null
  const activeWorkspace = currentWorkspace ?? pendingWorkspace
  const onboardingState = activeWorkspace ? "ready" : "needs-workspace"

  return {
    currentUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      workosUserId: user.workosUserId ?? null,
    },
    memberships: memberships.map((membership) => ({
      teamId: membership.teamId,
      role: membership.role,
    })),
    currentWorkspace: activeWorkspace
      ? {
          id: activeWorkspace.id,
          slug: activeWorkspace.slug,
          name: activeWorkspace.name,
          logoUrl: activeWorkspace.logoUrl,
          workosOrganizationId: activeWorkspace.workosOrganizationId ?? null,
        }
      : null,
    pendingWorkspace: pendingWorkspace
      ? {
          id: pendingWorkspace.id,
          slug: pendingWorkspace.slug,
          name: pendingWorkspace.name,
          logoUrl: pendingWorkspace.logoUrl,
          workosOrganizationId: pendingWorkspace.workosOrganizationId ?? null,
        }
      : null,
    pendingInvites,
    onboardingState,
    isWorkspaceAdmin: activeWorkspace
      ? (workspaceRoleMap[activeWorkspace.id] ?? []).includes("admin")
      : false,
  }
}

export async function ensureUserFromAuthHandler(
  ctx: MutationCtx,
  args: EnsureUserFromAuthArgs
) {
  assertServerToken(args.serverToken)
  const existing =
    (await getUserByWorkOSUserId(ctx, args.workosUserId)) ??
    (await getUserByEmail(ctx, args.email))

  if (existing) {
    await ctx.db.patch(existing._id, {
      name: args.name,
      email: args.email,
      workosUserId: args.workosUserId,
      handle: createHandle(args.email),
      status: resolveUserStatus(existing.status),
      statusMessage: existing.statusMessage ?? defaultUserStatusMessage,
      hasExplicitStatus: existing.hasExplicitStatus ?? false,
      preferences: {
        ...defaultUserPreferences,
        ...existing.preferences,
      },
    })

    return {
      userId: existing.id,
      bootstrapped: false,
    }
  }

  const newUserId = createId("user")

  await ctx.db.insert("users", {
    id: newUserId,
    name: args.name,
    handle: createHandle(args.email),
    email: args.email,
    avatarUrl: args.avatarUrl,
    workosUserId: args.workosUserId,
    title: "Member",
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    hasExplicitStatus: false,
    preferences: defaultUserPreferences,
  })

  const bootstrapped = await bootstrapFirstAuthenticatedUser(ctx, newUserId)

  return {
    userId: newUserId,
    bootstrapped,
  }
}

export async function bootstrapWorkspaceUserHandler(
  ctx: MutationCtx,
  args: BootstrapWorkspaceUserArgs
) {
  assertServerToken(args.serverToken)
  const workspaces = await ctx.db.query("workspaces").collect()
  const workspace = workspaces.find(
    (entry) => entry.slug === args.workspaceSlug
  )

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const teams = await ctx.db.query("teams").collect()
  const team = teams.find(
    (entry) =>
      entry.workspaceId === workspace.id && entry.slug === args.teamSlug
  )

  if (!team) {
    throw new Error("Team not found")
  }

  const existingByWorkOSUserId = await getUserByWorkOSUserId(
    ctx,
    args.workosUserId
  )
  const existingByEmail = await getUserByEmail(ctx, args.email)
  const preferredUser = args.existingUserId
    ? await getUserDoc(ctx, args.existingUserId)
    : null
  const resolvedUser = preferredUser ?? existingByWorkOSUserId ?? existingByEmail ?? null

  if (
    preferredUser &&
    ((existingByWorkOSUserId &&
      existingByWorkOSUserId.id !== preferredUser.id) ||
      (existingByEmail && existingByEmail.id !== preferredUser.id))
  ) {
    throw new Error("A different Convex user already matches this WorkOS identity")
  }

  const userId = resolvedUser?.id ?? createId("user")
  const role = args.role ?? "admin"

  if (resolvedUser) {
    await ctx.db.patch(resolvedUser._id, {
      email: args.email,
      name: args.name,
      workosUserId: args.workosUserId,
      status: resolveUserStatus(resolvedUser.status),
      statusMessage: resolvedUser.statusMessage ?? defaultUserStatusMessage,
      hasExplicitStatus: resolvedUser.hasExplicitStatus ?? false,
      preferences: {
        ...defaultUserPreferences,
        ...resolvedUser.preferences,
      },
    })
  } else {
    await ctx.db.insert("users", {
      id: userId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(args.email),
      title: "Founder / Product",
      status: defaultUserStatus,
      statusMessage: defaultUserStatusMessage,
      hasExplicitStatus: false,
      preferences: defaultUserPreferences,
    })
  }

  const existingMembership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", team.id).eq("userId", userId)
    )
    .unique()

  if (existingMembership) {
    await ctx.db.patch(existingMembership._id, {
      role,
    })
  } else {
    await ctx.db.insert("teamMemberships", {
      teamId: team.id,
      userId,
      role,
    })
  }

  await syncTeamConversationMemberships(ctx, team.id)

  await setCurrentWorkspaceForUser(ctx, userId, workspace.id)

  return {
    userId,
    teamId: team.id,
    workspaceId: workspace.id,
    workosOrganizationId: workspace.workosOrganizationId ?? null,
    role,
  }
}

export async function getInviteByTokenHandler(
  ctx: QueryCtx,
  args: GetInviteByTokenArgs
) {
  assertServerToken(args.serverToken)
  const invite = await getInviteByTokenDoc(ctx, args.token)

  if (!invite) {
    return null
  }

  const team = await getTeamDoc(ctx, invite.teamId)
  const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)

  return {
    invite: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      joinCode: invite.joinCode,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      declinedAt: invite.declinedAt ?? null,
    },
    team: team
      ? {
          id: team.id,
          slug: team.slug,
          name: team.name,
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
}

export async function lookupTeamByJoinCodeHandler(
  ctx: QueryCtx,
  args: LookupTeamByJoinCodeArgs
) {
  assertServerToken(args.serverToken)
  const teams = await ctx.db.query("teams").collect()
  const team = teams.find((entry) =>
    matchesTeamAccessIdentifier(entry, args.code)
  )

  if (!team) {
    return null
  }

  const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

  if (!workspace) {
    return null
  }

  const teamExperience =
    (
      team.settings as {
        experience?:
          | "software-development"
          | "issue-analysis"
          | "project-management"
          | "community"
      }
    ).experience ?? "software-development"

  return {
    team: {
      id: team.id,
      slug: team.slug,
      name: team.name,
      summary: team.settings.summary,
      joinCode: team.settings.joinCode,
      workflow: normalizeTeamWorkflowSettings(
        team.settings.workflow,
        teamExperience
      ),
    },
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      logoUrl: workspace.logoUrl,
    },
  }
}

export async function listWorkspacesForSyncHandler(
  ctx: QueryCtx,
  args: ListWorkspacesForSyncArgs
) {
  assertServerToken(args.serverToken)
  const workspaces = await ctx.db.query("workspaces").collect()

  return workspaces.map((workspace) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    workosOrganizationId: workspace.workosOrganizationId ?? null,
  }))
}
