import type { MutationCtx, QueryCtx } from "../_generated/server"

import { buildAccessChangeEmailJobs } from "../../lib/email/builders"
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
  requireEditableWorkspaceAccess,
  requireReadableWorkspaceAccess,
  requireTeamAdminAccess,
  requireWorkspaceAdminAccess,
  requireWorkspaceOwnerAccess,
} from "./access"
import { assertImageUpload } from "./assets"
import {
  cascadeDeleteTeamData,
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
  createSlug,
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
  getDefaultLabelColor,
  normalizeJoinCode,
  normalizeTeamIcon,
} from "./core"
import {
  type AppCtx,
  ensureWorkspaceMembership,
  listActiveTeamUsers,
  listActiveWorkspaceUsers,
  getTeamByJoinCode,
  getTeamBySlug,
  getTeamMembershipDoc,
  getTeamDoc,
  getWorkspaceMembershipDoc,
  getUserDoc,
  getWorkspaceBySlug,
  getWorkspaceDoc,
  listAttachmentsByTargets,
  listCallsByConversations,
  listChannelPostCommentsByPosts,
  listChannelPostsByConversations,
  listChatMessagesByConversations,
  listCommentsByTargets,
  listConversationsByScope,
  listDocumentPresenceByDocuments,
  listLabelsByWorkspace,
  listMilestonesByProjects,
  listNotificationsByEntities,
  listProjectsByScope,
  listProjectUpdatesByProjects,
  listTeamMembershipsByTeams,
  listTeamsByIds,
  listUsersByIds,
  listViewsByScope,
  listWorkspacesByIds,
  listWorkspaceMembershipsByUser,
  listWorkspaceMembershipsByWorkspace,
  listWorkspacesOwnedByUser,
  listWorkspaceDocuments,
  listWorkspaceTeams,
  setCurrentWorkspaceForUser,
  syncWorkspaceMembershipRoleFromTeams,
} from "./data"
import {
  ensureTeamChannelConversation,
  ensureTeamChatConversation,
  syncWorkspaceChannelMemberships,
  syncTeamConversationMemberships,
} from "./conversations"
import { createNotification } from "./collaboration_utils"
import { insertAuditEvent } from "./audit"
import {
  applyWorkspaceAccessRemovalPolicy,
  finalizeCurrentAccountDeletionPolicy,
} from "./lifecycle"
import { queueEmailJobs } from "./email_job_handlers"
import { getTeamSurfaceDisableMessage } from "./team_feature_guards"
import {
  ensureTeamProjectViews,
  ensureTeamWorkViews,
  ensureWorkspaceProjectViews,
} from "./work_helpers"
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
  origin: string
  teamId: string
  userId: string
}

type RemoveWorkspaceUserArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  workspaceId: string
  userId: string
}

type LeaveWorkspaceArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  workspaceId: string
}

type DeleteCurrentAccountArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
}

type PrepareCurrentAccountDeletionArgs = ServerAccessArgs & {
  currentUserId: string
}

type CancelCurrentAccountDeletionArgs = ServerAccessArgs & {
  currentUserId: string
}

type AccessEmailJob = {
  email: string
  subject: string
  eyebrow: string
  headline: string
  body: string
}

type TeamMembershipDoc = NonNullable<
  Awaited<ReturnType<typeof getTeamMembershipDoc>>
>
type WorkspaceMembershipDoc = Awaited<
  ReturnType<typeof getWorkspaceMembershipDoc>
>
type WorkspaceDoc = NonNullable<Awaited<ReturnType<typeof getWorkspaceDoc>>>
type WorkspaceTeamDoc = Awaited<ReturnType<typeof listWorkspaceTeams>>[number]

type DeleteTeamArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  teamId: string
}

type DeleteWorkspaceArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  workspaceId: string
}

function buildAccessEmailsForUsers(
  users: Array<{
    email?: string | null
  }>,
  email: Omit<AccessEmailJob, "email">
) {
  return users.flatMap((user) =>
    user.email
      ? [
          {
            email: user.email,
            ...email,
          },
        ]
      : []
  )
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

async function createUniqueWorkspaceSlugWithLookup(ctx: AppCtx, name: string) {
  const baseSlug = createSlug(name) || "workspace"

  if (!(await getWorkspaceBySlug(ctx, baseSlug))) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!(await getWorkspaceBySlug(ctx, candidate))) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique workspace slug")
}

async function createUniqueTeamSlugWithLookup(
  ctx: AppCtx,
  name: string,
  joinCode: string
) {
  const baseSlug = createSlug(name) || createSlug(joinCode) || "team"

  if (!(await getTeamBySlug(ctx, baseSlug))) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!(await getTeamBySlug(ctx, candidate))) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique team slug")
}

