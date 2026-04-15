import type { MutationCtx } from "../_generated/server"

import {
  createDefaultTeamWorkflowSettings,
  getTeamFeatureValidationMessage,
  type TeamExperienceType,
  type TeamFeatureSettings,
  type TeamWorkflowSettings,
  type ThemePreference,
  type UserStatus,
} from "../../lib/domain/types"
import { requireReadableWorkspaceAccess, requireWorkspaceAdminAccess } from "./access"
import { assertImageUpload } from "./assets"
import {
  cascadeDeleteTeamData,
  cleanupRemainingLinksAfterDelete,
  cleanupUnusedLabels,
  cleanupUnreferencedUsers,
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
  getEffectiveRole,
  getTeamDoc,
  getUserDoc,
  getWorkspaceDoc,
  isWorkspaceOwner,
  setCurrentWorkspaceForUser,
} from "./data"
import {
  ensureTeamChannelConversation,
  ensureTeamChatConversation,
  getWorkspaceUserIds,
} from "./conversations"
import { getTeamSurfaceDisableMessage } from "./team-feature-guards"
import { ensureTeamWorkViews } from "./work-helpers"
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

  await requireWorkspaceAdminAccess(ctx, args.workspaceId, args.currentUserId)

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

  const isOwner = await isWorkspaceOwner(
    ctx,
    args.workspaceId,
    args.currentUserId
  )

  if (!isOwner) {
    throw new Error("Only the workspace owner can delete the workspace")
  }

  const candidateUserIds = await getWorkspaceUserIds(ctx, workspace.id)
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
  const notifications = (
    await ctx.db.query("notifications").collect()
  ).filter((notification) => {
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
  })

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
  const deletedUserIds = await cleanupUnreferencedUsers(ctx, candidateUserIds)

  return {
    workspaceId: workspace.id,
    deletedTeamIds: workspaceTeams.map((team) => team.id),
    deletedLabelIds,
    deletedUserIds,
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

export async function createTeamHandler(ctx: MutationCtx, args: CreateTeamArgs) {
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
    await requireWorkspaceAdminAccess(
      ctx,
      args.workspaceId,
      args.currentUserId
    )
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

  await requireWorkspaceAdminAccess(ctx, team.workspaceId, args.currentUserId)

  return cascadeDeleteTeamData(ctx, {
    currentUserId: args.currentUserId,
    teamId: team.id,
  })
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

  const role = await getEffectiveRole(ctx, args.teamId, args.currentUserId)

  if (role !== "admin") {
    throw new Error("Only team admins can update team details")
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

  const role = await getEffectiveRole(ctx, args.teamId, args.currentUserId)

  if (role !== "admin") {
    throw new Error("Only team admins can regenerate join codes")
  }

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

  const role = await getEffectiveRole(ctx, args.teamId, args.currentUserId)

  if (role !== "admin") {
    throw new Error("Only team admins can update workflow settings")
  }

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
