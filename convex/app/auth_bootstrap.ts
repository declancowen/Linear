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
  getPendingInvitesForEmail,
  getAuthLifecycleError,
  listInvitesByToken,
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
  listWorkspaceMembershipsByUser,
  listWorkspaceMembershipsByWorkspaces,
  listWorkspacesOwnedByUser,
  listWorkspaceDocumentsByWorkspaces,
  listWorkspaceTeams,
  resolveActiveUserByIdentity,
  resolvePreferredWorkspaceId,
  setCurrentWorkspaceForUser,
  syncWorkspaceMembershipRoleFromTeams,
} from "./data"
import { resolveUserFromServerArgs } from "./server_users"
import { syncTeamConversationMemberships } from "./conversations"
import { ensureTeamProjectViews, ensureTeamWorkViews } from "./work_helpers"
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

type GetWorkspaceMembershipBootstrapArgs = ServerUserArgs & {
  workspaceId: string
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

type BootstrapTeamDoc = Awaited<ReturnType<typeof getTeamByWorkspaceAndSlug>>
type BootstrapUserDoc = Awaited<ReturnType<typeof resolveActiveUserByIdentity>>
type BootstrapWorkspaceDoc = NonNullable<
  Awaited<ReturnType<typeof getWorkspaceBySlug>>
>
type BootstrapWorkspaceTeamDoc = NonNullable<
  Awaited<ReturnType<typeof getTeamByWorkspaceAndSlug>>
>
type BootstrapWorkspaceUserDoc = NonNullable<
  Awaited<ReturnType<typeof getUserByWorkOSUserId>>
>
type AuthContextUserDoc = NonNullable<
  Awaited<ReturnType<typeof resolveUserFromServerArgs>>
>
type AuthContextTeamMembershipDoc = Awaited<
  ReturnType<typeof listTeamMembershipsByUser>
>[number]
type AuthContextTeamDoc = Awaited<ReturnType<typeof listTeamsByIds>>[number]
type AuthContextWorkspaceDoc = Awaited<
  ReturnType<typeof listWorkspacesOwnedByUser>
>[number]
type TeamFeatureSettings = ReturnType<typeof createDefaultTeamFeatureSettings>

async function hasAnyWorkspaceAccess(ctx: MutationCtx, userId: string) {
  const [workspaceMemberships, teamMemberships, ownedWorkspaces] =
    await Promise.all([
      listWorkspaceMembershipsByUser(ctx, userId),
      listTeamMembershipsByUser(ctx, userId),
      listWorkspacesOwnedByUser(ctx, userId),
    ])

  if (workspaceMemberships.length > 0 || ownedWorkspaces.length > 0) {
    return true
  }

  if (teamMemberships.length === 0) {
    return false
  }

  const teams = await listTeamsByIds(
    ctx,
    teamMemberships.map((membership) => membership.teamId)
  )

  return teams.length > 0
}

function resolveUserPresencePatch(
  user: {
    status?: string | null
    statusMessage?: string | null
    hasExplicitStatus?: boolean | null
  },
  resetPresence: boolean
) {
  if (resetPresence) {
    return {
      status: defaultUserStatus,
      statusMessage: defaultUserStatusMessage,
      hasExplicitStatus: false,
    }
  }

  return {
    status: resolveUserStatus(user.status),
    statusMessage: user.statusMessage ?? defaultUserStatusMessage,
    hasExplicitStatus: user.hasExplicitStatus ?? false,
  }
}

function dedupeById<T extends { id: string }>(entries: T[]) {
  return [
    ...new Map(entries.map((entry) => [entry.id, entry] as const)).values(),
  ]
}

function resolveWorkspaceMembershipWorkspaceId(input: {
  requestedWorkspaceId: string
  preferredWorkspaceId: string
  accessibleWorkspaceIds: Set<string>
}) {
  return (
    [
      input.requestedWorkspaceId,
      input.preferredWorkspaceId,
      ...input.accessibleWorkspaceIds,
    ].find(
      (workspaceId) =>
        typeof workspaceId === "string" &&
        workspaceId.length > 0 &&
        input.accessibleWorkspaceIds.has(workspaceId)
    ) ?? ""
  )
}

function selectWorkspaceMembershipInviteEntries<
  T extends {
    workspaceId: string
    email: string
    acceptedAt?: string | null
    declinedAt?: string | null
  },
>(input: {
  invites: T[]
  resolvedWorkspaceId: string
  normalizedCurrentUserEmail: string
}) {
  return input.invites.filter((invite) => {
    const isPendingCurrentUserInvite =
      input.normalizedCurrentUserEmail.length > 0 &&
      normalizeEmailAddress(invite.email) ===
        input.normalizedCurrentUserEmail &&
      !invite.acceptedAt &&
      !invite.declinedAt

    return (
      invite.workspaceId === input.resolvedWorkspaceId ||
      isPendingCurrentUserInvite
    )
  })
}

async function buildWorkspaceMembershipBootstrap(
  ctx: QueryCtx,
  input: {
    currentUserId: string
    currentUserEmail: string
    requestedWorkspaceId: string
  }
) {
  const userAppState = await getUserAppState(ctx, input.currentUserId)
  const normalizedCurrentUserEmail = normalizeEmailAddress(
    input.currentUserEmail
  )
  const [accessibleWorkspaceMemberships, accessibleMemberships] =
    await Promise.all([
      listWorkspaceMembershipsByUser(ctx, input.currentUserId),
      listTeamMembershipsByUser(ctx, input.currentUserId),
    ])
  const accessibleTeamIdList = [
    ...new Set(accessibleMemberships.map((membership) => membership.teamId)),
  ]
  const visibleTeams = await listTeamsByIds(ctx, accessibleTeamIdList)
  const ownedWorkspaces = await listWorkspacesOwnedByUser(
    ctx,
    input.currentUserId
  )
  const accessibleWorkspaceIds = new Set<string>(
    [
      ...accessibleWorkspaceMemberships.map(
        (membership) => membership.workspaceId
      ),
      ...visibleTeams.map((team) => team.workspaceId),
      ...ownedWorkspaces.map((workspace) => workspace.id),
    ].filter(Boolean)
  )
  const accessibleWorkspaceIdList = [...accessibleWorkspaceIds]
  const membershipWorkspaceId =
    accessibleWorkspaceMemberships[0]?.workspaceId ??
    visibleTeams[0]?.workspaceId ??
    null
  const preferredWorkspaceId =
    resolvePreferredWorkspaceId({
      selectedWorkspaceId: userAppState?.currentWorkspaceId ?? null,
      accessibleWorkspaceIds,
      fallbackWorkspaceIds: [
        membershipWorkspaceId,
        accessibleWorkspaceIdList[0] ?? null,
      ],
    }) ?? ""
  const resolvedWorkspaceId = resolveWorkspaceMembershipWorkspaceId({
    requestedWorkspaceId: input.requestedWorkspaceId,
    preferredWorkspaceId,
    accessibleWorkspaceIds,
  })
  const visibleWorkspaces = dedupeById(
    [
      ...ownedWorkspaces,
      ...(accessibleWorkspaceIdList.length > 0
        ? await listWorkspacesByIds(ctx, accessibleWorkspaceIdList)
        : []),
    ].filter((workspace) => accessibleWorkspaceIds.has(workspace.id))
  )
  const workspace =
    visibleWorkspaces.find((entry) => entry.id === resolvedWorkspaceId) ?? null
  const [visibleWorkspaceMemberships, teamInvites, currentUserInvites, labels] =
    await Promise.all([
      accessibleWorkspaceIdList.length > 0
        ? listWorkspaceMembershipsByWorkspaces(ctx, accessibleWorkspaceIdList)
        : Promise.resolve([]),
      accessibleTeamIdList.length > 0
        ? listInvitesByTeams(ctx, accessibleTeamIdList)
        : Promise.resolve([]),
      normalizedCurrentUserEmail.length > 0
        ? listInvitesByNormalizedEmail(ctx, normalizedCurrentUserEmail)
        : Promise.resolve([]),
      resolvedWorkspaceId
        ? listLabelsByWorkspaces(ctx, [resolvedWorkspaceId])
        : Promise.resolve([]),
    ])
  const workspaceMemberships = visibleWorkspaceMemberships.filter(
    (membership) =>
      membership.workspaceId === resolvedWorkspaceId ||
      (membership.userId === input.currentUserId &&
        accessibleWorkspaceIds.has(membership.workspaceId))
  )
  const teams = visibleTeams
    .filter((team) => team.workspaceId === resolvedWorkspaceId)
    .map((team) => normalizeTeam(team))
  const teamIds = teams.map((team) => team.id)
  const teamMemberships =
    teamIds.length > 0 ? await listTeamMembershipsByTeams(ctx, teamIds) : []
  const invites = selectWorkspaceMembershipInviteEntries({
    invites: dedupeById([...teamInvites, ...currentUserInvites]),
    resolvedWorkspaceId,
    normalizedCurrentUserEmail,
  })
  const userIds = new Set<string>([
    input.currentUserId,
    workspace?.createdBy ?? "",
    ...workspaceMemberships.map((membership) => membership.userId),
    ...teamMemberships.map((membership) => membership.userId),
    ...invites.map((invite) => invite.invitedBy),
  ])
  const users = await Promise.all(
    (userIds.size > 0
      ? await listUsersByIds(ctx, [...userIds].filter(Boolean))
      : []
    ).map((user) => resolveUserSnapshot(ctx, user))
  )

  return {
    currentUserId: input.currentUserId,
    currentWorkspaceId: resolvedWorkspaceId,
    workspaces: await Promise.all(
      visibleWorkspaces.map((workspaceEntry) =>
        resolveWorkspaceSnapshot(ctx, workspaceEntry)
      )
    ),
    workspaceMemberships,
    teams,
    teamMemberships,
    labels,
    users,
    invites,
  }
}

async function upsertBootstrapWorkspace(
  ctx: MutationCtx,
  args: BootstrapAppWorkspaceArgs,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceBySlug(ctx, workspaceSlug)
  const workspaceId =
    workspace?.id ?? `workspace_${workspaceSlug.replace(/-/g, "_")}`

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

  return {
    workspaceId,
    workosOrganizationId: workspace?.workosOrganizationId ?? null,
  }
}

function resolveBootstrapTeamExperience(
  args: BootstrapAppWorkspaceArgs,
  team: BootstrapTeamDoc
) {
  return (
    args.teamExperience ??
    (team?.settings as { experience?: TeamExperienceType } | undefined)
      ?.experience ??
    "software-development"
  )
}

function resolveBootstrapTeamFeatures(
  team: BootstrapTeamDoc,
  teamExperience: TeamExperienceType
) {
  if (!team) {
    return createDefaultTeamFeatureSettings(teamExperience)
  }

  return normalizeTeamFeatures(
    teamExperience,
    (team.settings as { features?: TeamFeatureSettings }).features
  )
}

async function upsertBootstrapTeam(
  ctx: MutationCtx,
  input: {
    args: BootstrapAppWorkspaceArgs
    joinCode: string
    teamSlug: string
    workspaceId: string
  }
) {
  const team = await getTeamByWorkspaceAndSlug(
    ctx,
    input.workspaceId,
    input.teamSlug
  )
  const teamId = team?.id ?? `team_${input.teamSlug.replace(/-/g, "_")}`
  const teamExperience = resolveBootstrapTeamExperience(input.args, team)
  const workflow = team
    ? normalizeTeamWorkflowSettings(team.settings.workflow, teamExperience)
    : createDefaultTeamWorkflowSettings(teamExperience)
  const teamIcon = normalizeTeamIcon(input.args.teamIcon, teamExperience)

  if (team) {
    await ctx.db.patch(team._id, {
      joinCodeNormalized: input.joinCode,
      slug: input.teamSlug,
      name: input.args.teamName,
      icon: teamIcon,
      settings: {
        ...team.settings,
        joinCode: input.joinCode,
        summary: input.args.teamSummary,
        experience: teamExperience,
        features: resolveBootstrapTeamFeatures(team, teamExperience),
        workflow,
      },
    })
  } else {
    await ctx.db.insert("teams", {
      id: teamId,
      workspaceId: input.workspaceId,
      joinCodeNormalized: input.joinCode,
      slug: input.teamSlug,
      name: input.args.teamName,
      icon: teamIcon,
      settings: {
        joinCode: input.joinCode,
        summary: input.args.teamSummary,
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: teamExperience,
        features: resolveBootstrapTeamFeatures(team, teamExperience),
        workflow,
      },
    })
  }

  return teamId
}

async function patchBootstrapUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapAppWorkspaceArgs
    normalizedEmail: string
    user: NonNullable<BootstrapUserDoc>
  }
) {
  const resetPresence = !(await hasAnyWorkspaceAccess(ctx, input.user.id))

  await ctx.db.patch(input.user._id, {
    email: input.normalizedEmail,
    emailNormalized: input.normalizedEmail,
    name: input.args.userName,
    avatarUrl: input.args.avatarUrl,
    workosUserId: input.args.workosUserId,
    handle: createHandle(input.normalizedEmail),
    ...resolveUserPresencePatch(input.user, resetPresence),
    preferences: {
      ...defaultUserPreferences,
      ...input.user.preferences,
    },
  })
}