async function ensureTeamJoinCodeAvailable(
  ctx: AppCtx,
  joinCode: string,
  excludedTeamId?: string
) {
  const existingTeam = await getTeamByJoinCode(ctx, joinCode)

  if (existingTeam && existingTeam.id !== excludedTeamId) {
    throw new Error("Join code already exists")
  }
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

async function listWorkspaceTeamMembershipsForUser(
  ctx: MutationCtx,
  workspaceTeamIds: Set<string>,
  userId: string
) {
  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()

  return teamMemberships.filter((membership) =>
    workspaceTeamIds.has(membership.teamId)
  )
}

function hasWorkspaceAdminAccess(
  workspaceMembership: Awaited<ReturnType<typeof getWorkspaceMembershipDoc>>,
  teamMemberships: Awaited<
    ReturnType<typeof listWorkspaceTeamMembershipsForUser>
  >
) {
  return (
    workspaceMembership?.role === "admin" ||
    teamMemberships.some((membership) => membership.role === "admin")
  )
}

async function requireWorkspaceUserRemovalScope(
  ctx: MutationCtx,
  args: RemoveWorkspaceUserArgs
) {
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

  const workspaceMembership = await getWorkspaceMembershipDoc(
    ctx,
    args.workspaceId,
    args.userId
  )
  const workspaceTeams = await listWorkspaceTeams(ctx, args.workspaceId)
  const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id))
  const teamMemberships = await listWorkspaceTeamMembershipsForUser(
    ctx,
    workspaceTeamIds,
    args.userId
  )

  if (!workspaceMembership && teamMemberships.length === 0) {
    throw new Error("Workspace user not found")
  }

  if (hasWorkspaceAdminAccess(workspaceMembership, teamMemberships)) {
    throw new Error("Workspace admins can't be removed from the workspace")
  }

  return {
    teamMemberships,
    workspace,
    workspaceMembership,
    workspaceTeams,
  }
}

function getWorkspaceRemovalTeamNames(
  workspaceTeams: Awaited<ReturnType<typeof listWorkspaceTeams>>,
  teamMemberships: Awaited<
    ReturnType<typeof listWorkspaceTeamMembershipsForUser>
  >
) {
  const memberTeamIds = new Set(
    teamMemberships.map((membership) => membership.teamId)
  )

  return workspaceTeams
    .filter((team) => memberTeamIds.has(team.id))
    .map((team) => team.name)
}

async function deleteWorkspaceUserMemberships(
  ctx: MutationCtx,
  workspaceMembership: Awaited<ReturnType<typeof getWorkspaceMembershipDoc>>,
  teamMemberships: Awaited<
    ReturnType<typeof listWorkspaceTeamMembershipsForUser>
  >
) {
  if (workspaceMembership) {
    await ctx.db.delete(workspaceMembership._id)
  }

  for (const membership of teamMemberships) {
    await ctx.db.delete(membership._id)
  }
}

async function syncWorkspaceRemovalConversations(
  ctx: MutationCtx,
  workspaceId: string,
  teamMemberships: Awaited<
    ReturnType<typeof listWorkspaceTeamMembershipsForUser>
  >
) {
  const removedTeamIds = teamMemberships.map((membership) => membership.teamId)

  for (const teamId of removedTeamIds) {
    await syncTeamConversationMemberships(ctx, teamId)
  }

  if (removedTeamIds.length === 0) {
    await syncWorkspaceChannelMemberships(ctx, workspaceId)
  }
}

function buildWorkspaceRemovalMessage({
  actorName,
  teamNames,
  workspaceName,
}: {
  actorName: string
  teamNames: string[]
  workspaceName: string
}) {
  if (teamNames.length === 0) {
    return `${actorName} removed you from ${workspaceName}.`
  }

  return `${actorName} removed you from ${workspaceName}. This removed your access to ${teamNames.join(", ")}.`
}

function buildWorkspaceRemovalEmailJobs({
  body,
  email,
  workspaceName,
}: {
  body: string
  email?: string | null
  workspaceName: string
}) {
  return email
    ? [
        {
          email,
          subject: `You were removed from ${workspaceName}`,
          eyebrow: "WORKSPACE ACCESS REMOVED",
          headline: `You were removed from ${workspaceName}`,
          body,
        },
      ]
    : []
}

type LeaveTeamArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
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
  const workspaceId = createId("workspace")
  const workspaceSlug = await createUniqueWorkspaceSlugWithLookup(
    ctx,
    args.name
  )

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
  await ensureWorkspaceMembership(ctx, {
    workspaceId,
    userId: args.currentUserId,
    role: "admin",
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
    throw new Error("Workspace not found")
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
  args: DeleteWorkspaceArgs
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

  const [workspaceTeams, workspaceMembers, workspaceMemberships, actor] =
    await Promise.all([
      listWorkspaceTeams(ctx, workspace.id),
      listActiveWorkspaceUsers(ctx, workspace.id),
      listWorkspaceMembershipsByWorkspace(ctx, workspace.id),
      getUserDoc(ctx, args.currentUserId),
    ])
  const workspaceTeamMemberships = await listTeamMembershipsByTeams(
    ctx,
    workspaceTeams.map((team) => team.id)
  )
  const workspaceUserIds = new Set([
    ...workspaceMemberships.map((membership) => membership.userId),
    ...workspaceTeamMemberships.map((membership) => membership.userId),
  ])

  if (workspace.createdBy) {
    workspaceUserIds.add(workspace.createdBy)
  }

  const workspaceUsers = await listUsersByIds(ctx, workspaceUserIds)
  const actorName = actor?.name ?? "A workspace owner"
  const workspaceDeletedHeadline = `${workspace.name} was deleted`
  const workspaceDeletedBody = `${actorName} deleted the ${workspace.name} workspace. It is no longer available.`

  for (const team of workspaceTeams) {
    await cascadeDeleteTeamData(ctx, {
      currentUserId: args.currentUserId,
      teamId: team.id,
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })
  }

  const projects = await listProjectsByScope(ctx, "workspace", workspace.id)
  const deletedProjectIds = new Set(projects.map((project) => project.id))
  const milestones = await listMilestonesByProjects(ctx, deletedProjectIds)
  const deletedMilestoneIds = new Set(
    milestones.map((milestone) => milestone.id)
  )
  const projectUpdates = await listProjectUpdatesByProjects(
    ctx,
    deletedProjectIds
  )
  const documents = await listWorkspaceDocuments(ctx, workspace.id)
  const deletedDocumentIds = new Set(documents.map((document) => document.id))
  const views = await listViewsByScope(ctx, "workspace", workspace.id)
  const conversations = await listConversationsByScope(
    ctx,
    "workspace",
    workspace.id
  )
  const deletedConversationIds = new Set(
    conversations.map((conversation) => conversation.id)
  )
  const [calls, chatMessages, channelPosts] = await Promise.all([
    listCallsByConversations(ctx, deletedConversationIds),
    listChatMessagesByConversations(ctx, deletedConversationIds),
    listChannelPostsByConversations(ctx, deletedConversationIds),
  ])
  const deletedChatMessageIds = new Set(
    chatMessages.map((message) => message.id)
  )
  const deletedChannelPostIds = new Set(channelPosts.map((post) => post.id))
  const [
    channelPostComments,
    attachments,
    comments,
    documentPresence,
    notifications,
  ] = await Promise.all([
    listChannelPostCommentsByPosts(ctx, deletedChannelPostIds),
    listAttachmentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDocumentIds,
    }),
    listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDocumentIds,
    }),
    listDocumentPresenceByDocuments(ctx, deletedDocumentIds),
    listNotificationsByEntities(ctx, [
      ...[...deletedDocumentIds].map((entityId) => ({
        entityType: "document" as const,
        entityId,
      })),
      ...[...deletedProjectIds].map((entityId) => ({
        entityType: "project" as const,
        entityId,
      })),
      ...[...deletedChatMessageIds].map((entityId) => ({
        entityType: "chat" as const,
        entityId,
      })),
      ...[...deletedChannelPostIds].map((entityId) => ({
        entityType: "channelPost" as const,
        entityId,
      })),
    ]),
  ])

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
  await deleteDocs(ctx, documentPresence)
  await deleteDocs(ctx, notifications)
  await deleteDocs(ctx, projectUpdates)
  await deleteDocs(ctx, views)
  await deleteDocs(ctx, documents)
  await deleteDocs(ctx, milestones)
  await deleteDocs(ctx, projects)
  await deleteDocs(ctx, conversations)
  await deleteDocs(ctx, workspaceMemberships)
  await ctx.db.delete(workspace._id)

  await cleanupUserAppStatesForDeletedWorkspace(ctx, workspace.id)

  const deletedLabelIds = await cleanupUnusedLabels(ctx, workspace.id)

  await insertAuditEvent(ctx, {
    type: "workspace.deleted",
    actorUserId: args.currentUserId,
    workspaceId: workspace.id,
    entityId: workspace.id,
    summary: `Workspace ${workspace.name} was deleted.`,
    details: {
      removedTeamIds: workspaceTeams.map((team) => team.id),
      source: "convex",
    },
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: buildAccessEmailsForUsers(workspaceMembers, {
        subject: workspaceDeletedHeadline,
        eyebrow: "WORKSPACE DELETED",
        headline: workspaceDeletedHeadline,
        body: workspaceDeletedBody,
      }),
    })
  )

  return {
    workspaceId: workspace.id,
    deletedTeamIds: workspaceTeams.map((team) => team.id),
    deletedLabelIds,
    deletedUserIds: [],
    providerMemberships:
      workspace.workosOrganizationId == null
        ? []
        : workspaceUsers
            .filter((member) => Boolean(member.workosUserId))
            .map((member) => ({
              workspaceId: workspace.id,
              organizationId: workspace.workosOrganizationId as string,
              workosUserId: member.workosUserId as string,
            })),
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
    throw new Error("Workspace not found")
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
    throw new Error("User not found")
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

  const teams = await listWorkspaceTeams(ctx, args.workspaceId)

  await ensureWorkspaceProjectViews(ctx, args.workspaceId)

  for (const team of teams) {
    await ensureTeamWorkViews(ctx, team)
    await ensureTeamProjectViews(ctx, team)
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

  const workspaceTeams = await listWorkspaceTeams(ctx, args.workspaceId)
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
  await ensureTeamJoinCodeAvailable(ctx, normalizedJoinCode)
  const teamSlug = await createUniqueTeamSlugWithLookup(
    ctx,
    args.name,
    normalizedJoinCode
  )
  const teamId = createId("team")

  await ctx.db.insert("teams", {
    id: teamId,
    workspaceId: workspace.id,
    joinCodeNormalized: normalizedJoinCode,
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
  await ensureWorkspaceMembership(ctx, {
    workspaceId: workspace.id,
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
  await ensureTeamProjectViews(ctx, await getTeamDoc(ctx, teamId))

  return {
    teamId,
    teamSlug,
    joinCode: normalizedJoinCode,
    features: normalizedFeatures,
  }
}

export async function deleteTeamHandler(
  ctx: MutationCtx,
  args: DeleteTeamArgs
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

  const [teamMembers, actor] = await Promise.all([
    listActiveTeamUsers(ctx, team.id),
    getUserDoc(ctx, args.currentUserId),
  ])
  const actorName = actor?.name ?? "A team admin"
  const teamDeletedHeadline = `${team.name} was deleted`
  const teamDeletedMessage = `${actorName} deleted ${team.name}. The team space is no longer available.`

  // Write inbox notices before the cascade so former team-only users remain
  // referenceable long enough to keep the deletion notification.
  for (const member of teamMembers) {
    await ctx.db.insert(
      "notifications",
      createNotification(
        member.id,
        args.currentUserId,
        teamDeletedMessage,
        "team",
        team.id,
        "status-change"
      )
    )
  }

  const result = await cascadeDeleteTeamData(ctx, {
    currentUserId: args.currentUserId,
    teamId: team.id,
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: buildAccessEmailsForUsers(teamMembers, {
        subject: teamDeletedHeadline,
        eyebrow: "TEAM DELETED",
        headline: teamDeletedHeadline,
        body: teamDeletedMessage,
      }),
    })
  )

  return result
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
  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: team.workspaceId,
    userId: args.currentUserId,
    fallbackRole: "viewer",
  })
  const accessRemoval = await applyWorkspaceAccessRemovalPolicy(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: args.currentUserId,
    removedUserWorkosUserId: currentUser?.workosUserId ?? null,
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

  await insertAuditEvent(ctx, {
    type: "membership.left_team",
    actorUserId: args.currentUserId,
    subjectUserId: args.currentUserId,
    workspaceId: team.workspaceId,
    teamId: team.id,
    entityId: args.currentUserId,
    summary: `${userName} left ${team.name}.`,
    details: {
      removedTeamIds: [team.id],
      source: "convex",
      workosUserId: currentUser?.workosUserId ?? undefined,
    },
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: emailJobs,
    })
  )

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    workspaceAccessRemoved: !accessRemoval.hasWorkspaceAccess,
    emailJobs,
    providerMemberships: accessRemoval.providerMembershipCleanup
      ? [accessRemoval.providerMembershipCleanup]
      : [],
  }
}

export async function createLabelHandler(
  ctx: MutationCtx,
  args: ServerAccessArgs & {
    currentUserId: string
    workspaceId: string
    name: string
    color?: string
  }
) {
  assertServerToken(args.serverToken)

  const user = await getUserDoc(ctx, args.currentUserId)

  if (!user) {
    throw new Error("User not found")
  }

  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  await requireEditableWorkspaceAccess(
    ctx,
    args.workspaceId,
    args.currentUserId
  )

  const normalizedName = args.name.trim()

  if (normalizedName.length === 0) {
    throw new Error("Label name is required")
  }

  const existingLabels = await listLabelsByWorkspace(ctx, args.workspaceId)
  const existingLabel =
    existingLabels.find(
      (label) => label.name.toLowerCase() === normalizedName.toLowerCase()
    ) ?? null

  if (existingLabel) {
    return existingLabel
  }

  const label = {
    id: createId("label"),
    workspaceId: workspace.id,
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
    await ensureTeamJoinCodeAvailable(ctx, normalizedJoinCode, team.id)
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
    joinCodeNormalized: normalizedJoinCode,
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
  await ensureTeamProjectViews(ctx, await getTeamDoc(ctx, team.id))

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
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
  await ensureTeamJoinCodeAvailable(ctx, normalizedJoinCode, team.id)

  await ctx.db.patch(team._id, {
    joinCodeNormalized: normalizedJoinCode,
    settings: {
      ...team.settings,
      joinCode: normalizedJoinCode,
    },
  })

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
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
    workspaceId: team.workspaceId,
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
  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: team.workspaceId,
    userId: membership.userId,
    fallbackRole: "viewer",
  })

  await syncTeamConversationMemberships(ctx, team.id)

  await insertAuditEvent(ctx, {
    type: "membership.role_changed",
    actorUserId: args.currentUserId,
    subjectUserId: membership.userId,
    workspaceId: team.workspaceId,
    teamId: team.id,
    entityId: membership.userId,
    summary: `Team role for ${membership.userId} changed from ${membership.role} to ${args.role} in ${team.name}.`,
    details: {
      nextRole: args.role,
      previousRole: membership.role,
      source: "convex",
    },
  })

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    userId: membership.userId,
    role: args.role,
  }
}

