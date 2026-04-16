import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  createDefaultTeamWorkflowSettings,
  getTeamFeatureValidationMessage,
  type Role,
  type TeamExperienceType,
  type TeamFeatureSettings,
  type TeamWorkflowSettings,
  type ThemePreference,
  type UserStatus,
} from "../../lib/domain/types"
import {
  requireReadableWorkspaceAccess,
  requireTeamAdminAccess,
  requireWorkspaceAdminAccess,
  requireWorkspaceOwnerAccess,
} from "./access"
import { assertImageUpload } from "./assets"
import {
  cascadeDeleteTeamData,
  cleanupUserAccessRemoval,
  cleanupRemainingLinksAfterDelete,
  cleanupUnusedLabels,
  cleanupUserAppStatesForDeletedWorkspace,
  cleanupViewFiltersForDeletedEntities,
  deleteDocs,
  deleteStorageObjects,
} from "./cleanup"
import {
  assertServerToken,
  createId,
  createUniqueTeamSlug,
  createUniqueWorkspaceSlug,
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
  ensureJoinCodeAvailable,
  getDefaultLabelColor,
  normalizeJoinCode,
  normalizeTeamIcon,
} from "./core"
import {
  type AppCtx,
  getUserAppState,
  getTeamMembershipDoc,
  getTeamDoc,
  getUserDoc,
  getWorkspaceDoc,
  listWorkspaceTeams,
  setCurrentWorkspaceForUser,
} from "./data"
import {
  ensureTeamChannelConversation,
  ensureTeamChatConversation,
  syncTeamConversationMemberships,
} from "./conversations"
import { createNotification } from "./collaboration_utils"
import { getTeamSurfaceDisableMessage } from "./team_feature_guards"
import { ensureTeamWorkViews } from "./work_helpers"
import {
  normalizeTeamFeatures,
  normalizeTeamWorkflowSettings,
  resolveUserStatus,
} from "./normalization"

type ServerAccessArgs = {
  serverToken: string
}

type WorkspaceBrandingArgs = ServerAccessArgs & {
  currentUserId: string
  workspaceId: string
  name: string
  logoUrl: string
  logoImageStorageId?: string
  clearLogoImage?: boolean
  accent: string
  description: string
}

type UserPreferences = {
  emailMentions: boolean
  emailAssignments: boolean
  emailDigest: boolean
  theme?: ThemePreference
}

type UpdateCurrentUserProfileArgs = ServerAccessArgs & {
  currentUserId: string
  userId: string
  name: string
  title: string
  avatarUrl: string
  avatarImageStorageId?: string
  clearAvatarImage?: boolean
  clearStatus?: boolean
  status?: UserStatus
  statusMessage?: string
  preferences: UserPreferences
}

type CreateTeamArgs = ServerAccessArgs & {
  currentUserId: string
  workspaceId: string
  name: string
  icon: string
  summary: string
  joinCode: string
  experience: TeamExperienceType
  features: TeamFeatureSettings
}

type UpdateTeamDetailsArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
  name: string
  icon: string
  summary: string
  joinCode?: string
  experience: TeamExperienceType
  features: TeamFeatureSettings
}

type UpdateTeamWorkflowSettingsArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
  workflow: TeamWorkflowSettings
}

type UpdateTeamMemberRoleArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
  userId: string
  role: Role
}

type RemoveTeamMemberArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
  userId: string
}

type RemoveWorkspaceUserArgs = ServerAccessArgs & {
  currentUserId: string
  workspaceId: string
  userId: string
}

type LeaveWorkspaceArgs = ServerAccessArgs & {
  currentUserId: string
  workspaceId: string
}

type DeleteCurrentAccountArgs = ServerAccessArgs & {
  currentUserId: string
}

type AccessEmailJob = {
  email: string
  subject: string
  eyebrow: string
  headline: string
  body: string
}

function buildDeletedUserEmail(userId: string) {
  return `deleted+${userId.toLowerCase()}@linear.invalid`
}

function buildDeletedUserHandle(userId: string) {
  return `deleted-${userId.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(-12)}`
}

async function listTeamAdminUsers(
  ctx: MutationCtx,
  teamId: string,
  excludeUserIds: Iterable<string> = []
) {
  const excludedUserIds = new Set(excludeUserIds)
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()

  const adminUsers = await Promise.all(
    memberships
      .filter(
        (membership) =>
          membership.role === "admin" && !excludedUserIds.has(membership.userId)
      )
      .map(async (membership) => getUserDoc(ctx, membership.userId))
  )

  return adminUsers.filter((user) => user != null)
}

async function getTeamAdminCount(ctx: MutationCtx, teamId: string) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()

  return memberships.filter((membership) => membership.role === "admin").length
}