async function insertBootstrapUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapAppWorkspaceArgs
    normalizedEmail: string
    userId: string
  }
) {
  await ctx.db.insert("users", {
    id: input.userId,
    email: input.normalizedEmail,
    emailNormalized: input.normalizedEmail,
    name: input.args.userName,
    avatarUrl: input.args.avatarUrl,
    workosUserId: input.args.workosUserId,
    handle: createHandle(input.normalizedEmail),
    title: "Founder / Product",
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    hasExplicitStatus: false,
    preferences: defaultUserPreferences,
  })
}

async function upsertBootstrapUser(
  ctx: MutationCtx,
  args: BootstrapAppWorkspaceArgs,
  normalizedEmail: string
) {
  const resolvedUser = await resolveActiveUserByIdentity(ctx, {
    workosUserId: args.workosUserId,
    email: normalizedEmail,
  })
  const userId = resolvedUser?.id ?? createId("user")

  if (resolvedUser) {
    await patchBootstrapUser(ctx, {
      args,
      normalizedEmail,
      user: resolvedUser,
    })
  } else {
    await insertBootstrapUser(ctx, {
      args,
      normalizedEmail,
      userId,
    })
  }

  return userId
}

async function upsertBootstrapTeamMembership(
  ctx: MutationCtx,
  input: {
    role: Role
    teamId: string
    userId: string
  }
) {
  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", input.teamId).eq("userId", input.userId)
    )
    .unique()

  if (membership) {
    await ctx.db.patch(membership._id, {
      role: input.role,
    })
    return
  }

  await ctx.db.insert("teamMemberships", {
    teamId: input.teamId,
    userId: input.userId,
    role: input.role,
  })
}