async function assertTeamMemberRemovalAllowed(
  ctx: MutationCtx,
  input: {
    membership: Awaited<
      ReturnType<typeof requireMutableTeamMember>
    >["membership"]
    teamId: string
  }
) {
  if (input.membership.role !== "admin") {
    return
  }

  const adminCount = await getTeamAdminCount(ctx, input.teamId)

  if (adminCount <= 1) {
    throw new Error("Teams must keep at least one admin")
  }
}

async function getTeamMemberRemovalPeople(
  ctx: MutationCtx,
  input: {
    actorUserId: string
    removedUserId: string
    workspaceId: string
  }
) {
  const [removedUser, workspace, actor] = await Promise.all([
    getUserDoc(ctx, input.removedUserId),
    getWorkspaceDoc(ctx, input.workspaceId),
    getUserDoc(ctx, input.actorUserId),
  ])

  return {
    actor,
    actorName: actor?.name ?? "A team admin",
    removedUser,
    removedUserName: removedUser?.name ?? "User",
    workspace,
    workspaceName: workspace?.name ?? "Workspace",
  }
}

async function removeTeamMembershipAccess(
  ctx: MutationCtx,
  input: {
    actorUserId: string
    membership: Awaited<
      ReturnType<typeof requireMutableTeamMember>
    >["membership"]
    removedUserWorkosUserId?: string | null
    team: Awaited<ReturnType<typeof requireMutableTeamMember>>["team"]
  }
) {
  await ctx.db.delete(input.membership._id)
  await syncWorkspaceMembershipRoleFromTeams(ctx, {
    workspaceId: input.team.workspaceId,
    userId: input.membership.userId,
    fallbackRole: "viewer",
  })
  const accessRemoval = await applyWorkspaceAccessRemovalPolicy(ctx, {
    currentUserId: input.actorUserId,
    removedUserId: input.membership.userId,
    removedUserWorkosUserId: input.removedUserWorkosUserId ?? null,
    workspaceId: input.team.workspaceId,
    removedTeamIds: [input.team.id],
  })
  await syncTeamConversationMemberships(ctx, input.team.id)

  return accessRemoval
}

async function notifyRemovedTeamMember(
  ctx: MutationCtx,
  input: {
    actorUserId: string
    message: string
    removedUser: Awaited<ReturnType<typeof getUserDoc>>
    teamId: string
  }
) {
  if (!input.removedUser) {
    return
  }

  await ctx.db.insert(
    "notifications",
    createNotification(
      input.removedUser.id,
      input.actorUserId,
      input.message,
      "team",
      input.teamId,
      "status-change"
    )
  )
}