async function notifyWorkspaceOwnerOfAccessChange(
  ctx: MutationCtx,
  input: {
    workspaceId: string
    actorUserId: string
    message: string
    subject: string
    eyebrow: string
    headline: string
    excludeUserIds?: Iterable<string>
  }
) {
  const workspace = await getWorkspaceDoc(ctx, input.workspaceId)

  if (!workspace?.createdBy) {
    return []
  }

  const excludedUserIds = new Set(input.excludeUserIds ?? [])

  if (excludedUserIds.has(workspace.createdBy)) {
    return []
  }

  const owner = await getUserDoc(ctx, workspace.createdBy)

  if (!owner) {
    return []
  }

  await ctx.db.insert(
    "notifications",
    createNotification(
      owner.id,
      input.actorUserId,
      input.message,
      "workspace",
      workspace.id,
      "status-change"
    )
  )

  return owner.email
    ? [
        {
          email: owner.email,
          subject: input.subject,
          eyebrow: input.eyebrow,
          headline: input.headline,
          body: input.message,
        },
      ]
    : []
}

async function notifyTeamAdminsOfAccessChange(
  ctx: MutationCtx,
  input: {
    teamId: string
    actorUserId: string
    message: string
    subject: string
    eyebrow: string
    headline: string
    excludeUserIds?: Iterable<string>
  }
) {
  const team = await getTeamDoc(ctx, input.teamId)

  if (!team) {
    return []
  }

  const admins = await listTeamAdminUsers(
    ctx,
    team.id,
    input.excludeUserIds ?? []
  )
  const emailJobs: AccessEmailJob[] = []

  for (const admin of admins) {
    await ctx.db.insert(
      "notifications",
      createNotification(
        admin.id,
        input.actorUserId,
        input.message,
        "team",
        team.id,
        "status-change"
      )
    )

    if (!admin.email) {
      continue
    }

    emailJobs.push({
      email: admin.email,
      subject: input.subject,
      eyebrow: input.eyebrow,
      headline: input.headline,
      body: input.message,
    })
  }

  return emailJobs
}

async function requireMutableTeamMember(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    teamId: string
    userId: string
  }
) {
  const team = await getTeamDoc(ctx, input.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireTeamAdminAccess(
    ctx,
    input.teamId,
    input.currentUserId,
    "Only team admins can manage team members"
  )

  if (input.userId === input.currentUserId) {
    throw new Error("You can't change your own team access here")
  }

  const membership = await getTeamMembershipDoc(ctx, input.teamId, input.userId)

  if (!membership) {
    throw new Error("Team member not found")
  }

  return {
    team,
    membership,
  }
}

type LeaveTeamArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
}

export async function createWorkspaceHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    name: string
    logoUrl: string
    accent: string
    description: string
  }
) {
  assertServerToken(args.serverToken)
  const workspaces = await ctx.db.query("workspaces").collect()
  const workspaceId = createId("workspace")
  const workspaceSlug = createUniqueWorkspaceSlug(workspaces, args.name)

  await ctx.db.insert("workspaces", {
    id: workspaceId,
    slug: workspaceSlug,
    name: args.name,
    logoUrl: args.logoUrl,
    createdBy: args.currentUserId,
    workosOrganizationId: null,
    settings: {
      accent: args.accent,
      description: args.description,
    },
  })

  await setCurrentWorkspaceForUser(ctx, args.currentUserId, workspaceId)

  return {
    workspaceId,
    workspaceSlug,
  }
}

export async function updateWorkspaceBrandingHandler(
  ctx: MutationCtx,
  args: WorkspaceBrandingArgs
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    return
  }

  await requireWorkspaceOwnerAccess(
    ctx,
    args.workspaceId,
    args.currentUserId,
    "Only the workspace owner can update workspace details"
  )

  let nextLogoImageStorageId = workspace.logoImageStorageId ?? null

  if (args.clearLogoImage) {
    nextLogoImageStorageId = null
  } else if (args.logoImageStorageId) {
    nextLogoImageStorageId = await assertImageUpload(
      ctx,
      args.logoImageStorageId
    )
  }

  if (
    workspace.logoImageStorageId &&
    workspace.logoImageStorageId !== nextLogoImageStorageId
  ) {
    await ctx.storage.delete(workspace.logoImageStorageId as never)
  }

  await ctx.db.patch(workspace._id, {
    name: args.name,
    logoUrl: args.logoUrl,
    logoImageStorageId: nextLogoImageStorageId,
    settings: {
      ...workspace.settings,
      accent: args.accent,
      description: args.description,
    },
  })
}