async function ensureBootstrapWorkspaceCreator(
  ctx: MutationCtx,
  input: {
    userId: string
    workspaceId: string
  }
) {
  const persistedWorkspace = await getWorkspaceDoc(ctx, input.workspaceId)

  if (persistedWorkspace && !persistedWorkspace.createdBy) {
    await ctx.db.patch(persistedWorkspace._id, {
      createdBy: input.userId,
    })
  }
}

async function finalizeBootstrapWorkspaceAccess(
  ctx: MutationCtx,
  input: {
    role: Role
    teamId: string
    userId: string
    workspaceId: string
  }
) {
  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    fallbackRole: input.role,
  })

  await syncTeamConversationMemberships(ctx, input.teamId)
  await setCurrentWorkspaceForUser(ctx, input.userId, input.workspaceId)

  const team = await getTeamDoc(ctx, input.teamId)
  await ensureTeamWorkViews(ctx, team)
  await ensureTeamProjectViews(ctx, team)
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
  const { workspaceId, workosOrganizationId } = await upsertBootstrapWorkspace(
    ctx,
    args,
    workspaceSlug
  )
  const teamId = await upsertBootstrapTeam(ctx, {
    args,
    joinCode,
    teamSlug,
    workspaceId,
  })
  const userId = await upsertBootstrapUser(ctx, args, normalizedEmail)

  await upsertBootstrapTeamMembership(ctx, {
    role,
    teamId,
    userId,
  })
  await ensureBootstrapWorkspaceCreator(ctx, {
    userId,
    workspaceId,
  })
  await finalizeBootstrapWorkspaceAccess(ctx, {
    role,
    teamId,
    userId,
    workspaceId,
  })

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