function buildRemovedTeamMemberEmailJobs(
  removedUser: Awaited<ReturnType<typeof getUserDoc>>,
  input: {
    removalMessage: string
    teamName: string
  }
): AccessEmailJob[] {
  return removedUser?.email
    ? [
        {
          email: removedUser.email,
          subject: `You were removed from ${input.teamName}`,
          eyebrow: "TEAM ACCESS REMOVED",
          headline: `You were removed from ${input.teamName}`,
          body: input.removalMessage,
        },
      ]
    : []
}

async function buildTeamMemberRemovalEmailJobs(
  ctx: MutationCtx,
  input: {
    actorName: string
    actorUserId: string
    membershipUserId: string
    removalMessage: string
    removedUser: Awaited<ReturnType<typeof getUserDoc>>
    removedUserName: string
    team: Awaited<ReturnType<typeof requireMutableTeamMember>>["team"]
  }
) {
  const adminEmailJobs = await notifyTeamAdminsOfAccessChange(ctx, {
    teamId: input.team.id,
    actorUserId: input.actorUserId,
    message: `${input.actorName} removed ${input.removedUserName} from ${input.team.name}.`,
    subject: `${input.actorName} removed ${input.removedUserName} from ${input.team.name}`,
    eyebrow: "TEAM MEMBER REMOVED",
    headline: `${input.removedUserName} was removed from ${input.team.name}`,
    excludeUserIds: [input.actorUserId, input.membershipUserId],
  })

  return [
    ...adminEmailJobs,
    ...buildRemovedTeamMemberEmailJobs(input.removedUser, {
      removalMessage: input.removalMessage,
      teamName: input.team.name,
    }),
  ]
}

async function insertTeamMemberRemovalAudit(
  ctx: MutationCtx,
  input: {
    actorUserId: string
    membershipUserId: string
    removedUserName: string
    removedUserWorkosUserId?: string | null
    team: Awaited<ReturnType<typeof requireMutableTeamMember>>["team"]
  }
) {
  await insertAuditEvent(ctx, {
    type: "membership.removed_from_team",
    actorUserId: input.actorUserId,
    subjectUserId: input.membershipUserId,
    workspaceId: input.team.workspaceId,
    teamId: input.team.id,
    entityId: input.membershipUserId,
    summary: `${input.removedUserName} was removed from ${input.team.name}.`,
    details: {
      removedTeamIds: [input.team.id],
      source: "convex",
      workosUserId: input.removedUserWorkosUserId ?? undefined,
    },
  })
}

export async function removeTeamMemberHandler(
  ctx: MutationCtx,
  args: RemoveTeamMemberArgs
) {
  assertServerToken(args.serverToken)
  const { team, membership } = await requireMutableTeamMember(ctx, args)

  await assertTeamMemberRemovalAllowed(ctx, {
    membership,
    teamId: team.id,
  })
  const { actorName, removedUser, removedUserName, workspaceName } =
    await getTeamMemberRemovalPeople(ctx, {
      actorUserId: args.currentUserId,
      removedUserId: membership.userId,
      workspaceId: team.workspaceId,
    })
  const removalMessage = `${actorName} removed you from ${team.name}.`
  const accessRemoval = await removeTeamMembershipAccess(ctx, {
    actorUserId: args.currentUserId,
    membership,
    removedUserWorkosUserId: removedUser?.workosUserId ?? null,
    team,
  })

  await notifyRemovedTeamMember(ctx, {
    actorUserId: args.currentUserId,
    message: removalMessage,
    removedUser,
    teamId: team.id,
  })
  const emailJobs = await buildTeamMemberRemovalEmailJobs(ctx, {
    actorName,
    actorUserId: args.currentUserId,
    membershipUserId: membership.userId,
    removalMessage,
    removedUser,
    removedUserName,
    team,
  })

  await insertTeamMemberRemovalAudit(ctx, {
    actorUserId: args.currentUserId,
    membershipUserId: membership.userId,
    removedUserName,
    removedUserWorkosUserId: removedUser?.workosUserId ?? null,
    team,
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: emailJobs,
    })
  )

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    userId: membership.userId,
    removedUserEmail: removedUser?.email ?? "",
    removedUserName,
    teamName: team.name,
    workspaceName,
    actorName,
    emailJobs,
    providerMemberships: accessRemoval.providerMembershipCleanup
      ? [accessRemoval.providerMembershipCleanup]
      : [],
  }
}