export async function deleteWorkspaceHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    workspaceId: string
  }
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  await requireWorkspaceOwnerAccess(
    ctx,
    args.workspaceId,
    args.currentUserId,
    "Only the workspace owner can delete the workspace"
  )

  const workspaceTeams = (await ctx.db.query("teams").collect()).filter(
    (team) => team.workspaceId === workspace.id
  )

  for (const team of workspaceTeams) {
    await cascadeDeleteTeamData(ctx, {
      currentUserId: args.currentUserId,
      teamId: team.id,
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })
  }

  const projects = (await ctx.db.query("projects").collect()).filter(
    (project) =>
      project.scopeType === "workspace" && project.scopeId === workspace.id
  )
  const deletedProjectIds = new Set(projects.map((project) => project.id))
  const milestones = (await ctx.db.query("milestones").collect()).filter(
    (milestone) => deletedProjectIds.has(milestone.projectId)
  )
  const deletedMilestoneIds = new Set(
    milestones.map((milestone) => milestone.id)
  )
  const projectUpdates = (
    await ctx.db.query("projectUpdates").collect()
  ).filter((update) => deletedProjectIds.has(update.projectId))
  const documents = (await ctx.db.query("documents").collect()).filter(
    (document) => document.workspaceId === workspace.id
  )
  const deletedDocumentIds = new Set(documents.map((document) => document.id))
  const views = (await ctx.db.query("views").collect()).filter(
    (view) => view.scopeType === "workspace" && view.scopeId === workspace.id
  )
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_scope", (q) =>
      q.eq("scopeType", "workspace").eq("scopeId", workspace.id)
    )
    .collect()
  const deletedConversationIds = new Set(
    conversations.map((conversation) => conversation.id)
  )
  const calls = (await ctx.db.query("calls").collect()).filter((call) =>
    deletedConversationIds.has(call.conversationId)
  )
  const chatMessages = (await ctx.db.query("chatMessages").collect()).filter(
    (message) => deletedConversationIds.has(message.conversationId)
  )
  const deletedChatMessageIds = new Set(
    chatMessages.map((message) => message.id)
  )
  const channelPosts = (await ctx.db.query("channelPosts").collect()).filter(
    (post) => deletedConversationIds.has(post.conversationId)
  )
  const deletedChannelPostIds = new Set(channelPosts.map((post) => post.id))
  const channelPostComments = (
    await ctx.db.query("channelPostComments").collect()
  ).filter((comment) => deletedChannelPostIds.has(comment.postId))
  const attachments = (await ctx.db.query("attachments").collect()).filter(
    (attachment) =>
      attachment.targetType === "document" &&
      deletedDocumentIds.has(attachment.targetId)
  )
  const comments = (await ctx.db.query("comments").collect()).filter(
    (comment) =>
      comment.targetType === "document" &&
      deletedDocumentIds.has(comment.targetId)
  )
  const invites = (await ctx.db.query("invites").collect()).filter(
    (invite) => invite.workspaceId === workspace.id
  )
  const deletedInviteIds = new Set(invites.map((invite) => invite.id))
  const notifications = (await ctx.db.query("notifications").collect()).filter(
    (notification) => {
      switch (notification.entityType) {
        case "document":
          return deletedDocumentIds.has(notification.entityId)
        case "project":
          return deletedProjectIds.has(notification.entityId)
        case "invite":
          return deletedInviteIds.has(notification.entityId)
        case "chat":
          return deletedChatMessageIds.has(notification.entityId)
        case "channelPost":
          return deletedChannelPostIds.has(notification.entityId)
        default:
          return false
      }
    }
  )

  await cleanupRemainingLinksAfterDelete(ctx, {
    currentUserId: args.currentUserId,
    deletedDocumentIds,
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await cleanupViewFiltersForDeletedEntities(ctx, {
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await deleteStorageObjects(ctx, [
    ...attachments.map((attachment) => attachment.storageId as string),
    ...(workspace.logoImageStorageId
      ? [workspace.logoImageStorageId as string]
      : []),
  ])
  await deleteDocs(ctx, channelPostComments)
  await deleteDocs(ctx, channelPosts)
  await deleteDocs(ctx, chatMessages)
  await deleteDocs(ctx, calls)
  await deleteDocs(ctx, comments)
  await deleteDocs(ctx, attachments)
  await deleteDocs(ctx, notifications)
  await deleteDocs(ctx, projectUpdates)
  await deleteDocs(ctx, invites)
  await deleteDocs(ctx, views)
  await deleteDocs(ctx, documents)
  await deleteDocs(ctx, milestones)
  await deleteDocs(ctx, projects)
  await deleteDocs(ctx, conversations)
  await ctx.db.delete(workspace._id)

  await cleanupUserAppStatesForDeletedWorkspace(ctx, workspace.id)

  const deletedLabelIds = await cleanupUnusedLabels(ctx)

  return {
    workspaceId: workspace.id,
    deletedTeamIds: workspaceTeams.map((team) => team.id),
    deletedLabelIds,
    deletedUserIds: [],
  }
}

export async function setWorkspaceWorkosOrganizationHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    workspaceId: string
    workosOrganizationId: string
  }
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    return null
  }

  await ctx.db.patch(workspace._id, {
    workosOrganizationId: args.workosOrganizationId,
  })

  return {
    workspaceId: workspace.id,
    workosOrganizationId: args.workosOrganizationId,
  }
}