function addReactionUserIds(
  visibleUserIds: Set<string>,
  reactions?: Array<{ userIds: string[] }> | null
) {
  for (const reaction of reactions ?? []) {
    for (const reactionUserId of reaction.userIds) {
      visibleUserIds.add(reactionUserId)
    }
  }
}

function addMentionUserIds(
  visibleUserIds: Set<string>,
  mentionUserIds?: string[] | null
) {
  for (const mentionUserId of mentionUserIds ?? []) {
    visibleUserIds.add(mentionUserId)
  }
}

type SnapshotVisibleUserIdInput = {
  visibleUserIds: Set<string>
  currentUserId: string
  visibleWorkspaces: Array<{ createdBy?: string | null }>
  visibleProjects: Array<{ leadId: string; memberIds: string[] }>
  visibleWorkItems: Array<{
    creatorId: string
    assigneeId?: string | null
    subscriberIds: string[]
  }>
  visibleDocuments: Array<{ createdBy: string; updatedBy: string }>
  visibleViews: Array<{
    scopeType: string
    scopeId: string
    filters: {
      assigneeIds: string[]
      creatorIds: string[]
      leadIds: string[]
    }
  }>
  visibleComments: Array<{
    createdBy: string
    mentionUserIds?: string[] | null
    reactions?: Array<{ userIds: string[] }> | null
  }>
  attachments: Array<{ uploadedBy: string }>
  visibleNotifications: Array<{ userId: string; actorId: string }>
  visibleInvites: Array<{ invitedBy: string }>
  visibleProjectUpdates: Array<{ createdBy: string }>
  visibleConversations: Array<{ createdBy: string; participantIds: string[] }>
  visibleCalls: Array<{
    startedBy: string
    lastJoinedBy?: string | null
    participantUserIds?: string[] | null
  }>
  visibleChatMessages: Array<{
    createdBy: string
    mentionUserIds?: string[] | null
    reactions?: Array<{ userIds: string[] }> | null
  }>
  visibleChannelPosts: Array<{
    createdBy: string
    reactions?: Array<{ userIds: string[] }> | null
  }>
  visibleChannelPostComments: Array<{
    createdBy: string
    mentionUserIds?: string[] | null
  }>
}

function addSnapshotWorkspaceUserIds(input: SnapshotVisibleUserIdInput) {
  for (const workspace of input.visibleWorkspaces) {
    if (workspace.createdBy) {
      input.visibleUserIds.add(workspace.createdBy)
    }
  }
}

function addSnapshotProjectUserIds(input: SnapshotVisibleUserIdInput) {
  for (const project of input.visibleProjects) {
    input.visibleUserIds.add(project.leadId)

    for (const memberId of project.memberIds) {
      input.visibleUserIds.add(memberId)
    }
  }
}

function addSnapshotWorkItemUserIds(input: SnapshotVisibleUserIdInput) {
  for (const workItem of input.visibleWorkItems) {
    input.visibleUserIds.add(workItem.creatorId)

    if (workItem.assigneeId) {
      input.visibleUserIds.add(workItem.assigneeId)
    }

    for (const subscriberId of workItem.subscriberIds) {
      input.visibleUserIds.add(subscriberId)
    }
  }
}

