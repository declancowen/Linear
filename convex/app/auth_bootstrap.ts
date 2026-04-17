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
  normalizeEmailAddress,
  normalizeJoinCode,
  normalizeTeamIcon,
} from "./core"
import {
  bootstrapFirstAuthenticatedUser,
  getAppConfig,
  getInviteByTokenDoc,
  getPendingInvitesForEmail,
  getAuthLifecycleError,
  listAttachmentsByTargets,
  getTeamBySlug,
  getTeamByJoinCode,
  getTeamByWorkspaceAndSlug,
  listCallsByConversations,
  listChannelPostCommentsByPosts,
  listChannelPostsByConversations,
  listChatMessagesByConversations,
  listCommentsByTargets,
  listConversationsByScopes,
  getTeamDoc,
  getUserAppState,
  getUserByEmail,
  getUserByWorkOSUserId,
  getUserDoc,
  getWorkspaceBySlug,
  getWorkspaceDoc,
  getWorkspaceRoleMapForUser,
  isDefinedString,
  listLabelsByWorkspaces,
  listMilestonesByProjects,
  listNotificationsByUser,
  listProjectUpdatesByProjects,
  listProjectsByScopes,
  listTeamMembershipsByUser,
  listTeamMembershipsByTeams,
  listTeamsByIds,
  listTeamDocumentsByTeams,
  listInvitesByNormalizedEmail,
  listInvitesByTeams,
  listPersonalViewsByUsers,
  listUsersByIds,
  listViewsByScopes,
  listWorkItemsByTeams,
  listWorkspacesByIds,
  listWorkspacesOwnedByUser,
  listWorkspaceDocumentsByWorkspaces,
  listWorkspaceTeams,
  resolveActiveUserByIdentity,
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
  const normalizedEmail = normalizeEmailAddress(args.email)
  const workspaceSlug = createSlug(args.workspaceSlug)
  const teamSlug = createSlug(args.teamSlug)
  const joinCode = normalizeJoinCode(args.teamJoinCode)
  const role = args.role ?? "admin"

  const workspace = await getWorkspaceBySlug(ctx, workspaceSlug)
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

  const team = await getTeamByWorkspaceAndSlug(ctx, workspaceId, teamSlug)
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
      joinCodeNormalized: joinCode,
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
      joinCodeNormalized: joinCode,
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

  const resolvedUser = await resolveActiveUserByIdentity(ctx, {
    workosUserId: args.workosUserId,
    email: normalizedEmail,
  })
  const userId = resolvedUser?.id ?? createId("user")

  if (resolvedUser) {
    await ctx.db.patch(resolvedUser._id, {
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      name: args.userName,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(normalizedEmail),
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
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      name: args.userName,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(normalizedEmail),
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

  const userAppState = await getUserAppState(ctx, authenticatedUser.id)
  const currentUserId = authenticatedUser.id
  const currentUserEmail = authenticatedUser.email
  const normalizedCurrentUserEmail = normalizeEmailAddress(currentUserEmail)
  const accessibleMemberships = await listTeamMembershipsByUser(
    ctx,
    currentUserId
  )
  const accessibleTeamIdList = [
    ...new Set(accessibleMemberships.map((membership) => membership.teamId)),
  ]
  const accessibleTeamIds = new Set(accessibleTeamIdList)
  const visibleTeams = await listTeamsByIds(ctx, accessibleTeamIdList)
  const ownedWorkspaces = await listWorkspacesOwnedByUser(ctx, currentUserId)
  const accessibleWorkspaceIds = new Set<string>(
    [
      ...visibleTeams.map((team) => team.workspaceId),
      ...ownedWorkspaces.map((workspace) => workspace.id),
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
  const visibleWorkspaces = [
    ...new Map(
      [
        ...ownedWorkspaces,
        ...(await listWorkspacesByIds(ctx, accessibleWorkspaceIdList)),
      ].map((workspace) => [workspace.id, workspace] as const)
    ).values(),
  ]
  const visibleTeamMemberships = await listTeamMembershipsByTeams(
    ctx,
    accessibleTeamIdList
  )
  const visibleUserIds = new Set(
    visibleTeamMemberships.map((membership) => membership.userId)
  )

  if (currentUserId) {
    visibleUserIds.add(currentUserId)
  }

  const visibleProjects = await listProjectsByScopes(ctx, [
    ...accessibleTeamIdList.map((teamId) => ({
      scopeType: "team" as const,
      scopeId: teamId,
    })),
    ...accessibleWorkspaceIdList.map((workspaceId) => ({
      scopeType: "workspace" as const,
      scopeId: workspaceId,
    })),
  ])
  const visibleProjectIds = new Set(
    visibleProjects.map((project) => project.id)
  )
  const visibleWorkItems = await listWorkItemsByTeams(ctx, accessibleTeamIdList)
  const visibleWorkItemIds = new Set(
    visibleWorkItems.map((workItem) => workItem.id)
  )
  const visibleDocuments = [
    ...(await listTeamDocumentsByTeams(ctx, accessibleTeamIdList)),
    ...(await listWorkspaceDocumentsByWorkspaces(ctx, accessibleWorkspaceIdList)),
  ]
    .filter(
      (document, index, documents) =>
        documents.findIndex((entry) => entry.id === document.id) === index
    )
    .filter((document) => {
      if (
        document.kind === "team-document" ||
        document.kind === "item-description"
      ) {
        return (
          document.teamId !== null && accessibleTeamIds.has(document.teamId)
        )
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
  const visibleViews = [
    ...(currentUserId ? await listPersonalViewsByUsers(ctx, [currentUserId]) : []),
    ...(await listViewsByScopes(ctx, [
      ...accessibleTeamIdList.map((teamId) => ({
        scopeType: "team" as const,
        scopeId: teamId,
      })),
      ...accessibleWorkspaceIdList.map((workspaceId) => ({
        scopeType: "workspace" as const,
        scopeId: workspaceId,
      })),
    ])),
  ]
  const visibleComments = [
    ...(await listCommentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: visibleWorkItemIds,
    })),
    ...(await listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: visibleDocumentIds,
    })),
  ].map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
    reactions: comment.reactions ?? [],
  }))
  const attachments = await Promise.all(
    [
      ...(await listAttachmentsByTargets(ctx, {
        targetType: "workItem",
        targetIds: visibleWorkItemIds,
      })),
      ...(await listAttachmentsByTargets(ctx, {
        targetType: "document",
        targetIds: visibleDocumentIds,
      })),
    ].map(async (attachment) => ({
      ...attachment,
      fileUrl: await ctx.storage.getUrl(attachment.storageId),
    }))
  )
  const visibleNotifications = currentUserId
    ? (await listNotificationsByUser(ctx, currentUserId)).map((notification) => ({
        ...notification,
        archivedAt: notification.archivedAt ?? null,
      }))
    : []
  const visibleInvites = [
    ...new Map(
      (
        await Promise.all([
          listInvitesByTeams(ctx, accessibleTeamIdList),
          listInvitesByNormalizedEmail(ctx, normalizedCurrentUserEmail),
        ])
      )
        .flat()
        .map((invite) => [invite.id, invite] as const)
    ).values(),
  ].filter(
    (invite) =>
      accessibleTeamIds.has(invite.teamId) ||
      normalizeEmailAddress(invite.email) === normalizedCurrentUserEmail
  )
  const visibleProjectUpdates = await listProjectUpdatesByProjects(
    ctx,
    visibleProjectIds
  )
  const visibleConversations = [
    ...(await listConversationsByScopes(
      ctx,
      accessibleTeamIdList.map((teamId) => ({
        scopeType: "team" as const,
        scopeId: teamId,
      }))
    )),
    ...(await listConversationsByScopes(
      ctx,
      accessibleWorkspaceIdList.map((workspaceId) => ({
        scopeType: "workspace" as const,
        scopeId: workspaceId,
      }))
    ))
      .filter(
        (conversation) =>
          conversation.kind === "channel" ||
          conversation.participantIds.includes(currentUserId)
      ),
  ]
  const visibleConversationIds = new Set(
    visibleConversations.map((conversation) => conversation.id)
  )
  const visibleCalls = await listCallsByConversations(ctx, visibleConversationIds)
  const visibleChatMessages = (
    await listChatMessagesByConversations(ctx, visibleConversationIds)
  ).map((message) => ({
    ...message,
    kind: message.kind ?? "text",
    callId: message.callId ?? null,
    mentionUserIds: message.mentionUserIds ?? [],
  }))
  const visibleChannelPosts = (
    await listChannelPostsByConversations(ctx, visibleConversationIds)
  ).map((post) => ({
    ...post,
    reactions: post.reactions ?? [],
  }))
  const visibleChannelPostIds = new Set(
    visibleChannelPosts.map((post) => post.id)
  )
  const visibleChannelPostComments = (
    await listChannelPostCommentsByPosts(ctx, visibleChannelPostIds)
  ).map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
  }))

  for (const workspace of visibleWorkspaces) {
    if (workspace.createdBy) {
      visibleUserIds.add(workspace.createdBy)
    }
  }

  for (const project of visibleProjects) {
    visibleUserIds.add(project.leadId)

    for (const memberId of project.memberIds) {
      visibleUserIds.add(memberId)
    }
  }

  for (const workItem of visibleWorkItems) {
    visibleUserIds.add(workItem.creatorId)

    if (workItem.assigneeId) {
      visibleUserIds.add(workItem.assigneeId)
    }

    for (const subscriberId of workItem.subscriberIds) {
      visibleUserIds.add(subscriberId)
    }
  }

  for (const document of visibleDocuments) {
    visibleUserIds.add(document.createdBy)
    visibleUserIds.add(document.updatedBy)
  }

  for (const view of visibleViews) {
    if (view.scopeType === "personal") {
      visibleUserIds.add(view.scopeId)
    }

    for (const assigneeId of view.filters.assigneeIds) {
      visibleUserIds.add(assigneeId)
    }

    for (const creatorId of view.filters.creatorIds) {
      visibleUserIds.add(creatorId)
    }

    for (const leadId of view.filters.leadIds) {
      visibleUserIds.add(leadId)
    }
  }

  for (const comment of visibleComments) {
    visibleUserIds.add(comment.createdBy)

    for (const mentionUserId of comment.mentionUserIds) {
      visibleUserIds.add(mentionUserId)
    }

    for (const reaction of comment.reactions) {
      for (const reactionUserId of reaction.userIds) {
        visibleUserIds.add(reactionUserId)
      }
    }
  }

  for (const attachment of attachments) {
    visibleUserIds.add(attachment.uploadedBy)
  }

  for (const notification of visibleNotifications) {
    visibleUserIds.add(notification.userId)
    visibleUserIds.add(notification.actorId)
  }

  for (const invite of visibleInvites) {
    visibleUserIds.add(invite.invitedBy)
  }

  for (const update of visibleProjectUpdates) {
    visibleUserIds.add(update.createdBy)
  }

  for (const conversation of visibleConversations) {
    visibleUserIds.add(conversation.createdBy)

    for (const participantId of conversation.participantIds) {
      visibleUserIds.add(participantId)
    }
  }

  for (const call of visibleCalls) {
    visibleUserIds.add(call.startedBy)

    if (call.lastJoinedBy) {
      visibleUserIds.add(call.lastJoinedBy)
    }

    for (const participantUserId of call.participantUserIds ?? []) {
      visibleUserIds.add(participantUserId)
    }
  }

  for (const message of visibleChatMessages) {
    visibleUserIds.add(message.createdBy)

    for (const mentionUserId of message.mentionUserIds) {
      visibleUserIds.add(mentionUserId)
    }
  }

  for (const post of visibleChannelPosts) {
    visibleUserIds.add(post.createdBy)

    for (const reaction of post.reactions) {
      for (const reactionUserId of reaction.userIds) {
        visibleUserIds.add(reactionUserId)
      }
    }
  }

  for (const comment of visibleChannelPostComments) {
    visibleUserIds.add(comment.createdBy)

    for (const mentionUserId of comment.mentionUserIds) {
      visibleUserIds.add(mentionUserId)
    }
  }

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
      (await listUsersByIds(ctx, visibleUserIds)).map((user) =>
        resolveUserSnapshot(ctx, user)
      )
    ),
    labels: await listLabelsByWorkspaces(ctx, accessibleWorkspaceIdList),
    projects: visibleProjects,
    milestones: await listMilestonesByProjects(ctx, visibleProjectIds),
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

  const userAppState = await getUserAppState(ctx, user.id)
  const memberships = await listTeamMembershipsByUser(ctx, user.id)
  const teams = await listTeamsByIds(
    ctx,
    memberships.map((membership) => membership.teamId)
  )
  const ownedWorkspaces = await listWorkspacesOwnedByUser(ctx, user.id)
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
      ...ownedWorkspaces.map((workspace) => workspace.id),
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
  const pendingWorkspaceCandidates = (
    await Promise.all(
      ownedWorkspaces.map(async (workspace) => {
        if (accessibleWorkspaceIds.includes(workspace.id)) {
          return null
        }

        const workspaceTeams = await listWorkspaceTeams(ctx, workspace.id)

        if (workspaceTeams.length > 0) {
          return null
        }

        return workspace
      })
    )
  ).filter((workspace) => workspace != null)
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
    isWorkspaceOwner: activeWorkspace
      ? activeWorkspace.createdBy === user.id
      : false,
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
  const normalizedEmail = normalizeEmailAddress(args.email)
  const existing = await resolveActiveUserByIdentity(ctx, {
    workosUserId: args.workosUserId,
    email: normalizedEmail,
  })

  if (existing) {
    await ctx.db.patch(existing._id, {
      name: args.name,
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      workosUserId: args.workosUserId,
      handle: createHandle(normalizedEmail),
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
    handle: createHandle(normalizedEmail),
    email: normalizedEmail,
    emailNormalized: normalizedEmail,
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
  const normalizedEmail = normalizeEmailAddress(args.email)
  const workspace = await getWorkspaceBySlug(ctx, args.workspaceSlug)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const team = await getTeamByWorkspaceAndSlug(ctx, workspace.id, args.teamSlug)

  if (!team) {
    throw new Error("Team not found")
  }

  const existingByWorkOSUserId = await getUserByWorkOSUserId(
    ctx,
    args.workosUserId
  )
  const workosLifecycleError = getAuthLifecycleError(existingByWorkOSUserId)

  if (workosLifecycleError) {
    throw new Error(workosLifecycleError)
  }
  const existingByEmail = await getUserByEmail(ctx, normalizedEmail)
  const preferredUser = args.existingUserId
    ? await getUserDoc(ctx, args.existingUserId)
    : null
  const preferredLifecycleError = getAuthLifecycleError(preferredUser)

  if (preferredLifecycleError) {
    throw new Error(preferredLifecycleError)
  }

  const resolvedUser =
    preferredUser ?? existingByWorkOSUserId ?? existingByEmail ?? null

  if (
    preferredUser &&
    ((existingByWorkOSUserId &&
      existingByWorkOSUserId.id !== preferredUser.id) ||
      (existingByEmail && existingByEmail.id !== preferredUser.id))
  ) {
    throw new Error(
      "A different Convex user already matches this WorkOS identity"
    )
  }

  const userId = resolvedUser?.id ?? createId("user")
  const role = args.role ?? "admin"

  if (resolvedUser) {
    await ctx.db.patch(resolvedUser._id, {
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
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
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      name: args.name,
      avatarUrl: args.avatarUrl,
      workosUserId: args.workosUserId,
      handle: createHandle(normalizedEmail),
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
  const team =
    (await getTeamDoc(ctx, args.code)) ??
    (await getTeamBySlug(ctx, createSlug(args.code))) ??
    (await getTeamByJoinCode(ctx, args.code))

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