export async function updateCurrentUserProfileHandler(
  ctx: MutationCtx,
  args: UpdateCurrentUserProfileArgs
) {
  assertServerToken(args.serverToken)

  if (args.currentUserId !== args.userId) {
    throw new Error("You can only update your own profile")
  }

  const user = await getUserDoc(ctx, args.userId)

  if (!user) {
    return
  }

  let nextAvatarImageStorageId = user.avatarImageStorageId ?? null

  if (args.clearAvatarImage) {
    nextAvatarImageStorageId = null
  } else if (args.avatarImageStorageId) {
    nextAvatarImageStorageId = await assertImageUpload(
      ctx,
      args.avatarImageStorageId
    )
  }

  if (
    user.avatarImageStorageId &&
    user.avatarImageStorageId !== nextAvatarImageStorageId
  ) {
    await ctx.storage.delete(user.avatarImageStorageId as never)
  }

  await ctx.db.patch(user._id, {
    name: args.name,
    title: args.title,
    avatarUrl: args.avatarUrl,
    avatarImageStorageId: nextAvatarImageStorageId,
    status: args.clearStatus
      ? defaultUserStatus
      : (args.status ?? resolveUserStatus(user.status)),
    statusMessage: args.clearStatus
      ? defaultUserStatusMessage
      : (args.statusMessage ?? user.statusMessage ?? defaultUserStatusMessage),
    hasExplicitStatus: args.clearStatus
      ? false
      : args.status !== undefined
        ? true
        : (user.hasExplicitStatus ?? false),
    preferences: {
      ...defaultUserPreferences,
      ...args.preferences,
    },
  })
}

export async function ensureWorkspaceScaffoldingHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    workspaceId: string
  }
) {
  assertServerToken(args.serverToken)
  await requireReadableWorkspaceAccess(
    ctx,
    args.workspaceId,
    args.currentUserId
  )

  const teams = (await ctx.db.query("teams").collect()).filter(
    (team) => team.workspaceId === args.workspaceId
  )

  for (const team of teams) {
    await ensureTeamWorkViews(ctx, team)
  }

  return {
    workspaceId: args.workspaceId,
    ensuredTeamCount: teams.length,
  }
}

export async function createTeamHandler(
  ctx: MutationCtx,
  args: CreateTeamArgs
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const teams = await ctx.db.query("teams").collect()
  const workspaceTeams = teams.filter(
    (team) => team.workspaceId === args.workspaceId
  )
  const canCreateFirstTeam =
    workspace.createdBy === args.currentUserId && workspaceTeams.length === 0

  if (!canCreateFirstTeam) {
    await requireWorkspaceAdminAccess(ctx, args.workspaceId, args.currentUserId)
  }

  const validationMessage = getTeamFeatureValidationMessage(
    args.experience,
    args.features
  )

  if (validationMessage) {
    throw new Error(validationMessage)
  }

  const normalizedFeatures = normalizeTeamFeatures(
    args.experience,
    args.features
  )
  const normalizedJoinCode = normalizeJoinCode(args.joinCode)
  const normalizedIcon = normalizeTeamIcon(args.icon, args.experience)

  ensureJoinCodeAvailable(teams, normalizedJoinCode)

  const teamSlug = createUniqueTeamSlug(teams, args.name, normalizedJoinCode)
  const teamId = createId("team")

  await ctx.db.insert("teams", {
    id: teamId,
    workspaceId: workspace.id,
    slug: teamSlug,
    name: args.name,
    icon: normalizedIcon,
    settings: {
      joinCode: normalizedJoinCode,
      summary: args.summary,
      guestProjectIds: [],
      guestDocumentIds: [],
      guestWorkItemIds: [],
      experience: args.experience,
      features: normalizedFeatures,
      workflow: createDefaultTeamWorkflowSettings(args.experience),
    },
  })

  await ctx.db.insert("teamMemberships", {
    teamId,
    userId: args.currentUserId,
    role: "admin",
  })

  if (normalizedFeatures.chat) {
    await ensureTeamChatConversation(ctx, {
      teamId,
      currentUserId: args.currentUserId,
      teamName: args.name,
      teamSummary: args.summary,
    })
  }

  if (normalizedFeatures.channels) {
    await ensureTeamChannelConversation(ctx, {
      teamId,
      currentUserId: args.currentUserId,
      teamName: args.name,
      teamSummary: args.summary,
    })
  }

  await ensureTeamWorkViews(ctx, await getTeamDoc(ctx, teamId))

  return {
    teamId,
    teamSlug,
    joinCode: normalizedJoinCode,
    features: normalizedFeatures,
  }
}