function addSnapshotDocumentUserIds(input: SnapshotVisibleUserIdInput) {
  for (const document of input.visibleDocuments) {
    input.visibleUserIds.add(document.createdBy)
    input.visibleUserIds.add(document.updatedBy)
  }
}

function addSnapshotViewUserIds(input: SnapshotVisibleUserIdInput) {
  for (const view of input.visibleViews) {
    if (view.scopeType === "personal") {
      input.visibleUserIds.add(view.scopeId)
    }

    for (const assigneeId of view.filters.assigneeIds) {
      input.visibleUserIds.add(assigneeId)
    }

    for (const creatorId of view.filters.creatorIds) {
      input.visibleUserIds.add(creatorId)
    }

    for (const leadId of view.filters.leadIds) {
      input.visibleUserIds.add(leadId)
    }
  }
}

function addSnapshotCommentUserIds(input: SnapshotVisibleUserIdInput) {
  for (const comment of input.visibleComments) {
    input.visibleUserIds.add(comment.createdBy)
    addMentionUserIds(input.visibleUserIds, comment.mentionUserIds)
    addReactionUserIds(input.visibleUserIds, comment.reactions)
  }
}

function addSnapshotAttachmentUserIds(input: SnapshotVisibleUserIdInput) {
  for (const attachment of input.attachments) {
    input.visibleUserIds.add(attachment.uploadedBy)
  }
}

function addSnapshotNotificationUserIds(input: SnapshotVisibleUserIdInput) {
  for (const notification of input.visibleNotifications) {
    input.visibleUserIds.add(notification.userId)
    input.visibleUserIds.add(notification.actorId)
  }
}

function addSnapshotInviteUserIds(input: SnapshotVisibleUserIdInput) {
  for (const invite of input.visibleInvites) {
    input.visibleUserIds.add(invite.invitedBy)
  }
}

function addSnapshotProjectUpdateUserIds(input: SnapshotVisibleUserIdInput) {
  for (const update of input.visibleProjectUpdates) {
    input.visibleUserIds.add(update.createdBy)
  }
}

function addSnapshotConversationUserIds(input: SnapshotVisibleUserIdInput) {
  for (const conversation of input.visibleConversations) {
    input.visibleUserIds.add(conversation.createdBy)

    for (const participantId of conversation.participantIds) {
      input.visibleUserIds.add(participantId)
    }
  }
}

function addSnapshotCallUserIds(input: SnapshotVisibleUserIdInput) {
  for (const call of input.visibleCalls) {
    input.visibleUserIds.add(call.startedBy)

    if (call.lastJoinedBy) {
      input.visibleUserIds.add(call.lastJoinedBy)
    }

    for (const participantUserId of call.participantUserIds ?? []) {
      input.visibleUserIds.add(participantUserId)
    }
  }
}

function addSnapshotChatMessageUserIds(input: SnapshotVisibleUserIdInput) {
  for (const message of input.visibleChatMessages) {
    input.visibleUserIds.add(message.createdBy)
    addMentionUserIds(input.visibleUserIds, message.mentionUserIds)
    addReactionUserIds(input.visibleUserIds, message.reactions)
  }
}

function addSnapshotChannelPostUserIds(input: SnapshotVisibleUserIdInput) {
  for (const post of input.visibleChannelPosts) {
    input.visibleUserIds.add(post.createdBy)
    addReactionUserIds(input.visibleUserIds, post.reactions)
  }
}

function addSnapshotChannelPostCommentUserIds(
  input: SnapshotVisibleUserIdInput
) {
  for (const comment of input.visibleChannelPostComments) {
    input.visibleUserIds.add(comment.createdBy)
    addMentionUserIds(input.visibleUserIds, comment.mentionUserIds)
  }
}