export async function removeWorkspaceUserHandler(
  ctx: MutationCtx,
  args: RemoveWorkspaceUserArgs
) {
  assertServerToken(args.serverToken)
  const { teamMemberships, workspace, workspaceMembership, workspaceTeams } =
    await requireWorkspaceUserRemovalScope(ctx, args)

  const removedUser = await getUserDoc(ctx, args.userId)
  const actor = await getUserDoc(ctx, args.currentUserId)
  const removedTeamIds = teamMemberships.map((membership) => membership.teamId)
  const teamNames = getWorkspaceRemovalTeamNames(
    workspaceTeams,
    teamMemberships
  )

  await deleteWorkspaceUserMemberships(
    ctx,
    workspaceMembership,
    teamMemberships
  )

  const accessRemoval = await applyWorkspaceAccessRemovalPolicy(ctx, {
    currentUserId: args.currentUserId,
    removedUserId: args.userId,
    removedUserWorkosUserId: removedUser?.workosUserId ?? null,
    workspaceId: workspace.id,
    removedTeamIds,
  })

  await syncWorkspaceRemovalConversations(ctx, workspace.id, teamMemberships)

  const actorName = actor?.name ?? "A workspace admin"
  const workspaceName = workspace.name
  const removedUserName = removedUser?.name ?? "User"
  const removalMessage = buildWorkspaceRemovalMessage({
    actorName,
    teamNames,
    workspaceName,
  })
  const emailJobs = buildWorkspaceRemovalEmailJobs({
    body: removalMessage,
    email: removedUser?.email,
    workspaceName,
  })

  await insertAuditEvent(ctx, {
    type: "membership.removed_from_workspace",
    actorUserId: args.currentUserId,
    subjectUserId: args.userId,
    workspaceId: workspace.id,
    entityId: args.userId,
    summary: `${removedUserName} was removed from ${workspaceName}.`,
    details: {
      removedTeamIds,
      source: "convex",
      workosUserId: removedUser?.workosUserId ?? undefined,
    },
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: emailJobs,
    })
  )

  return {
    workspaceId: workspace.id,
    userId: args.userId,
    removedUserName,
    emailJobs,
    providerMemberships: accessRemoval.providerMembershipCleanup
      ? [accessRemoval.providerMembershipCleanup]
      : [],
  }
}

async function requireLeaveWorkspaceScope(
  ctx: MutationCtx,
  args: LeaveWorkspaceArgs
) {
  const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  if (workspace.createdBy === args.currentUserId) {
    throw new Error("Workspace owners can't leave the workspace")
  }

  const workspaceMembership = await getWorkspaceMembershipDoc(
    ctx,
    args.workspaceId,
    args.currentUserId
  )
  const workspaceTeams = await listWorkspaceTeams(ctx, args.workspaceId)
  const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id))
  const teamMemberships = (
    await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.currentUserId))
      .collect()
  ).filter((membership) => workspaceTeamIds.has(membership.teamId))

  if (!workspaceMembership && teamMemberships.length === 0) {
    throw new Error("You are not a member of this workspace")
  }

  if (
    workspaceMembership?.role === "admin" ||
    teamMemberships.some((membership) => membership.role === "admin")
  ) {
    throw new Error("Workspace admins can't leave the workspace")
  }

  return {
    workspace,
    workspaceMembership,
    workspaceTeams,
    teamMemberships,
  }
}

async function deleteLeaveWorkspaceMemberships(
  ctx: MutationCtx,
  input: {
    teamMemberships: TeamMembershipDoc[]
    workspaceMembership: WorkspaceMembershipDoc
  }
) {
  if (input.workspaceMembership) {
    await ctx.db.delete(input.workspaceMembership._id)
  }

  for (const membership of input.teamMemberships) {
    await ctx.db.delete(membership._id)
  }
}

async function applyLeaveWorkspaceAccessRemoval(
  ctx: MutationCtx,
  input: {
    currentUser: Awaited<ReturnType<typeof getUserDoc>>
    currentUserId: string
    teamMemberships: TeamMembershipDoc[]
    workspace: WorkspaceDoc
  }
) {
  return applyWorkspaceAccessRemovalPolicy(ctx, {
    currentUserId: input.currentUserId,
    removedUserId: input.currentUserId,
    removedUserWorkosUserId: input.currentUser?.workosUserId ?? null,
    workspaceId: input.workspace.id,
    removedTeamIds: input.teamMemberships.map(
      (membership) => membership.teamId
    ),
  })
}

async function syncLeaveWorkspaceConversations(
  ctx: MutationCtx,
  input: {
    teamMemberships: TeamMembershipDoc[]
    workspaceId: string
  }
) {
  for (const membership of input.teamMemberships) {
    await syncTeamConversationMemberships(ctx, membership.teamId)
  }

  if (input.teamMemberships.length === 0) {
    await syncWorkspaceChannelMemberships(ctx, input.workspaceId)
  }
}

async function buildLeaveWorkspaceEmailJobs(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    leaveMessage: string
    removedTeamIds: string[]
    userName: string
    workspace: WorkspaceDoc
    workspaceTeams: WorkspaceTeamDoc[]
  }
) {
  const emailJobs = await notifyWorkspaceOwnerOfAccessChange(ctx, {
    workspaceId: input.workspace.id,
    actorUserId: input.currentUserId,
    message: input.leaveMessage,
    subject: `${input.userName} left ${input.workspace.name}`,
    eyebrow: "WORKSPACE MEMBER LEFT",
    headline: `${input.userName} left ${input.workspace.name}`,
    excludeUserIds: [input.currentUserId],
  })

  for (const teamId of input.removedTeamIds) {
    const team = input.workspaceTeams.find((entry) => entry.id === teamId)

    if (!team) {
      continue
    }

    emailJobs.push(
      ...(await notifyTeamAdminsOfAccessChange(ctx, {
        teamId,
        actorUserId: input.currentUserId,
        message: `${input.userName} left ${team.name}.`,
        subject: `${input.userName} left ${team.name}`,
        eyebrow: "TEAM MEMBER LEFT",
        headline: `${input.userName} left ${team.name}`,
        excludeUserIds: [input.currentUserId],
      }))
    )
  }

  return emailJobs
}

async function insertLeaveWorkspaceAudit(
  ctx: MutationCtx,
  input: {
    currentUser: Awaited<ReturnType<typeof getUserDoc>>
    currentUserId: string
    removedTeamIds: string[]
    userName: string
    workspace: WorkspaceDoc
  }
) {
  await insertAuditEvent(ctx, {
    type: "membership.left_workspace",
    actorUserId: input.currentUserId,
    subjectUserId: input.currentUserId,
    workspaceId: input.workspace.id,
    entityId: input.currentUserId,
    summary: `${input.userName} left ${input.workspace.name}.`,
    details: {
      removedTeamIds: input.removedTeamIds,
      source: "convex",
      workosUserId: input.currentUser?.workosUserId ?? undefined,
    },
  })
}