export async function deleteTeamHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    teamId: string
  }
) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireTeamAdminAccess(
    ctx,
    args.teamId,
    args.currentUserId,
    "Only team admins can delete the team"
  )

  return cascadeDeleteTeamData(ctx, {
    currentUserId: args.currentUserId,
    teamId: team.id,
  })
}

export async function leaveTeamHandler(ctx: MutationCtx, args: LeaveTeamArgs) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const membership = await getTeamMembershipDoc(
    ctx,
    args.teamId,
    args.currentUserId
  )

  if (!membership) {
    throw new Error("You are not a member of this team")
  }

  if (membership.role === "admin") {
    throw new Error("Team admins can't leave the team")
  }

  const currentUser = await getUserDoc(ctx, args.currentUserId)

  await ctx.db.delete(membership._id)
  await cleanupUserAccessRemoval(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: args.currentUserId,
    workspaceId: team.workspaceId,
    removedTeamIds: [team.id],
  })
  await syncTeamConversationMemberships(ctx, team.id)

  const userName = currentUser?.name ?? "A user"
  const inboxMessage = `${userName} left ${team.name}.`
  const emailJobs = await notifyTeamAdminsOfAccessChange(ctx, {
    teamId: team.id,
    actorUserId: args.currentUserId,
    message: inboxMessage,
    subject: `${userName} left ${team.name}`,
    eyebrow: "TEAM MEMBER LEFT",
    headline: `${userName} left ${team.name}`,
    excludeUserIds: [args.currentUserId],
  })

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    emailJobs,
  }
}

export async function createLabelHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    name: string
    color?: string
  }
) {
  assertServerToken(args.serverToken)

  const user = await getUserDoc(ctx, args.currentUserId)

  if (!user) {
    throw new Error("User not found")
  }

  const normalizedName = args.name.trim()

  if (normalizedName.length === 0) {
    throw new Error("Label name is required")
  }

  const existingLabels = await ctx.db.query("labels").collect()
  const existingLabel =
    existingLabels.find(
      (label) => label.name.toLowerCase() === normalizedName.toLowerCase()
    ) ?? null

  if (existingLabel) {
    return existingLabel
  }

  const label = {
    id: createId("label"),
    name: normalizedName,
    color: args.color?.trim() || getDefaultLabelColor(normalizedName),
  }

  await ctx.db.insert("labels", label)

  return label
}

export async function updateTeamDetailsHandler(
  ctx: MutationCtx,
  args: UpdateTeamDetailsArgs
) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireTeamAdminAccess(
    ctx,
    args.teamId,
    args.currentUserId,
    "Only team admins can update team details"
  )

  const validationMessage = getTeamFeatureValidationMessage(
    args.experience,
    args.features
  )

  if (validationMessage) {
    throw new Error(validationMessage)
  }

  const normalizedFeatures = normalizeTeamFeatures(
    args.experience,
    args.features
  )
  const normalizedIcon = normalizeTeamIcon(args.icon, args.experience)
  const normalizedWorkflow = normalizeTeamWorkflowSettings(
    team.settings.workflow,
    args.experience
  )
  const normalizedJoinCode = args.joinCode
    ? normalizeJoinCode(args.joinCode)
    : team.settings.joinCode

  if (args.joinCode) {
    const teams = await ctx.db.query("teams").collect()
    ensureJoinCodeAvailable(teams, normalizedJoinCode, team.id)
  }

  const disableMessage = await getTeamSurfaceDisableMessage(
    ctx,
    team,
    normalizedFeatures
  )

  if (disableMessage) {
    throw new Error(disableMessage)
  }

  await ctx.db.patch(team._id, {
    name: args.name,
    icon: normalizedIcon,
    settings: {
      ...team.settings,
      summary: args.summary,
      joinCode: normalizedJoinCode,
      experience: args.experience,
      features: normalizedFeatures,
      workflow: normalizedWorkflow,
    },
  })

  if (normalizedFeatures.chat) {
    await ensureTeamChatConversation(ctx, {
      teamId: team.id,
      currentUserId: args.currentUserId,
      teamName: args.name,
      teamSummary: args.summary,
    })
  }

  if (normalizedFeatures.channels) {
    await ensureTeamChannelConversation(ctx, {
      teamId: team.id,
      currentUserId: args.currentUserId,
      teamName: args.name,
      teamSummary: args.summary,
    })
  }

  await ensureTeamWorkViews(ctx, await getTeamDoc(ctx, team.id))

  return {
    teamId: team.id,
    joinCode: normalizedJoinCode,
    experience: args.experience,
    features: normalizedFeatures,
  }
}

export async function regenerateTeamJoinCodeHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    teamId: string
    joinCode: string
  }
) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireTeamAdminAccess(
    ctx,
    args.teamId,
    args.currentUserId,
    "Only team admins can regenerate join codes"
  )

  const normalizedJoinCode = normalizeJoinCode(args.joinCode)
  const teams = await ctx.db.query("teams").collect()

  ensureJoinCodeAvailable(teams, normalizedJoinCode, team.id)

  await ctx.db.patch(team._id, {
    settings: {
      ...team.settings,
      joinCode: normalizedJoinCode,
    },
  })

  return {
    teamId: team.id,
    joinCode: normalizedJoinCode,
  }
}

export async function updateTeamWorkflowSettingsHandler(
  ctx: MutationCtx,
  args: UpdateTeamWorkflowSettingsArgs
) {
  assertServerToken(args.serverToken)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  await requireTeamAdminAccess(
    ctx,
    args.teamId,
    args.currentUserId,
    "Only team admins can update workflow settings"
  )

  await ctx.db.patch(team._id, {
    settings: {
      ...team.settings,
      workflow: args.workflow,
    },
  })

  return {
    teamId: team.id,
    workflow: args.workflow,
  }
}

export async function updateTeamMemberRoleHandler(
  ctx: MutationCtx,
  args: UpdateTeamMemberRoleArgs
) {
  assertServerToken(args.serverToken)
  const { team, membership } = await requireMutableTeamMember(ctx, args)

  if (membership.role === args.role) {
    return {
      teamId: team.id,
      userId: membership.userId,
      role: membership.role,
    }
  }

  if (membership.role === "admin" && args.role !== "admin") {
    const adminCount = await getTeamAdminCount(ctx, team.id)

    if (adminCount <= 1) {
      throw new Error("Teams must keep at least one admin")
    }
  }

  await ctx.db.patch(membership._id, {
    role: args.role,
  })

  await syncTeamConversationMemberships(ctx, team.id)

  return {
    teamId: team.id,
    userId: membership.userId,
    role: args.role,
  }
}

export async function removeTeamMemberHandler(
  ctx: MutationCtx,
  args: RemoveTeamMemberArgs
) {
  assertServerToken(args.serverToken)
  const { team, membership } = await requireMutableTeamMember(ctx, args)

  if (membership.role === "admin") {
    const adminCount = await getTeamAdminCount(ctx, team.id)

    if (adminCount <= 1) {
      throw new Error("Teams must keep at least one admin")
    }
  }

  const removedUser = await getUserDoc(ctx, membership.userId)
  const workspace = await getWorkspaceDoc(ctx, team.workspaceId)
  const actor = await getUserDoc(ctx, args.currentUserId)

  await ctx.db.delete(membership._id)
  await cleanupUserAccessRemoval(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: membership.userId,
    workspaceId: team.workspaceId,
    removedTeamIds: [team.id],
  })
  await syncTeamConversationMemberships(ctx, team.id)

  const actorName = actor?.name ?? "A team admin"
  const removedUserName = removedUser?.name ?? "User"
  const workspaceName = workspace?.name ?? "Workspace"
  const removalMessage = `${actorName} removed you from ${team.name}.`
  const adminMessage = `${actorName} removed ${removedUserName} from ${team.name}.`
  const adminEmailJobs = await notifyTeamAdminsOfAccessChange(ctx, {
    teamId: team.id,
    actorUserId: args.currentUserId,
    message: adminMessage,
    subject: `${actorName} removed ${removedUserName} from ${team.name}`,
    eyebrow: "TEAM MEMBER REMOVED",
    headline: `${removedUserName} was removed from ${team.name}`,
    excludeUserIds: [args.currentUserId, membership.userId],
  })

  if (removedUser) {
    const notification = createNotification(
      removedUser.id,
      args.currentUserId,
      removalMessage,
      "team",
      team.id,
      "status-change"
    )

    await ctx.db.insert("notifications", notification)
  }

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    userId: membership.userId,
    removedUserEmail: removedUser?.email ?? "",
    removedUserName,
    teamName: team.name,
    workspaceName,
    actorName,
    emailJobs: [
      ...adminEmailJobs,
      ...(removedUser?.email
        ? [
            {
              email: removedUser.email,
              subject: `You were removed from ${team.name}`,
              eyebrow: "TEAM ACCESS REMOVED",
              headline: `You were removed from ${team.name}`,
              body: removalMessage,
            },
          ]
        : []),
    ],
  }
}