function collectSnapshotVisibleUserIds(input: SnapshotVisibleUserIdInput) {
  input.visibleUserIds.add(input.currentUserId)
  addSnapshotWorkspaceUserIds(input)
  addSnapshotProjectUserIds(input)
  addSnapshotWorkItemUserIds(input)
  addSnapshotDocumentUserIds(input)
  addSnapshotViewUserIds(input)
  addSnapshotCommentUserIds(input)
  addSnapshotAttachmentUserIds(input)
  addSnapshotNotificationUserIds(input)
  addSnapshotInviteUserIds(input)
  addSnapshotProjectUpdateUserIds(input)
  addSnapshotConversationUserIds(input)
  addSnapshotCallUserIds(input)
  addSnapshotChatMessageUserIds(input)
  addSnapshotChannelPostUserIds(input)
  addSnapshotChannelPostCommentUserIds(input)
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
  const [accessibleWorkspaceMemberships, accessibleMemberships] =
    await Promise.all([
      listWorkspaceMembershipsByUser(ctx, currentUserId),
      listTeamMembershipsByUser(ctx, currentUserId),
    ])
  const accessibleTeamIdList = [
    ...new Set(accessibleMemberships.map((membership) => membership.teamId)),
  ]
  const accessibleTeamIds = new Set(accessibleTeamIdList)
  const visibleTeams = await listTeamsByIds(ctx, accessibleTeamIdList)
  const ownedWorkspaces = await listWorkspacesOwnedByUser(ctx, currentUserId)
  const accessibleWorkspaceIds = new Set<string>(
    [
      ...accessibleWorkspaceMemberships.map(
        (membership) => membership.workspaceId
      ),
      ...visibleTeams.map((team) => team.workspaceId),
      ...ownedWorkspaces.map((workspace) => workspace.id),
    ].filter(Boolean)
  )
  const accessibleWorkspaceIdList = [...accessibleWorkspaceIds]
  const normalizedVisibleTeams = visibleTeams.map(normalizeTeam)
  const membershipWorkspaceId =
    accessibleWorkspaceMemberships[0]?.workspaceId ??
    visibleTeams[0]?.workspaceId ??
    null
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
  const [visibleWorkspaceMemberships, visibleTeamMemberships] =
    await Promise.all([
      listWorkspaceMembershipsByWorkspaces(ctx, accessibleWorkspaceIdList),
      listTeamMembershipsByTeams(ctx, accessibleTeamIdList),
    ])
  const visibleUserIds = new Set([
    ...visibleWorkspaceMemberships.map((membership) => membership.userId),
    ...visibleTeamMemberships.map((membership) => membership.userId),
  ])

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
    ...(await listWorkspaceDocumentsByWorkspaces(
      ctx,
      accessibleWorkspaceIdList
    )),
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
    ...(currentUserId
      ? await listPersonalViewsByUsers(ctx, [currentUserId])
      : []),
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
    ? (await listNotificationsByUser(ctx, currentUserId)).map(
        (notification) => ({
          ...notification,
          archivedAt: notification.archivedAt ?? null,
        })
      )
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
    ...(
      await listConversationsByScopes(
        ctx,
        accessibleWorkspaceIdList.map((workspaceId) => ({
          scopeType: "workspace" as const,
          scopeId: workspaceId,
        }))
      )
    ).filter(
      (conversation) =>
        conversation.kind === "channel" ||
        conversation.participantIds.includes(currentUserId)
    ),
  ]
  const visibleConversationIds = new Set(
    visibleConversations.map((conversation) => conversation.id)
  )
  const visibleCalls = await listCallsByConversations(
    ctx,
    visibleConversationIds
  )
  const visibleChatMessages = (
    await listChatMessagesByConversations(ctx, visibleConversationIds)
  ).map((message) => ({
    ...message,
    kind: message.kind ?? "text",
    callId: message.callId ?? null,
    mentionUserIds: message.mentionUserIds ?? [],
    reactions: message.reactions ?? [],
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

  collectSnapshotVisibleUserIds({
    visibleUserIds,
    currentUserId,
    visibleWorkspaces,
    visibleProjects,
    visibleWorkItems,
    visibleDocuments,
    visibleViews,
    visibleComments,
    attachments,
    visibleNotifications,
    visibleInvites,
    visibleProjectUpdates,
    visibleConversations,
    visibleCalls,
    visibleChatMessages,
    visibleChannelPosts,
    visibleChannelPostComments,
  })

  return {
    currentUserId,
    currentWorkspaceId,
    workspaces: await Promise.all(
      visibleWorkspaces.map((workspace) =>
        resolveWorkspaceSnapshot(ctx, workspace)
      )
    ),
    workspaceMemberships: visibleWorkspaceMemberships,
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

export async function getWorkspaceMembershipBootstrapHandler(
  ctx: QueryCtx,
  args: GetWorkspaceMembershipBootstrapArgs
) {
  const authenticatedUser = await resolveUserFromServerArgs(ctx, args)

  if (!authenticatedUser) {
    throw new Error("Authenticated user not found")
  }

  return buildWorkspaceMembershipBootstrap(ctx, {
    currentUserId: authenticatedUser.id,
    currentUserEmail: authenticatedUser.email,
    requestedWorkspaceId: args.workspaceId,
  })
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

function getAuthMembershipWorkspaceIds(input: {
  memberships: AuthContextTeamMembershipDoc[]
  teams: AuthContextTeamDoc[]
}) {
  return [
    ...new Set(
      input.memberships
        .map(
          (membership) =>
            input.teams.find((team) => team.id === membership.teamId)
              ?.workspaceId
        )
        .filter(isDefinedString)
    ),
  ]
}

function getAuthAccessibleWorkspaceIds(input: {
  membershipWorkspaceIds: string[]
  ownedWorkspaces: AuthContextWorkspaceDoc[]
  workspaceMemberships: Array<{ workspaceId: string }>
}) {
  return [
    ...new Set([
      ...input.workspaceMemberships.map((membership) => membership.workspaceId),
      ...input.membershipWorkspaceIds,
      ...input.ownedWorkspaces.map((workspace) => workspace.id),
    ]),
  ]
}

async function listPendingAuthWorkspaces(
  ctx: QueryCtx,
  input: {
    accessibleWorkspaceIds: string[]
    ownedWorkspaces: AuthContextWorkspaceDoc[]
  }
) {
  return (
    await Promise.all(
      input.ownedWorkspaces.map(async (workspace) => {
        if (input.accessibleWorkspaceIds.includes(workspace.id)) {
          return null
        }

        const workspaceTeams = await listWorkspaceTeams(ctx, workspace.id)

        if (workspaceTeams.length > 0) {
          return null
        }

        return workspace
      })
    )
  ).filter(
    (workspace): workspace is AuthContextWorkspaceDoc => workspace != null
  )
}

async function loadAuthContextAccess(ctx: QueryCtx, user: AuthContextUserDoc) {
  const userAppState = await getUserAppState(ctx, user.id)
  const [workspaceMemberships, memberships] = await Promise.all([
    listWorkspaceMembershipsByUser(ctx, user.id),
    listTeamMembershipsByUser(ctx, user.id),
  ])
  const [teams, ownedWorkspaces, workspaceRoleMap, pendingInvites] =
    await Promise.all([
      listTeamsByIds(
        ctx,
        memberships.map((membership) => membership.teamId)
      ),
      listWorkspacesOwnedByUser(ctx, user.id),
      getWorkspaceRoleMapForUser(ctx, user.id),
      getPendingInvitesForEmail(ctx, user.email),
    ])
  const membershipWorkspaceIds = getAuthMembershipWorkspaceIds({
    memberships,
    teams,
  })
  const accessibleWorkspaceIds = getAuthAccessibleWorkspaceIds({
    membershipWorkspaceIds,
    ownedWorkspaces,
    workspaceMemberships,
  })

  return {
    accessibleWorkspaceIds,
    membershipWorkspaceIds,
    memberships,
    ownedWorkspaces,
    pendingInvites,
    userAppState,
    workspaceRoleMap,
  }
}

function toAuthWorkspacePayload(workspace: AuthContextWorkspaceDoc) {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    logoUrl: workspace.logoUrl,
    workosOrganizationId: workspace.workosOrganizationId ?? null,
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

  const {
    accessibleWorkspaceIds,
    membershipWorkspaceIds,
    memberships,
    ownedWorkspaces,
    pendingInvites,
    userAppState,
    workspaceRoleMap,
  } = await loadAuthContextAccess(ctx, user)
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
  const pendingWorkspaceCandidates = await listPendingAuthWorkspaces(ctx, {
    accessibleWorkspaceIds,
    ownedWorkspaces,
  })
  const pendingWorkspace =
    pendingWorkspaceCandidates.find(
      (workspace) => workspace.id === userAppState?.currentWorkspaceId
    ) ??
    pendingWorkspaceCandidates[0] ??
    null
  const activeWorkspace = currentWorkspace ?? pendingWorkspace
  const onboardingState = activeWorkspace ? "ready" : "needs-workspace"
  const resolvedCurrentUser = await resolveUserSnapshot(ctx, user)

  return {
    currentUser: {
      id: resolvedCurrentUser.id,
      email: resolvedCurrentUser.email,
      name: resolvedCurrentUser.name,
      workosUserId: resolvedCurrentUser.workosUserId ?? null,
      avatarUrl: resolvedCurrentUser.avatarUrl,
      avatarImageUrl: resolvedCurrentUser.avatarImageUrl,
    },
    memberships: memberships.map((membership) => ({
      teamId: membership.teamId,
      role: membership.role,
    })),
    currentWorkspace: activeWorkspace
      ? toAuthWorkspacePayload(activeWorkspace)
      : null,
    pendingWorkspace: pendingWorkspace
      ? toAuthWorkspacePayload(pendingWorkspace)
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
    const resetPresence = !(await hasAnyWorkspaceAccess(ctx, existing.id))

    await ctx.db.patch(existing._id, {
      name: args.name,
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      workosUserId: args.workosUserId,
      handle: createHandle(normalizedEmail),
      ...resolveUserPresencePatch(existing, resetPresence),
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

async function resolveBootstrapWorkspaceUserScope(
  ctx: MutationCtx,
  args: BootstrapWorkspaceUserArgs
): Promise<{
  team: BootstrapWorkspaceTeamDoc
  workspace: BootstrapWorkspaceDoc
}> {
  const workspace = await getWorkspaceBySlug(ctx, args.workspaceSlug)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const team = await getTeamByWorkspaceAndSlug(ctx, workspace.id, args.teamSlug)

  if (!team) {
    throw new Error("Team not found")
  }

  return {
    team,
    workspace,
  }
}

async function resolveBootstrapWorkspaceUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapWorkspaceUserArgs
    normalizedEmail: string
  }
) {
  const existingByWorkOSUserId = await getUserByWorkOSUserId(
    ctx,
    input.args.workosUserId
  )
  const workosLifecycleError = getAuthLifecycleError(existingByWorkOSUserId)

  if (workosLifecycleError) {
    throw new Error(workosLifecycleError)
  }

  const existingByEmail = await getUserByEmail(ctx, input.normalizedEmail)
  const preferredUser = input.args.existingUserId
    ? await getUserDoc(ctx, input.args.existingUserId)
    : null
  const preferredLifecycleError = getAuthLifecycleError(preferredUser)

  if (preferredLifecycleError) {
    throw new Error(preferredLifecycleError)
  }

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

  return preferredUser ?? existingByWorkOSUserId ?? existingByEmail ?? null
}

async function patchBootstrapWorkspaceUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapWorkspaceUserArgs
    normalizedEmail: string
    user: BootstrapWorkspaceUserDoc
  }
) {
  const resetPresence = !(await hasAnyWorkspaceAccess(ctx, input.user.id))

  await ctx.db.patch(input.user._id, {
    email: input.normalizedEmail,
    emailNormalized: input.normalizedEmail,
    name: input.args.name,
    workosUserId: input.args.workosUserId,
    ...resolveUserPresencePatch(input.user, resetPresence),
    preferences: {
      ...defaultUserPreferences,
      ...input.user.preferences,
    },
  })
}

async function insertBootstrapWorkspaceUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapWorkspaceUserArgs
    normalizedEmail: string
    userId: string
  }
) {
  await ctx.db.insert("users", {
    id: input.userId,
    email: input.normalizedEmail,
    emailNormalized: input.normalizedEmail,
    name: input.args.name,
    avatarUrl: input.args.avatarUrl,
    workosUserId: input.args.workosUserId,
    handle: createHandle(input.normalizedEmail),
    title: "Founder / Product",
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    hasExplicitStatus: false,
    preferences: defaultUserPreferences,
  })
}

async function upsertBootstrapWorkspaceUser(
  ctx: MutationCtx,
  input: {
    args: BootstrapWorkspaceUserArgs
    normalizedEmail: string
    resolvedUser: BootstrapWorkspaceUserDoc | null
  }
) {
  const userId = input.resolvedUser?.id ?? createId("user")

  if (input.resolvedUser) {
    await patchBootstrapWorkspaceUser(ctx, {
      args: input.args,
      normalizedEmail: input.normalizedEmail,
      user: input.resolvedUser,
    })
    return userId
  }

  await insertBootstrapWorkspaceUser(ctx, {
    args: input.args,
    normalizedEmail: input.normalizedEmail,
    userId,
  })

  return userId
}

async function finalizeBootstrapWorkspaceUserAccess(
  ctx: MutationCtx,
  input: {
    role: Role
    teamId: string
    userId: string
    workspaceId: string
  }
) {
  await upsertBootstrapTeamMembership(ctx, {
    role: input.role,
    teamId: input.teamId,
    userId: input.userId,
  })

  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    fallbackRole: input.role,
  })
  await syncTeamConversationMemberships(ctx, input.teamId)
  await setCurrentWorkspaceForUser(ctx, input.userId, input.workspaceId)
}

export async function bootstrapWorkspaceUserHandler(
  ctx: MutationCtx,
  args: BootstrapWorkspaceUserArgs
) {
  assertServerToken(args.serverToken)
  const normalizedEmail = normalizeEmailAddress(args.email)
  const { team, workspace } = await resolveBootstrapWorkspaceUserScope(
    ctx,
    args
  )
  const role = args.role ?? "admin"
  const resolvedUser = await resolveBootstrapWorkspaceUser(ctx, {
    args,
    normalizedEmail,
  })
  const userId = await upsertBootstrapWorkspaceUser(ctx, {
    args,
    normalizedEmail,
    resolvedUser,
  })

  await finalizeBootstrapWorkspaceUserAccess(ctx, {
    role,
    teamId: team.id,
    userId,
    workspaceId: workspace.id,
  })

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
  const invites = await listInvitesByToken(ctx, args.token)
  const invite =
    invites.find((entry) => !entry.declinedAt && !entry.acceptedAt) ??
    invites[0] ??
    null

  if (!invite) {
    return null
  }

  const scopedInvites = invite.batchId
    ? invites.filter(
        (entry) =>
          entry.batchId === invite.batchId &&
          entry.workspaceId === invite.workspaceId
      )
    : invites.filter((entry) => entry.id === invite.id)

  const teams = await Promise.all(
    scopedInvites.map((entry) => getTeamDoc(ctx, entry.teamId))
  )
  const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)
  const teamNames = [
    ...new Set(teams.flatMap((team) => (team ? [team.name] : []))),
  ].sort((left, right) => left.localeCompare(right))

  if (!workspace) {
    return null
  }

  if (!invite.acceptedAt && !invite.declinedAt && teamNames.length === 0) {
    return null
  }

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
    teamNames,
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      logoUrl: workspace.logoUrl,
    },
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