export async function leaveWorkspaceHandler(
  ctx: MutationCtx,
  args: LeaveWorkspaceArgs
) {
  assertServerToken(args.serverToken)
  const { teamMemberships, workspace, workspaceMembership, workspaceTeams } =
    await requireLeaveWorkspaceScope(ctx, args)

  const currentUser = await getUserDoc(ctx, args.currentUserId)

  await deleteLeaveWorkspaceMemberships(ctx, {
    teamMemberships,
    workspaceMembership,
  })
  const accessRemoval = await applyLeaveWorkspaceAccessRemoval(ctx, {
    currentUser,
    currentUserId: args.currentUserId,
    teamMemberships,
    workspace,
  })
  await syncLeaveWorkspaceConversations(ctx, {
    teamMemberships,
    workspaceId: workspace.id,
  })

  const userName = currentUser?.name ?? "A user"
  const leaveMessage = `${userName} left ${workspace.name}.`
  const removedTeamIds = [
    ...new Set(teamMemberships.map((membership) => membership.teamId)),
  ]
  const emailJobs = await buildLeaveWorkspaceEmailJobs(ctx, {
    currentUserId: args.currentUserId,
    leaveMessage,
    removedTeamIds,
    userName,
    workspace,
    workspaceTeams,
  })

  await insertLeaveWorkspaceAudit(ctx, {
    currentUser,
    currentUserId: args.currentUserId,
    removedTeamIds,
    userName,
    workspace,
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: emailJobs,
    })
  )

  return {
    workspaceId: workspace.id,
    userId: args.currentUserId,
    removedTeamIds,
    emailJobs,
    providerMemberships: accessRemoval.providerMembershipCleanup
      ? [accessRemoval.providerMembershipCleanup]
      : [],
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

  if (user.accountDeletedAt) {
    throw new Error("This account has already been deleted")
  }

  const ownedWorkspaces = await listWorkspacesOwnedByUser(ctx, currentUserId)

  if (ownedWorkspaces.length > 0) {
    throw new Error(
      "Transfer or delete your owned workspace before deleting your account"
    )
  }

  const [memberships, workspaceMemberships] = await Promise.all([
    ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .collect(),
    listWorkspaceMembershipsByUser(ctx, currentUserId),
  ])

  if (memberships.some((membership) => membership.role === "admin")) {
    throw new Error(
      "Leave or transfer your team admin access before deleting your account"
    )
  }

  if (workspaceMemberships.some((membership) => membership.role === "admin")) {
    throw new Error(
      "Leave or transfer your workspace admin access before deleting your account"
    )
  }

  return {
    memberships,
    workspaceMemberships,
    user,
  }
}

export async function prepareCurrentAccountDeletionHandler(
  ctx: MutationCtx,
  args: PrepareCurrentAccountDeletionArgs
) {
  assertServerToken(args.serverToken)
  const { user } = await assertCurrentAccountDeletionAllowed(
    ctx,
    args.currentUserId
  )

  if (user.accountDeletionPendingAt) {
    return {
      userId: user.id,
      pendingAt: user.accountDeletionPendingAt,
    }
  }

  const pendingAt = new Date().toISOString()

  await ctx.db.patch(user._id, {
    accountDeletionPendingAt: pendingAt,
  })

  return {
    userId: user.id,
    pendingAt,
  }
}