export async function removeWorkspaceUserHandler(
  ctx: MutationCtx,
  args: RemoveWorkspaceUserArgs
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  await requireWorkspaceOwnerAccess(
    ctx,
    args.workspaceId,
    args.currentUserId,
    "Only the workspace owner can remove workspace users"
  )

  if (workspace.createdBy === args.userId) {
    throw new Error("You can't remove the workspace owner")
  }

  if (args.userId === args.currentUserId) {
    throw new Error("You can't remove yourself from the workspace here")
  }

  const workspaceTeams = await listWorkspaceTeams(ctx, args.workspaceId)
  const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id))
  const memberships = (
    await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
  ).filter((membership) => workspaceTeamIds.has(membership.teamId))

  if (memberships.length === 0) {
    throw new Error("Workspace user not found")
  }

  if (memberships.some((membership) => membership.role === "admin")) {
    throw new Error("Workspace admins can't be removed from the workspace")
  }

  const removedUser = await getUserDoc(ctx, args.userId)
  const actor = await getUserDoc(ctx, args.currentUserId)
  const teamNames = workspaceTeams
    .filter((team) =>
      memberships.some((membership) => membership.teamId === team.id)
    )
    .map((team) => team.name)

  for (const membership of memberships) {
    await ctx.db.delete(membership._id)
  }

  await cleanupUserAccessRemoval(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: args.userId,
    workspaceId: workspace.id,
    removedTeamIds: memberships.map((membership) => membership.teamId),
  })

  for (const team of workspaceTeams) {
    if (memberships.some((membership) => membership.teamId === team.id)) {
      await syncTeamConversationMemberships(ctx, team.id)
    }
  }

  const actorName = actor?.name ?? "A workspace admin"
  const workspaceName = workspace.name
  const removedUserName = removedUser?.name ?? "User"
  const teamSummary = teamNames.join(", ")
  const removalMessage =
    teamNames.length > 0
      ? `${actorName} removed you from ${workspaceName}. This removed your access to ${teamSummary}.`
      : `${actorName} removed you from ${workspaceName}.`
  const ownerEmailJobs = await notifyWorkspaceOwnerOfAccessChange(ctx, {
    workspaceId: workspace.id,
    actorUserId: args.currentUserId,
    message: `${actorName} removed ${removedUserName} from ${workspaceName}.`,
    subject: `${actorName} removed ${removedUserName} from ${workspaceName}`,
    eyebrow: "WORKSPACE MEMBER REMOVED",
    headline: `${removedUserName} was removed from ${workspaceName}`,
    excludeUserIds: [args.currentUserId, args.userId],
  })

  return {
    workspaceId: workspace.id,
    userId: args.userId,
    removedUserName,
    emailJobs: [
      ...ownerEmailJobs,
      ...(removedUser?.email
        ? [
            {
              email: removedUser.email,
              subject: `You were removed from ${workspaceName}`,
              eyebrow: "WORKSPACE ACCESS REMOVED",
              headline: `You were removed from ${workspaceName}`,
              body: removalMessage,
            },
          ]
        : []),
    ],
  }
}

export async function leaveWorkspaceHandler(
  ctx: MutationCtx,
  args: LeaveWorkspaceArgs
) {
  assertServerToken(args.serverToken)
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  if (workspace.createdBy === args.currentUserId) {
    throw new Error("Workspace owners can't leave the workspace")
  }

  const workspaceTeams = await listWorkspaceTeams(ctx, args.workspaceId)
  const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id))
  const memberships = (
    await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.currentUserId))
      .collect()
  ).filter((membership) => workspaceTeamIds.has(membership.teamId))

  if (memberships.length === 0) {
    throw new Error("You are not a member of this workspace")
  }

  if (memberships.some((membership) => membership.role === "admin")) {
    throw new Error("Workspace admins can't leave the workspace")
  }

  for (const membership of memberships) {
    await ctx.db.delete(membership._id)
  }

  await cleanupUserAccessRemoval(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: args.currentUserId,
    workspaceId: workspace.id,
    removedTeamIds: memberships.map((membership) => membership.teamId),
  })

  for (const membership of memberships) {
    await syncTeamConversationMemberships(ctx, membership.teamId)
  }

  const currentUser = await getUserDoc(ctx, args.currentUserId)
  const userName = currentUser?.name ?? "A user"
  const leaveMessage = `${userName} left ${workspace.name}.`
  const emailJobs = await notifyWorkspaceOwnerOfAccessChange(ctx, {
    workspaceId: workspace.id,
    actorUserId: args.currentUserId,
    message: leaveMessage,
    subject: `${userName} left ${workspace.name}`,
    eyebrow: "WORKSPACE MEMBER LEFT",
    headline: `${userName} left ${workspace.name}`,
    excludeUserIds: [args.currentUserId],
  })

  return {
    workspaceId: workspace.id,
    userId: args.currentUserId,
    removedTeamIds: memberships.map((membership) => membership.teamId),
    emailJobs,
  }
}

async function assertCurrentAccountDeletionAllowed(
  ctx: AppCtx,
  currentUserId: string
) {
  const user = await getUserDoc(ctx, currentUserId)

  if (!user) {
    throw new Error("User not found")
  }

  const workspaces = await ctx.db.query("workspaces").collect()

  if (workspaces.some((workspace) => workspace.createdBy === currentUserId)) {
    throw new Error(
      "Transfer or delete your owned workspace before deleting your account"
    )
  }

  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", currentUserId))
    .collect()

  if (memberships.some((membership) => membership.role === "admin")) {
    throw new Error(
      "Leave or transfer your team admin access before deleting your account"
    )
  }

  return {
    memberships,
    user,
    workspaces,
  }
}

export async function validateCurrentAccountDeletionHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs & {
    currentUserId: string
  }
) {
  assertServerToken(args.serverToken)
  const { user } = await assertCurrentAccountDeletionAllowed(
    ctx,
    args.currentUserId
  )

  return {
    ok: true,
    userId: user.id,
  }
}

export async function deleteCurrentAccountHandler(
  ctx: MutationCtx,
  args: DeleteCurrentAccountArgs
) {
  assertServerToken(args.serverToken)
  const { memberships, user, workspaces } =
    await assertCurrentAccountDeletionAllowed(ctx, args.currentUserId)

  const teams = await ctx.db.query("teams").collect()
  const currentUserName = user.name ?? "A user"
  const removedTeamIdsByWorkspace = memberships.reduce<
    Record<string, string[]>
  >((accumulator, membership) => {
    const team = teams.find((entry) => entry.id === membership.teamId)

    if (!team) {
      return accumulator
    }

    accumulator[team.workspaceId] = [
      ...(accumulator[team.workspaceId] ?? []),
      membership.teamId,
    ]

    return accumulator
  }, {})
  const emailJobs: AccessEmailJob[] = []

  for (const membership of memberships) {
    await ctx.db.delete(membership._id)
  }

  for (const [workspaceId, removedTeamIds] of Object.entries(
    removedTeamIdsByWorkspace
  )) {
    await cleanupUserAccessRemoval(ctx, {
      currentUserId: args.currentUserId,
      removedUserId: args.currentUserId,
      workspaceId,
      removedTeamIds,
    })

    for (const teamId of removedTeamIds) {
      await syncTeamConversationMemberships(ctx, teamId)
    }
  }

  for (const [workspaceId, removedTeamIds] of Object.entries(
    removedTeamIdsByWorkspace
  )) {
    const workspace = workspaces.find((entry) => entry.id === workspaceId)

    if (workspace) {
      emailJobs.push(
        ...(await notifyWorkspaceOwnerOfAccessChange(ctx, {
          workspaceId,
          actorUserId: args.currentUserId,
          message: `${currentUserName} deleted their account and left ${workspace.name}.`,
          subject: `${currentUserName} deleted their account and left ${workspace.name}`,
          eyebrow: "WORKSPACE MEMBER LEFT",
          headline: `${currentUserName} deleted their account and left ${workspace.name}`,
          excludeUserIds: [args.currentUserId],
        }))
      )
    }

    for (const teamId of removedTeamIds) {
      const team = teams.find((entry) => entry.id === teamId)

      if (!team) {
        continue
      }

      emailJobs.push(
        ...(await notifyTeamAdminsOfAccessChange(ctx, {
          teamId,
          actorUserId: args.currentUserId,
          message: `${currentUserName} deleted their account and left ${team.name}.`,
          subject: `${currentUserName} deleted their account and left ${team.name}`,
          eyebrow: "TEAM MEMBER LEFT",
          headline: `${currentUserName} deleted their account and left ${team.name}`,
          excludeUserIds: [args.currentUserId],
        }))
      )
    }
  }

  const userAppState = await getUserAppState(ctx, args.currentUserId)

  if (userAppState) {
    await ctx.db.delete(userAppState._id)
  }

  const deletedAt = new Date().toISOString()

  await ctx.db.patch(user._id, {
    email: buildDeletedUserEmail(user.id),
    handle: buildDeletedUserHandle(user.id),
    accountDeletedAt: deletedAt,
    hasExplicitStatus: false,
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    preferences: {
      ...defaultUserPreferences,
      ...user.preferences,
    },
  })

  return {
    userId: user.id,
    removedWorkspaceIds: Object.keys(removedTeamIdsByWorkspace),
    emailJobs,
  }
}