export async function cancelCurrentAccountDeletionHandler(
  ctx: MutationCtx,
  args: CancelCurrentAccountDeletionArgs
) {
  assertServerToken(args.serverToken)
  const user = await getUserDoc(ctx, args.currentUserId)

  if (!user || user.accountDeletedAt || !user.accountDeletionPendingAt) {
    return {
      userId: args.currentUserId,
      cancelled: false,
    }
  }

  await ctx.db.patch(user._id, {
    accountDeletionPendingAt: null,
  })

  return {
    userId: user.id,
    cancelled: true,
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

type CurrentAccountDeletionAccess = Awaited<
  ReturnType<typeof assertCurrentAccountDeletionAllowed>
>

function getRemovedTeamIdsByWorkspace(
  access: CurrentAccountDeletionAccess,
  teamsById: Map<string, Awaited<ReturnType<typeof listTeamsByIds>>[number]>
) {
  const removedWorkspaceIds = new Set(
    access.workspaceMemberships.map((membership) => membership.workspaceId)
  )
  const removedTeamIdsByWorkspace = access.memberships.reduce<
    Record<string, string[]>
  >((accumulator, membership) => {
    const team = teamsById.get(membership.teamId)

    if (!team) {
      return accumulator
    }

    removedWorkspaceIds.add(team.workspaceId)
    accumulator[team.workspaceId] = [
      ...(accumulator[team.workspaceId] ?? []),
      membership.teamId,
    ]

    return accumulator
  }, {})

  for (const workspaceId of removedWorkspaceIds) {
    removedTeamIdsByWorkspace[workspaceId] ??= []
  }

  return removedTeamIdsByWorkspace
}

async function getCurrentAccountDeletionScope(
  ctx: MutationCtx,
  access: CurrentAccountDeletionAccess
) {
  const teams = await listTeamsByIds(
    ctx,
    access.memberships.map((membership) => membership.teamId)
  )
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const removedTeamIdsByWorkspace = getRemovedTeamIdsByWorkspace(
    access,
    teamsById
  )
  const workspaces = await listWorkspacesByIds(
    ctx,
    Object.keys(removedTeamIdsByWorkspace)
  )

  return {
    removedTeamIdsByWorkspace,
    teamsById,
    workspacesById: new Map(
      workspaces.map((workspace) => [workspace.id, workspace])
    ),
  }
}

async function deleteCurrentAccountMembershipDocs(
  ctx: MutationCtx,
  access: CurrentAccountDeletionAccess
) {
  for (const membership of access.memberships) {
    await ctx.db.delete(membership._id)
  }

  for (const workspaceMembership of access.workspaceMemberships) {
    await ctx.db.delete(workspaceMembership._id)
  }
}

async function syncCurrentAccountDeletionConversations(
  ctx: MutationCtx,
  removedTeamIdsByWorkspace: Record<string, string[]>
) {
  for (const removedTeamIds of Object.values(removedTeamIdsByWorkspace)) {
    for (const teamId of removedTeamIds) {
      await syncTeamConversationMemberships(ctx, teamId)
    }
  }

  for (const [workspaceId, removedTeamIds] of Object.entries(
    removedTeamIdsByWorkspace
  )) {
    if (removedTeamIds.length === 0) {
      await syncWorkspaceChannelMemberships(ctx, workspaceId)
    }
  }
}

async function collectCurrentAccountDeletionEmailJobs(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    currentUserName: string
    removedTeamIdsByWorkspace: Record<string, string[]>
    teamsById: Map<string, Awaited<ReturnType<typeof listTeamsByIds>>[number]>
    workspacesById: Map<
      string,
      Awaited<ReturnType<typeof listWorkspacesByIds>>[number]
    >
  }
) {
  const emailJobs: AccessEmailJob[] = []

  for (const [workspaceId, removedTeamIds] of Object.entries(
    input.removedTeamIdsByWorkspace
  )) {
    const workspace = input.workspacesById.get(workspaceId)

    if (workspace) {
      emailJobs.push(
        ...(await notifyWorkspaceOwnerOfAccessChange(ctx, {
          workspaceId,
          actorUserId: input.currentUserId,
          message: `${input.currentUserName} deleted their account and left ${workspace.name}.`,
          subject: `${input.currentUserName} deleted their account and left ${workspace.name}`,
          eyebrow: "WORKSPACE MEMBER LEFT",
          headline: `${input.currentUserName} deleted their account and left ${workspace.name}`,
          excludeUserIds: [input.currentUserId],
        }))
      )
    }

    for (const teamId of removedTeamIds) {
      const team = input.teamsById.get(teamId)

      if (!team) {
        continue
      }

      emailJobs.push(
        ...(await notifyTeamAdminsOfAccessChange(ctx, {
          teamId,
          actorUserId: input.currentUserId,
          message: `${input.currentUserName} deleted their account and left ${team.name}.`,
          subject: `${input.currentUserName} deleted their account and left ${team.name}`,
          eyebrow: "TEAM MEMBER LEFT",
          headline: `${input.currentUserName} deleted their account and left ${team.name}`,
          excludeUserIds: [input.currentUserId],
        }))
      )
    }
  }

  return emailJobs
}

async function insertCurrentAccountDeletionAuditEvent(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    currentUserName: string
    deletionLifecycle: Awaited<
      ReturnType<typeof finalizeCurrentAccountDeletionPolicy>
    >
    memberships: CurrentAccountDeletionAccess["memberships"]
    user: CurrentAccountDeletionAccess["user"]
  }
) {
  await insertAuditEvent(ctx, {
    type: "account.deleted",
    actorUserId: input.currentUserId,
    subjectUserId: input.user.id,
    entityId: input.user.id,
    summary: `${input.currentUserName} deleted their account.`,
    details: {
      deletedPrivateDocumentIds:
        input.deletionLifecycle.deletedPrivateDocumentIds,
      removedTeamIds: [
        ...new Set(input.memberships.map((membership) => membership.teamId)),
      ],
      source: "convex",
      workosUserId: input.user.workosUserId ?? undefined,
    },
  })
}

export async function deleteCurrentAccountHandler(
  ctx: MutationCtx,
  args: DeleteCurrentAccountArgs
) {
  assertServerToken(args.serverToken)
  const access = await assertCurrentAccountDeletionAllowed(
    ctx,
    args.currentUserId
  )
  const { memberships, user } = access
  const currentUserName = user.name ?? "A user"
  const { removedTeamIdsByWorkspace, teamsById, workspacesById } =
    await getCurrentAccountDeletionScope(ctx, access)

  await deleteCurrentAccountMembershipDocs(ctx, access)

  const deletionLifecycle = await finalizeCurrentAccountDeletionPolicy(ctx, {
    currentUserId: args.currentUserId,
    user,
    removedTeamIdsByWorkspace,
  })

  await syncCurrentAccountDeletionConversations(ctx, removedTeamIdsByWorkspace)

  const emailJobs = await collectCurrentAccountDeletionEmailJobs(ctx, {
    currentUserId: args.currentUserId,
    currentUserName,
    removedTeamIdsByWorkspace,
    teamsById,
    workspacesById,
  })

  await insertCurrentAccountDeletionAuditEvent(ctx, {
    currentUserId: args.currentUserId,
    currentUserName,
    deletionLifecycle,
    memberships,
    user,
  })

  await queueEmailJobs(
    ctx,
    buildAccessChangeEmailJobs({
      origin: args.origin,
      emails: emailJobs,
    })
  )

  return {
    userId: user.id,
    removedWorkspaceIds: deletionLifecycle.removedWorkspaceIds,
    emailJobs,
    providerMemberships: deletionLifecycle.providerMemberships,
    deletedPrivateDocumentIds: deletionLifecycle.deletedPrivateDocumentIds,
  }
}
