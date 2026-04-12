import { addDays, differenceInCalendarDays } from "date-fns"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"

import { createSeedState } from "../lib/domain/seed"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  getTeamFeatureValidationMessage,
} from "../lib/domain/types"
import {
  attachmentTargetTypeValidator,
  commentTargetTypeValidator,
  displayPropertyValidator,
  groupFieldValidator,
  nullableStringValidator,
  orderingFieldValidator,
  priorityValidator,
  roleValidator,
  scopeTypeValidator,
  teamExperienceTypeValidator,
  teamFeatureSettingsValidator,
  teamWorkflowSettingsValidator,
  templateTypeValidator,
  workItemTypeValidator,
  workStatusValidator,
} from "./validators"

function getNow() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function createHandle(email: string) {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

function normalizeJoinCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24)
}

function toKeyPrefix(teamId: string) {
  if (teamId === "team_development") {
    return "DEV"
  }

  if (teamId === "team_operations") {
    return "OPS"
  }

  return "REC"
}

function matchesTeamAccessIdentifier(team: { id: string; slug: string; settings: { joinCode: string } }, value: string) {
  const normalized = value.trim().toLowerCase()

  return (
    team.id.toLowerCase() === normalized ||
    team.slug.toLowerCase() === normalized ||
    team.settings.joinCode.toLowerCase() === normalized
  )
}

type AppCtx = MutationCtx | QueryCtx

async function getWorkspaceDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getTeamDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getUserDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("users")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getUserByEmail(ctx: AppCtx, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique()
}

async function getUserByWorkOSUserId(ctx: AppCtx, workosUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .unique()
}

async function getWorkItemDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workItems")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getDocumentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getConversationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("conversations")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getChannelPostDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("channelPosts")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getAttachmentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("attachments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getViewDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("views")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getNotificationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("notifications")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getInviteByTokenDoc(ctx: AppCtx, token: string) {
  return ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique()
}

async function getAppConfig(ctx: AppCtx) {
  const config = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", "singleton"))
    .unique()
  return config
}

async function getWorkspaceRoleMapForUser(ctx: AppCtx, userId: string) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  const teams = await ctx.db.query("teams").collect()

  return memberships.reduce<Record<string, Array<(typeof memberships)[number]["role"]>>>(
    (accumulator, membership) => {
      const team = teams.find((entry) => entry.id === membership.teamId)
      if (!team) {
        return accumulator
      }

      accumulator[team.workspaceId] = [
        ...(accumulator[team.workspaceId] ?? []),
        membership.role,
      ]

      return accumulator
    },
    {}
  )
}

async function hasBootstrappedAdmin(ctx: AppCtx) {
  const users = await ctx.db.query("users").collect()
  const boundUserIds = new Set(
    users.filter((user) => user.workosUserId).map((user) => user.id)
  )

  if (boundUserIds.size === 0) {
    return false
  }

  const memberships = await ctx.db.query("teamMemberships").collect()
  return memberships.some(
    (membership) =>
      membership.role === "admin" && boundUserIds.has(membership.userId)
  )
}

async function bootstrapFirstAuthenticatedUser(ctx: MutationCtx, userId: string) {
  if (await hasBootstrappedAdmin(ctx)) {
    return false
  }

  const config = await getAppConfig(ctx)
  const templateUserId = config?.currentUserId ?? "user_declan"
  const templateMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", templateUserId))
    .collect()

  if (templateMemberships.length > 0) {
    for (const membership of templateMemberships) {
      await ctx.db.insert("teamMemberships", {
        teamId: membership.teamId,
        userId,
        role: membership.role,
      })
    }

    return true
  }

  const firstTeam = (await ctx.db.query("teams").take(1))[0]

  if (!firstTeam) {
    return false
  }

  await ctx.db.insert("teamMemberships", {
    teamId: firstTeam.id,
    userId,
    role: "admin",
  })

  return true
}

async function getEffectiveRole(ctx: AppCtx, teamId: string, userId: string) {
  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()

  return membership?.role ?? null
}

function isReadOnlyRole(role: Awaited<ReturnType<typeof getEffectiveRole>>) {
  return role === "viewer" || role === "guest" || !role
}

async function requireEditableTeamAccess(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const role = await getEffectiveRole(ctx, teamId, userId)

  if (isReadOnlyRole(role)) {
    throw new Error("Your current role is read-only")
  }

  return role
}

async function requireReadableTeamAccess(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const role = await getEffectiveRole(ctx, teamId, userId)

  if (!role) {
    throw new Error("You do not have access to this team")
  }

  return role
}

async function requireEditableWorkspaceAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspaceRoles = (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []
  const canEdit = workspaceRoles.some((role) => role === "admin" || role === "member")

  if (!canEdit) {
    throw new Error("Your current role is read-only")
  }
}

async function requireEditableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (document.kind === "team-document" || document.kind === "item-description") {
    if (!document.teamId) {
      throw new Error("Document is missing a team")
    }

    await requireEditableTeamAccess(ctx, document.teamId, userId)
    return
  }

  await requireEditableWorkspaceAccess(ctx, document.workspaceId, userId)
}

async function requireWorkspaceAdminAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspaceRoles = (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []

  if (!workspaceRoles.includes("admin")) {
    throw new Error("Only workspace admins can perform this action")
  }
}

async function requireViewMutationAccess(
  ctx: AppCtx,
  viewId: string,
  userId: string
) {
  const view = await getViewDoc(ctx, viewId)

  if (!view) {
    throw new Error("View not found")
  }

  if (view.scopeType === "personal") {
    if (view.scopeId !== userId) {
      throw new Error("You do not have access to this view")
    }

    return view
  }

  if (view.scopeType === "team") {
    await requireEditableTeamAccess(ctx, view.scopeId, userId)
    return view
  }

  await requireEditableWorkspaceAccess(ctx, view.scopeId, userId)
  return view
}

async function requireNotificationOwnership(
  ctx: AppCtx,
  notificationId: string,
  userId: string
) {
  const notification = await getNotificationDoc(ctx, notificationId)

  if (!notification) {
    throw new Error("Notification not found")
  }

  if (notification.userId !== userId) {
    throw new Error("You do not have access to this notification")
  }

  return notification
}

async function resolveAttachmentTarget(
  ctx: MutationCtx,
  targetType: "workItem" | "document",
  targetId: string
) {
  if (targetType === "workItem") {
    const item = await getWorkItemDoc(ctx, targetId)

    if (!item) {
      throw new Error("Work item not found")
    }

    return {
      teamId: item.teamId,
      entityType: "workItem" as const,
      recordId: item._id,
    }
  }

  const document = await getDocumentDoc(ctx, targetId)

  if (!document) {
    throw new Error("Document not found")
  }

  if (!document.teamId) {
    throw new Error("Attachments are only available on team documents")
  }

  return {
    teamId: document.teamId,
    entityType: "document" as const,
    recordId: document._id,
  }
}

async function getTeamMemberIds(ctx: AppCtx, teamId: string) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()

  return memberships.map((membership) => membership.userId)
}

async function getWorkspaceUserIds(ctx: AppCtx, workspaceId: string) {
  const teams = (await ctx.db.query("teams").collect()).filter(
    (team) => team.workspaceId === workspaceId
  )
  const userIds = new Set<string>()

  for (const team of teams) {
    for (const userId of await getTeamMemberIds(ctx, team.id)) {
      userIds.add(userId)
    }
  }

  return [...userIds]
}

async function requireConversationAccess(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  userId: string,
  mode: "read" | "write" = "read"
) {
  if (!conversation) {
    throw new Error("Conversation not found")
  }

  if (conversation.scopeType === "workspace") {
    const workspaceRoles = (await getWorkspaceRoleMapForUser(ctx, userId))[
      conversation.scopeId
    ] ?? []

    if (workspaceRoles.length === 0 || !conversation.participantIds.includes(userId)) {
      throw new Error("You do not have access to this conversation")
    }

    return conversation
  }

  if (mode === "write") {
    await requireEditableTeamAccess(ctx, conversation.scopeId, userId)
  } else {
    await requireReadableTeamAccess(ctx, conversation.scopeId, userId)
  }

  return conversation
}

function createMentionIds(content: string, users: Array<{ id: string; handle: string }>) {
  const handles = [...content.matchAll(/@([a-z0-9_-]+)/gi)].map((match) =>
    match[1]?.toLowerCase()
  )

  return users
    .filter((user) => handles.includes(user.handle.toLowerCase()))
    .map((user) => user.id)
}

function createNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType: "workItem" | "document" | "project" | "invite",
  entityId: string,
  type: "mention" | "assignment" | "comment" | "invite" | "status-change"
) {
  return {
    id: createId("notification"),
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    readAt: null,
    emailedAt: null,
    createdAt: getNow(),
  }
}

function normalizeWorkspace<T extends { workosOrganizationId?: string | null }>(
  workspace: T
) {
  return {
    ...workspace,
    workosOrganizationId: workspace.workosOrganizationId ?? null,
  }
}

function normalizeUser<T extends { workosUserId?: string | null }>(user: T) {
  return {
    ...user,
    workosUserId: user.workosUserId ?? null,
  }
}

function normalizeTeamWorkflowSettings(
  workflow: {
    statusOrder: Array<
      "backlog" | "todo" | "in-progress" | "done" | "cancelled" | "duplicate"
    >
    templateDefaults: Record<
      "software-delivery" | "bug-tracking" | "project-management",
      {
        defaultPriority: "none" | "low" | "medium" | "high" | "urgent"
        targetWindowDays: number
        defaultViewLayout: "list" | "board" | "timeline"
        recommendedItemTypes: Array<
          | "epic"
          | "feature"
          | "requirement"
          | "task"
          | "bug"
          | "sub-task"
          | "qa-task"
          | "test-case"
        >
        summaryHint: string
      }
    >
  } | null | undefined
) {
  const defaults = createDefaultTeamWorkflowSettings()

  if (!workflow) {
    return defaults
  }

  return {
    statusOrder:
      workflow.statusOrder.length === defaults.statusOrder.length
        ? workflow.statusOrder
        : defaults.statusOrder,
    templateDefaults: {
      "software-delivery": {
        ...defaults.templateDefaults["software-delivery"],
        ...workflow.templateDefaults["software-delivery"],
      },
      "bug-tracking": {
        ...defaults.templateDefaults["bug-tracking"],
        ...workflow.templateDefaults["bug-tracking"],
      },
      "project-management": {
        ...defaults.templateDefaults["project-management"],
        ...workflow.templateDefaults["project-management"],
      },
    },
  }
}

function normalizeTeamFeatures(
  experience: "software-development" | "issue-analysis" | "community" | null | undefined,
  features:
    | {
        issues: boolean
        projects: boolean
        views: boolean
        docs: boolean
        chat: boolean
        channels: boolean
      }
    | null
    | undefined
) {
  const resolvedExperience = experience ?? "software-development"
  const merged = {
    ...createDefaultTeamFeatureSettings(resolvedExperience),
    ...(features ?? {}),
  }
  const validationMessage = getTeamFeatureValidationMessage(
    resolvedExperience,
    merged
  )

  if (validationMessage) {
    return createDefaultTeamFeatureSettings(resolvedExperience)
  }

  return merged
}

function normalizeTeam<T extends { settings: Record<string, unknown> }>(team: T) {
  const settings = team.settings as {
    experience?: "software-development" | "issue-analysis" | "community"
    features?: {
      issues: boolean
      projects: boolean
      views: boolean
      docs: boolean
      chat: boolean
      channels: boolean
    }
    workflow?: Parameters<typeof normalizeTeamWorkflowSettings>[0]
  }

  return {
    ...team,
    settings: {
      ...team.settings,
      experience: settings.experience ?? "software-development",
      features: normalizeTeamFeatures(settings.experience, settings.features),
      workflow: normalizeTeamWorkflowSettings(
        settings.workflow
      ),
    },
  }
}

async function insertSeedData(ctx: MutationCtx) {
  const seed = createSeedState()

  await ctx.db.insert("appConfig", {
    key: "singleton",
    currentUserId: seed.currentUserId,
    currentWorkspaceId: seed.currentWorkspaceId,
  })

  for (const workspace of seed.workspaces) {
    await ctx.db.insert("workspaces", workspace)
  }

  for (const team of seed.teams) {
    await ctx.db.insert("teams", team)
  }

  for (const membership of seed.teamMemberships) {
    await ctx.db.insert("teamMemberships", membership)
  }

  for (const user of seed.users) {
    await ctx.db.insert("users", user)
  }

  for (const label of seed.labels) {
    await ctx.db.insert("labels", label)
  }

  for (const project of seed.projects) {
    await ctx.db.insert("projects", project)
  }

  for (const milestone of seed.milestones) {
    await ctx.db.insert("milestones", milestone)
  }

  for (const workItem of seed.workItems) {
    await ctx.db.insert("workItems", workItem)
  }

  for (const document of seed.documents) {
    await ctx.db.insert("documents", document)
  }

  for (const view of seed.views) {
    await ctx.db.insert("views", view)
  }

  for (const comment of seed.comments) {
    await ctx.db.insert("comments", comment)
  }

  for (const attachment of seed.attachments) {
    await ctx.db.insert("attachments", {
      ...attachment,
      storageId: attachment.storageId as never,
    })
  }

  for (const notification of seed.notifications) {
    await ctx.db.insert("notifications", notification)
  }

  for (const invite of seed.invites) {
    await ctx.db.insert("invites", invite)
  }

  for (const update of seed.projectUpdates) {
    await ctx.db.insert("projectUpdates", update)
  }

  for (const conversation of seed.conversations) {
    await ctx.db.insert("conversations", conversation)
  }

  for (const message of seed.chatMessages) {
    await ctx.db.insert("chatMessages", message)
  }

  for (const post of seed.channelPosts) {
    await ctx.db.insert("channelPosts", post)
  }

  for (const comment of seed.channelPostComments) {
    await ctx.db.insert("channelPostComments", comment)
  }
}

export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("workspaces").take(1)

    if (existing.length > 0) {
      return { seeded: false }
    }

    await insertSeedData(ctx)

    return { seeded: true }
  },
})

export const bootstrapAppWorkspace = mutation({
  args: {
    workspaceSlug: v.string(),
    workspaceName: v.string(),
    workspaceLogoUrl: v.string(),
    workspaceAccent: v.string(),
    workspaceDescription: v.string(),
    teamSlug: v.string(),
    teamName: v.string(),
    teamIcon: v.string(),
    teamSummary: v.string(),
    teamJoinCode: v.string(),
    email: v.string(),
    userName: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
    role: v.optional(roleValidator),
  },
  handler: async (ctx, args) => {
    const workspaceSlug = createSlug(args.workspaceSlug)
    const teamSlug = createSlug(args.teamSlug)
    const joinCode = normalizeJoinCode(args.teamJoinCode)

    const workspaces = await ctx.db.query("workspaces").collect()
    const teams = await ctx.db.query("teams").collect()
    const role = args.role ?? "admin"

    const workspace = workspaces.find((entry) => entry.slug === workspaceSlug) ?? null
    const workspaceId = workspace?.id ?? `workspace_${workspaceSlug.replace(/-/g, "_")}`
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
    const workflow = team
      ? normalizeTeamWorkflowSettings(team.settings.workflow)
      : createDefaultTeamWorkflowSettings()

    if (team) {
      await ctx.db.patch(team._id, {
        slug: teamSlug,
        name: args.teamName,
        icon: args.teamIcon,
        settings: {
          ...team.settings,
          joinCode,
          summary: args.teamSummary,
          experience:
            (team.settings as { experience?: "software-development" }).experience ??
            "software-development",
          features: normalizeTeamFeatures(
            (team.settings as {
              experience?: "software-development" | "issue-analysis" | "community"
            }).experience,
            (team.settings as {
              features?: {
                issues: boolean
                projects: boolean
                views: boolean
                docs: boolean
                chat: boolean
                channels: boolean
              }
            }).features
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
        icon: args.teamIcon,
        settings: {
          joinCode,
          summary: args.teamSummary,
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: createDefaultTeamFeatureSettings("software-development"),
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
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
        },
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

    const config = await getAppConfig(ctx)

    if (config) {
      await ctx.db.patch(config._id, {
        currentUserId: userId,
        currentWorkspaceId: workspaceId,
      })
    } else {
      await ctx.db.insert("appConfig", {
        key: "singleton",
        currentUserId: userId,
        currentWorkspaceId: workspaceId,
      })
    }

    return {
      workspaceId,
      workspaceSlug,
      teamId,
      teamSlug,
      userId,
      role,
      workosOrganizationId,
    }
  },
})

export const getSnapshot = query({
  args: {
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await getAppConfig(ctx)
    const workspaces = await ctx.db.query("workspaces").collect()
    const teams = await ctx.db.query("teams").collect()
    const teamMemberships = await ctx.db.query("teamMemberships").collect()
    const authenticatedUser = args.email ? await getUserByEmail(ctx, args.email) : null
    const firstUser = (await ctx.db.query("users").take(1))[0]
    const currentUserId = authenticatedUser?.id ?? config?.currentUserId ?? firstUser?.id ?? ""
    const currentUserMembership = teamMemberships.find(
      (membership) => membership.userId === currentUserId
    )
    const membershipWorkspaceId =
      teams.find((team) => team.id === currentUserMembership?.teamId)?.workspaceId ?? null
    const fallbackWorkspaceId =
      membershipWorkspaceId ?? config?.currentWorkspaceId ?? workspaces[0]?.id ?? ""
    const currentWorkspaceId =
      membershipWorkspaceId ?? fallbackWorkspaceId

    const attachments = await Promise.all(
      (await ctx.db.query("attachments").collect()).map(async (attachment) => ({
        ...attachment,
        fileUrl: await ctx.storage.getUrl(attachment.storageId),
      }))
    )

    return {
      currentUserId,
      currentWorkspaceId,
      workspaces: workspaces.map(normalizeWorkspace),
      teams: teams.map(normalizeTeam),
      teamMemberships,
      users: (await ctx.db.query("users").collect()).map(normalizeUser),
      labels: await ctx.db.query("labels").collect(),
      projects: await ctx.db.query("projects").collect(),
      milestones: await ctx.db.query("milestones").collect(),
      workItems: await ctx.db.query("workItems").collect(),
      documents: await ctx.db.query("documents").collect(),
      views: await ctx.db.query("views").collect(),
      comments: await ctx.db.query("comments").collect(),
      attachments,
      notifications: await ctx.db.query("notifications").collect(),
      invites: await ctx.db.query("invites").collect(),
      projectUpdates: await ctx.db.query("projectUpdates").collect(),
      conversations: await ctx.db.query("conversations").collect(),
      chatMessages: await ctx.db.query("chatMessages").collect(),
      channelPosts: await ctx.db.query("channelPosts").collect(),
      channelPostComments: await ctx.db.query("channelPostComments").collect(),
    }
  },
})

export const getAuthContext = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.email)

    if (!user) {
      return null
    }

    const config = await getAppConfig(ctx)
    const teams = await ctx.db.query("teams").collect()
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .collect()
    const workspaceRoleMap = await getWorkspaceRoleMapForUser(ctx, user.id)
    const accessibleWorkspaceIds = [...new Set(
      memberships
        .map((membership) => teams.find((team) => team.id === membership.teamId)?.workspaceId)
        .filter(Boolean)
    )]
    const preferredWorkspaceId = accessibleWorkspaceIds.includes(
      config?.currentWorkspaceId ?? ""
    )
      ? config?.currentWorkspaceId ?? null
      : accessibleWorkspaceIds[0] ?? config?.currentWorkspaceId ?? null
    const currentWorkspace = preferredWorkspaceId
      ? await getWorkspaceDoc(ctx, preferredWorkspaceId)
      : null

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
      currentWorkspace: currentWorkspace
        ? {
            id: currentWorkspace.id,
            slug: currentWorkspace.slug,
            name: currentWorkspace.name,
            logoUrl: currentWorkspace.logoUrl,
            workosOrganizationId: currentWorkspace.workosOrganizationId ?? null,
          }
        : null,
      isWorkspaceAdmin:
        preferredWorkspaceId === null
          ? false
          : (workspaceRoleMap[preferredWorkspaceId] ?? []).includes("admin"),
    }
  },
})

export const ensureUserFromAuth = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing =
      (await getUserByWorkOSUserId(ctx, args.workosUserId)) ??
      (await getUserByEmail(ctx, args.email))

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        avatarUrl: args.avatarUrl,
        workosUserId: args.workosUserId,
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
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
      },
    })

    const bootstrapped = await bootstrapFirstAuthenticatedUser(ctx, newUserId)

    return {
      userId: newUserId,
      bootstrapped,
    }
  },
})

export const bootstrapWorkspaceUser = mutation({
  args: {
    workspaceSlug: v.string(),
    teamSlug: v.string(),
    existingUserId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
    role: v.optional(roleValidator),
  },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db.query("workspaces").collect()
    const workspace = workspaces.find((entry) => entry.slug === args.workspaceSlug)

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

    const existingByWorkOSUserId = await getUserByWorkOSUserId(ctx, args.workosUserId)
    const existingByEmail = await getUserByEmail(ctx, args.email)
    const preferredUser = args.existingUserId
      ? await getUserDoc(ctx, args.existingUserId)
      : null
    const resolvedUser =
      preferredUser ?? existingByWorkOSUserId ?? existingByEmail ?? null

    if (
      preferredUser &&
      ((existingByWorkOSUserId && existingByWorkOSUserId.id !== preferredUser.id) ||
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
        avatarUrl: args.avatarUrl,
        workosUserId: args.workosUserId,
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
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
        },
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

    const config = await getAppConfig(ctx)

    if (config) {
      await ctx.db.patch(config._id, {
        currentUserId: userId,
        currentWorkspaceId: workspace.id,
      })
    }

    return {
      userId,
      teamId: team.id,
      workspaceId: workspace.id,
      workosOrganizationId: workspace.workosOrganizationId ?? null,
      role,
    }
  },
})

export const getInviteByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await getInviteByTokenDoc(ctx, args.token)

    if (!invite) {
      return null
    }

    const team = await getTeamDoc(ctx, invite.teamId)
    const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)

    return {
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
      },
      team: team
        ? {
            id: team.id,
            slug: team.slug,
            name: team.name,
          }
        : null,
      workspace: workspace
        ? {
            id: workspace.id,
            slug: workspace.slug,
            name: workspace.name,
          }
        : null,
    }
  },
})

export const lookupTeamByJoinCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const teams = await ctx.db.query("teams").collect()
    const team = teams.find((entry) => matchesTeamAccessIdentifier(entry, args.code))

    if (!team) {
      return null
    }

    const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

    if (!workspace) {
      return null
    }

    return {
      team: {
        id: team.id,
        slug: team.slug,
        name: team.name,
        summary: team.settings.summary,
        joinCode: team.settings.joinCode,
        workflow: normalizeTeamWorkflowSettings(team.settings.workflow),
      },
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        logoUrl: workspace.logoUrl,
      },
    }
  },
})

export const listWorkspacesForSync = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect()

    return workspaces.map((workspace) => ({
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      workosOrganizationId: workspace.workosOrganizationId ?? null,
    }))
  },
})

export const listPendingNotificationDigests = query({
  args: {},
  handler: async (ctx) => {
    const users = (await ctx.db.query("users").collect()).map(normalizeUser)
    const notifications = await ctx.db.query("notifications").collect()

    return users
      .filter((user) => user.preferences.emailDigest)
      .map((user) => {
        const pendingNotifications = notifications
          .filter(
            (notification) =>
              notification.userId === user.id &&
              !notification.readAt &&
              !notification.emailedAt
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

        if (pendingNotifications.length === 0) {
          return null
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          notifications: pendingNotifications.map((notification) => ({
            id: notification.id,
            message: notification.message,
            entityId: notification.entityId,
            entityType: notification.entityType,
            type: notification.type,
            createdAt: notification.createdAt,
          })),
        }
      })
      .filter(Boolean)
  },
})

export const markNotificationRead = mutation({
  args: {
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await requireNotificationOwnership(
      ctx,
      args.notificationId,
      args.currentUserId
    )

    await ctx.db.patch(notification._id, {
      readAt: notification.readAt ?? getNow(),
    })
  },
})

export const markNotificationsEmailed = mutation({
  args: {
    notificationIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = getNow()

    for (const notificationId of args.notificationIds) {
      const notification = await getNotificationDoc(ctx, notificationId)

      if (!notification) {
        continue
      }

      await ctx.db.patch(notification._id, {
        emailedAt: now,
      })
    }
  },
})

export const toggleNotificationRead = mutation({
  args: {
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await requireNotificationOwnership(
      ctx,
      args.notificationId,
      args.currentUserId
    )

    await ctx.db.patch(notification._id, {
      readAt: notification.readAt ? null : getNow(),
    })
  },
})

export const updateWorkspaceBranding = mutation({
  args: {
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    logoUrl: v.string(),
    accent: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await getWorkspaceDoc(ctx, args.workspaceId)

    if (!workspace) {
      return
    }

    await requireWorkspaceAdminAccess(ctx, args.workspaceId, args.currentUserId)

    await ctx.db.patch(workspace._id, {
      name: args.name,
      logoUrl: args.logoUrl,
      settings: {
        ...workspace.settings,
        accent: args.accent,
        description: args.description,
      },
    })
  },
})

export const setWorkspaceWorkosOrganization = mutation({
  args: {
    workspaceId: v.string(),
    workosOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
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
  },
})

export const updateCurrentUserProfile = mutation({
  args: {
    currentUserId: v.string(),
    userId: v.string(),
    name: v.string(),
    title: v.string(),
    avatarUrl: v.string(),
    preferences: v.object({
      emailMentions: v.boolean(),
      emailAssignments: v.boolean(),
      emailDigest: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    if (args.currentUserId !== args.userId) {
      throw new Error("You can only update your own profile")
    }

    const user = await getUserDoc(ctx, args.userId)

    if (!user) {
      return
    }

    await ctx.db.patch(user._id, {
      name: args.name,
      title: args.title,
      avatarUrl: args.avatarUrl,
      preferences: args.preferences,
    })
  },
})

export const updateTeamDetails = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    name: v.string(),
    icon: v.string(),
    summary: v.string(),
    joinCode: v.string(),
    experience: teamExperienceTypeValidator,
    features: teamFeatureSettingsValidator,
  },
  handler: async (ctx, args) => {
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

    await ctx.db.patch(team._id, {
      name: args.name,
      icon: args.icon,
      settings: {
        ...team.settings,
        summary: args.summary,
        joinCode: normalizeJoinCode(args.joinCode),
        experience: args.experience,
        features: normalizeTeamFeatures(args.experience, args.features),
      },
    })

    return {
      teamId: team.id,
      joinCode: normalizeJoinCode(args.joinCode),
      experience: args.experience,
      features: normalizeTeamFeatures(args.experience, args.features),
    }
  },
})

export const updateTeamWorkflowSettings = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    workflow: teamWorkflowSettingsValidator,
  },
  handler: async (ctx, args) => {
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
  },
})

export const updateViewConfig = mutation({
  args: {
    currentUserId: v.string(),
    viewId: v.string(),
    layout: v.optional(v.union(v.literal("list"), v.literal("board"), v.literal("timeline"))),
    grouping: v.optional(groupFieldValidator),
    subGrouping: v.optional(v.union(groupFieldValidator, v.null())),
    ordering: v.optional(orderingFieldValidator),
    showCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(ctx, args.viewId, args.currentUserId)

    await ctx.db.patch(view._id, {
      layout: args.layout ?? view.layout,
      grouping: args.grouping ?? view.grouping,
      subGrouping:
        args.subGrouping === undefined ? view.subGrouping : args.subGrouping,
      ordering: args.ordering ?? view.ordering,
      filters:
        args.showCompleted === undefined
          ? view.filters
          : {
              ...view.filters,
              showCompleted: args.showCompleted,
            },
      updatedAt: getNow(),
    })
  },
})

export const toggleViewDisplayProperty = mutation({
  args: {
    currentUserId: v.string(),
    viewId: v.string(),
    property: displayPropertyValidator,
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(ctx, args.viewId, args.currentUserId)

    const nextDisplayProps = view.displayProps.includes(args.property)
      ? view.displayProps.filter((value: string) => value !== args.property)
      : [...view.displayProps, args.property]

    await ctx.db.patch(view._id, {
      displayProps: nextDisplayProps,
      updatedAt: getNow(),
    })
  },
})

export const toggleViewHiddenValue = mutation({
  args: {
    currentUserId: v.string(),
    viewId: v.string(),
    key: v.union(v.literal("groups"), v.literal("subgroups")),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(ctx, args.viewId, args.currentUserId)

    const current = view.hiddenState[args.key]
    const nextValues = current.includes(args.value)
      ? current.filter((entry: string) => entry !== args.value)
      : [...current, args.value]

    await ctx.db.patch(view._id, {
      hiddenState: {
        ...view.hiddenState,
        [args.key]: nextValues,
      },
      updatedAt: getNow(),
    })
  },
})

export const toggleViewFilterValue = mutation({
  args: {
    currentUserId: v.string(),
    viewId: v.string(),
    key: v.union(
      v.literal("status"),
      v.literal("priority"),
      v.literal("assigneeIds"),
      v.literal("projectIds"),
      v.literal("itemTypes"),
      v.literal("labelIds")
    ),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(ctx, args.viewId, args.currentUserId)

    const current = [...(view.filters[args.key] as string[])]
    const next = current.includes(args.value)
      ? current.filter((entry) => entry !== args.value)
      : [...current, args.value]

    await ctx.db.patch(view._id, {
      filters: {
        ...view.filters,
        [args.key]: next,
      },
      updatedAt: getNow(),
    })
  },
})

export const updateWorkItem = mutation({
  args: {
    currentUserId: v.string(),
    itemId: v.string(),
    patch: v.object({
      status: v.optional(workStatusValidator),
      priority: v.optional(priorityValidator),
      assigneeId: v.optional(nullableStringValidator),
      primaryProjectId: v.optional(nullableStringValidator),
      startDate: v.optional(nullableStringValidator),
      dueDate: v.optional(nullableStringValidator),
      targetDate: v.optional(nullableStringValidator),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await getWorkItemDoc(ctx, args.itemId)

    if (!existing) {
      return {
        assignmentEmails: [],
      }
    }

    await requireEditableTeamAccess(ctx, existing.teamId, args.currentUserId)

    const actor = await getUserDoc(ctx, args.currentUserId)
    const assignmentEmails: Array<{
      notificationId: string
      email: string
      name: string
      itemTitle: string
      itemId: string
      actorName: string
    }> = []

    await ctx.db.patch(existing._id, {
      ...args.patch,
      updatedAt: getNow(),
    })

    if (
      args.patch.assigneeId !== undefined &&
      args.patch.assigneeId &&
      args.patch.assigneeId !== existing.assigneeId &&
      args.patch.assigneeId !== args.currentUserId
    ) {
      const assignee = await getUserDoc(ctx, args.patch.assigneeId)
      const notification = createNotification(
        args.patch.assigneeId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} assigned you ${existing.title}`,
        "workItem",
        existing.id,
        "assignment"
      )

      await ctx.db.insert(
        "notifications",
        notification
      )

      if (assignee?.preferences.emailAssignments) {
        assignmentEmails.push({
          notificationId: notification.id,
          email: assignee.email,
          name: assignee.name,
          itemTitle: existing.title,
          itemId: existing.id,
          actorName: actor?.name ?? "Someone",
        })
      }
    }

    if (
      args.patch.status &&
      args.patch.status !== existing.status &&
      existing.creatorId !== args.currentUserId
    ) {
      await ctx.db.insert(
        "notifications",
        createNotification(
          existing.creatorId,
          args.currentUserId,
          `${existing.title} moved to ${args.patch.status}`,
          "workItem",
          existing.id,
          "status-change"
        )
      )
    }

    return {
      assignmentEmails,
    }
  },
})

export const shiftTimelineItem = mutation({
  args: {
    currentUserId: v.string(),
    itemId: v.string(),
    nextStartDate: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await getWorkItemDoc(ctx, args.itemId)

    if (!item || !item.startDate) {
      return
    }

    await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

    const delta = differenceInCalendarDays(
      new Date(args.nextStartDate),
      new Date(item.startDate)
    )

    await ctx.db.patch(item._id, {
      startDate: args.nextStartDate,
      dueDate: item.dueDate
        ? addDays(new Date(item.dueDate), delta).toISOString()
        : item.dueDate,
      targetDate: item.targetDate
        ? addDays(new Date(item.targetDate), delta).toISOString()
        : item.targetDate,
      updatedAt: getNow(),
    })
  },
})

export const updateDocumentContent = mutation({
  args: {
    currentUserId: v.string(),
    documentId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await getDocumentDoc(ctx, args.documentId)

    if (!document) {
      return
    }

    await requireEditableDocumentAccess(ctx, document, args.currentUserId)

    await ctx.db.patch(document._id, {
      content: args.content,
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  },
})

export const renameDocument = mutation({
  args: {
    currentUserId: v.string(),
    documentId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await getDocumentDoc(ctx, args.documentId)

    if (!document) {
      return
    }

    await requireEditableDocumentAccess(ctx, document, args.currentUserId)

    await ctx.db.patch(document._id, {
      title: args.title,
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })
  },
})

export const updateItemDescription = mutation({
  args: {
    currentUserId: v.string(),
    itemId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await getWorkItemDoc(ctx, args.itemId)

    if (!item) {
      return
    }

    await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

    const descriptionDocument = await getDocumentDoc(ctx, item.descriptionDocId)

    if (!descriptionDocument) {
      return
    }

    await ctx.db.patch(descriptionDocument._id, {
      content: args.content,
      updatedAt: getNow(),
      updatedBy: args.currentUserId,
    })

    await ctx.db.patch(item._id, {
      updatedAt: getNow(),
    })
  },
})

export const generateAttachmentUploadUrl = mutation({
  args: {
    currentUserId: v.string(),
    targetType: attachmentTargetTypeValidator,
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const target = await resolveAttachmentTarget(ctx, args.targetType, args.targetId)
    await requireEditableTeamAccess(ctx, target.teamId, args.currentUserId)

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    }
  },
})

export const createAttachment = mutation({
  args: {
    currentUserId: v.string(),
    targetType: attachmentTargetTypeValidator,
    targetId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const target = await resolveAttachmentTarget(ctx, args.targetType, args.targetId)
    await requireEditableTeamAccess(ctx, target.teamId, args.currentUserId)

    const metadata = await ctx.storage.getMetadata(args.storageId)

    if (!metadata) {
      throw new Error("Uploaded file not found")
    }

    if ((metadata.size ?? args.size) <= 0) {
      throw new Error("File is empty")
    }

    const attachment = {
      id: createId("attachment"),
      targetType: args.targetType,
      targetId: args.targetId,
      teamId: target.teamId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType || metadata.contentType || "application/octet-stream",
      size: metadata.size ?? args.size,
      uploadedBy: args.currentUserId,
      createdAt: getNow(),
    }

    await ctx.db.insert("attachments", attachment)
    if (target.entityType === "workItem") {
      await ctx.db.patch(target.recordId, {
        updatedAt: getNow(),
      })
    } else {
      await ctx.db.patch(target.recordId, {
        updatedAt: getNow(),
        updatedBy: args.currentUserId,
      })
    }

    return {
      attachmentId: attachment.id,
      fileUrl: await ctx.storage.getUrl(args.storageId),
    }
  },
})

export const deleteAttachment = mutation({
  args: {
    currentUserId: v.string(),
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const attachment = await getAttachmentDoc(ctx, args.attachmentId)

    if (!attachment) {
      throw new Error("Attachment not found")
    }

    await requireEditableTeamAccess(ctx, attachment.teamId, args.currentUserId)
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete(attachment._id)

    const target = await resolveAttachmentTarget(
      ctx,
      attachment.targetType,
      attachment.targetId
    )

    if (target.entityType === "workItem") {
      await ctx.db.patch(target.recordId, {
        updatedAt: getNow(),
      })
    } else {
      await ctx.db.patch(target.recordId, {
        updatedAt: getNow(),
        updatedBy: args.currentUserId,
      })
    }

    return {
      attachmentId: attachment.id,
    }
  },
})

export const addComment = mutation({
  args: {
    currentUserId: v.string(),
    targetType: commentTargetTypeValidator,
    targetId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    let teamId = ""
    let followerIds: string[] = []
    let entityType: "workItem" | "document" = "workItem"
    let entityTitle = "item"

    if (args.targetType === "workItem") {
      const item = await getWorkItemDoc(ctx, args.targetId)
      if (!item) {
        return
      }

      teamId = item.teamId
      followerIds = [...item.subscriberIds, item.creatorId, item.assigneeId ?? ""].filter(
        Boolean
      )
      entityTitle = item.title

      await ctx.db.patch(item._id, {
        updatedAt: getNow(),
      })
    } else {
      const document = await getDocumentDoc(ctx, args.targetId)
      if (!document) {
        return
      }

      if (!document.teamId) {
        throw new Error("Comments are only available on team documents")
      }

      teamId = document.teamId
      followerIds = [document.createdBy, document.updatedBy]
      entityType = "document"
      entityTitle = document.title

      await ctx.db.patch(document._id, {
        updatedAt: getNow(),
        updatedBy: args.currentUserId,
      })
    }

    await requireEditableTeamAccess(ctx, teamId, args.currentUserId)

    const users = await ctx.db.query("users").collect()
    const actor = users.find((user) => user.id === args.currentUserId)
    const mentionUserIds = createMentionIds(args.content, users)
    const notifiedUserIds = new Set<string>()
    const mentionEmails: Array<{
      notificationId: string
      email: string
      name: string
      entityTitle: string
      entityType: "workItem" | "document"
      entityId: string
      actorName: string
      commentHtml: string
    }> = []

    await ctx.db.insert("comments", {
      id: createId("comment"),
      targetType: args.targetType,
      targetId: args.targetId,
      parentCommentId: null,
      content: args.content.trim(),
      mentionUserIds,
      createdBy: args.currentUserId,
      createdAt: getNow(),
    })

    for (const mentionedUserId of mentionUserIds) {
      if (mentionedUserId === args.currentUserId || notifiedUserIds.has(mentionedUserId)) {
        continue
      }

      const mentionedUser = users.find((user) => user.id === mentionedUserId)
      const notification = createNotification(
        mentionedUserId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
        entityType,
        args.targetId,
        "mention"
      )

      await ctx.db.insert(
        "notifications",
        notification
      )

      if (mentionedUser?.preferences.emailMentions) {
        mentionEmails.push({
          notificationId: notification.id,
          email: mentionedUser.email,
          name: mentionedUser.name,
          entityTitle,
          entityType,
          entityId: args.targetId,
          actorName: actor?.name ?? "Someone",
          commentHtml: args.content.trim(),
        })
      }
      notifiedUserIds.add(mentionedUserId)
    }

    for (const followerId of followerIds) {
      if (!followerId || followerId === args.currentUserId || notifiedUserIds.has(followerId)) {
        continue
      }

      await ctx.db.insert(
        "notifications",
        createNotification(
          followerId,
          args.currentUserId,
          `${actor?.name ?? "Someone"} commented on ${entityTitle}`,
          entityType,
          args.targetId,
          "comment"
        )
      )
      notifiedUserIds.add(followerId)
    }

    return {
      mentionEmails,
    }
  },
})

export const createInvite = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    email: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      return
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
      role: args.role,
      token: createId("token"),
      joinCode: team.settings.joinCode,
      invitedBy: args.currentUserId,
      expiresAt: addDays(new Date(), 7).toISOString(),
      acceptedAt: null,
    }

    await ctx.db.insert("invites", invite)

    const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

    return {
      invite,
      teamName: team.name,
      workspaceName: workspace?.name ?? "Workspace",
    }
  },
})

export const acceptInvite = mutation({
  args: {
    currentUserId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await getInviteByTokenDoc(ctx, args.token)

    if (!invite) {
      throw new Error("Invite not found")
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

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: invite.role,
      })
    } else {
      await ctx.db.insert("teamMemberships", {
        teamId: invite.teamId,
        userId: args.currentUserId,
        role: invite.role,
      })
    }

    await ctx.db.patch(invite._id, {
      acceptedAt: getNow(),
    })

    const team = await getTeamDoc(ctx, invite.teamId)
    const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)
    const config = await getAppConfig(ctx)

    if (config) {
      await ctx.db.patch(config._id, {
        currentWorkspaceId: invite.workspaceId,
      })
    }

    await ctx.db.insert(
      "notifications",
      createNotification(
        args.currentUserId,
        args.currentUserId,
        `You joined ${team?.name ?? "the team"} as ${invite.role}`,
        "invite",
        invite.teamId,
        "invite"
      )
    )

    return {
      teamSlug: team?.slug ?? null,
      workspaceId: invite.workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      workosOrganizationId: workspace?.workosOrganizationId ?? null,
    }
  },
})

export const joinTeamByCode = mutation({
  args: {
    currentUserId: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const teams = await ctx.db.query("teams").collect()
    const team = teams.find((entry) => matchesTeamAccessIdentifier(entry, args.code))

    if (!team) {
      throw new Error("Join code not found")
    }

    const existingMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team.id).eq("userId", args.currentUserId)
      )
      .unique()

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: "viewer",
      })
    } else {
      await ctx.db.insert("teamMemberships", {
        teamId: team.id,
        userId: args.currentUserId,
        role: "viewer",
      })
    }

    const config = await getAppConfig(ctx)
    if (config) {
      await ctx.db.patch(config._id, {
        currentWorkspaceId: team.workspaceId,
      })
    }

    await ctx.db.insert(
      "notifications",
      createNotification(
        args.currentUserId,
        args.currentUserId,
        `You joined ${team.name} as a viewer`,
        "invite",
        team.id,
        "invite"
      )
    )

    const workspace = await getWorkspaceDoc(ctx, team.workspaceId)

    return {
      teamSlug: team.slug,
      workspaceId: team.workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      workspaceName: workspace?.name ?? "Workspace",
      workosOrganizationId: workspace?.workosOrganizationId ?? null,
    }
  },
})

export const createProject = mutation({
  args: {
    currentUserId: v.string(),
    scopeType: scopeTypeValidator,
    scopeId: v.string(),
    templateType: templateTypeValidator,
    name: v.string(),
    summary: v.string(),
    priority: priorityValidator,
    settingsTeamId: v.optional(nullableStringValidator),
  },
  handler: async (ctx, args) => {
    let settingsTeam = null

    if (args.scopeType === "team") {
      await requireEditableTeamAccess(ctx, args.scopeId, args.currentUserId)
      settingsTeam = await getTeamDoc(ctx, args.scopeId)
    } else {
      await requireEditableWorkspaceAccess(ctx, args.scopeId, args.currentUserId)

      if (args.settingsTeamId) {
        settingsTeam = await getTeamDoc(ctx, args.settingsTeamId)

        if (!settingsTeam) {
          throw new Error("Settings team not found")
        }

        if (settingsTeam.workspaceId !== args.scopeId) {
          throw new Error("Settings team must belong to the current workspace")
        }

        await requireEditableTeamAccess(ctx, settingsTeam.id, args.currentUserId)
      }
    }

    const workflow = normalizeTeamWorkflowSettings(settingsTeam?.settings.workflow)
    const templateDefaults = workflow.templateDefaults[args.templateType]
    const now = new Date()

    await ctx.db.insert("projects", {
      id: createId("project"),
      scopeType: args.scopeType,
      scopeId: args.scopeId,
      templateType: args.templateType,
      name: args.name,
      summary: args.summary,
      description: `${args.name} was created from the ${args.templateType} template.`,
      leadId: args.currentUserId,
      memberIds: [args.currentUserId],
      health: "no-update",
      priority: args.priority,
      status: "planning",
      startDate: getNow(),
      targetDate: addDays(now, templateDefaults.targetWindowDays).toISOString(),
      createdAt: getNow(),
      updatedAt: getNow(),
    })
  },
})

export const createDocument = mutation({
  args: {
    currentUserId: v.string(),
    kind: v.union(
      v.literal("team-document"),
      v.literal("workspace-document"),
      v.literal("private-document")
    ),
    teamId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const workspaceId =
      args.kind === "team-document"
        ? (await getTeamDoc(ctx, args.teamId ?? ""))?.workspaceId ?? ""
        : args.workspaceId ?? ""

    if (args.kind === "team-document") {
      if (!args.teamId) {
        throw new Error("Team is required")
      }

      await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    } else {
      if (!workspaceId) {
        throw new Error("Workspace is required")
      }

      await requireEditableWorkspaceAccess(ctx, workspaceId, args.currentUserId)
    }

    const contentTemplate =
      args.kind === "private-document"
        ? "New private document."
        : args.kind === "workspace-document"
          ? "New workspace document."
          : "New team document."

    await ctx.db.insert("documents", {
      id: createId("document"),
      kind: args.kind,
      workspaceId,
      teamId: args.kind === "team-document" ? args.teamId ?? null : null,
      title: args.title,
      content: `<h1>${args.title}</h1><p>${contentTemplate}</p>`,
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: args.currentUserId,
      updatedBy: args.currentUserId,
      createdAt: getNow(),
      updatedAt: getNow(),
    })
  },
})

export const createWorkItem = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    type: workItemTypeValidator,
    title: v.string(),
    primaryProjectId: nullableStringValidator,
    assigneeId: nullableStringValidator,
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    const teamItems = await ctx.db
      .query("workItems")
      .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
      .collect()

    const prefix = toKeyPrefix(args.teamId)
    const nextNumber = 1 + teamItems.length + 100
    const descriptionDocId = createId("doc")

    await ctx.db.insert("documents", {
      id: descriptionDocId,
      kind: "item-description",
      workspaceId: team?.workspaceId ?? "",
      teamId: args.teamId,
      title: `${args.title} description`,
      content: `<p>Add a fuller description for ${args.title}.</p>`,
      linkedProjectIds: args.primaryProjectId ? [args.primaryProjectId] : [],
      linkedWorkItemIds: [],
      createdBy: args.currentUserId,
      updatedBy: args.currentUserId,
      createdAt: getNow(),
      updatedAt: getNow(),
    })

    const workItem = {
      id: createId("item"),
      key: `${prefix}-${nextNumber}`,
      teamId: args.teamId,
      type: args.type,
      title: args.title,
      descriptionDocId,
      status: "backlog" as const,
      priority: args.priority,
      assigneeId: args.assigneeId,
      creatorId: args.currentUserId,
      parentId: null,
      primaryProjectId: args.primaryProjectId,
      linkedProjectIds: [],
      linkedDocumentIds: [],
      labelIds: [],
      milestoneId: null,
      startDate: getNow(),
      dueDate: addDays(new Date(), 7).toISOString(),
      targetDate: addDays(new Date(), 10).toISOString(),
      subscriberIds: [args.currentUserId],
      createdAt: getNow(),
      updatedAt: getNow(),
    }

    await ctx.db.insert("workItems", workItem)

    const assignmentEmails: Array<{
      notificationId: string
      email: string
      name: string
      itemTitle: string
      itemId: string
      actorName: string
    }> = []

    if (args.assigneeId && args.assigneeId !== args.currentUserId) {
      const actor = await getUserDoc(ctx, args.currentUserId)
      const assignee = await getUserDoc(ctx, args.assigneeId)
      const notification = createNotification(
        args.assigneeId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} assigned you ${args.title}`,
        "workItem",
        workItem.id,
        "assignment"
      )

      await ctx.db.insert("notifications", notification)

      if (assignee?.preferences.emailAssignments) {
        assignmentEmails.push({
          notificationId: notification.id,
          email: assignee.email,
          name: assignee.name,
          itemTitle: args.title,
          itemId: workItem.id,
          actorName: actor?.name ?? "Someone",
        })
      }
    }

    return {
      itemId: workItem.id,
      assignmentEmails,
    }
  },
})

export const createWorkspaceChat = mutation({
  args: {
    currentUserId: v.string(),
    workspaceId: v.string(),
    participantIds: v.array(v.string()),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const workspaceRoles = (await getWorkspaceRoleMapForUser(ctx, args.currentUserId))[
      args.workspaceId
    ] ?? []

    if (workspaceRoles.length === 0) {
      throw new Error("You do not have access to this workspace")
    }

    const workspaceUserIds = new Set(await getWorkspaceUserIds(ctx, args.workspaceId))
    const participantIds = [...new Set([args.currentUserId, ...args.participantIds])].filter(
      (userId) => workspaceUserIds.has(userId)
    )

    if (participantIds.length < 2) {
      throw new Error("Chats need at least two workspace members")
    }

    const users = await ctx.db.query("users").collect()
    const variant = participantIds.length === 2 ? "direct" : "group"
    const otherParticipantIds = participantIds.filter(
      (userId) => userId !== args.currentUserId
    )
    const resolvedTitle =
      args.title.trim() ||
      (variant === "direct"
        ? users.find((user) => user.id === otherParticipantIds[0])?.name ??
          "Direct chat"
        : otherParticipantIds
            .map((userId) => users.find((user) => user.id === userId)?.name ?? "")
            .filter(Boolean)
            .join(", ")
            .slice(0, 80) || "Group chat")
    const now = getNow()
    const conversationId = createId("conversation")

    await ctx.db.insert("conversations", {
      id: conversationId,
      kind: "chat",
      scopeType: "workspace",
      scopeId: args.workspaceId,
      variant,
      title: resolvedTitle,
      description: args.description.trim(),
      participantIds,
      createdBy: args.currentUserId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      conversationId,
    }
  },
})

export const ensureTeamChat = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireReadableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    const normalizedTeam = normalizeTeam(team)

    if (!normalizedTeam.settings.features.chat) {
      throw new Error("Chat is disabled for this team")
    }

    const existing = (
      await ctx.db
        .query("conversations")
        .withIndex("by_kind_scope", (q) =>
          q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", args.teamId)
        )
        .collect()
    ).find((conversation) => conversation.variant === "team")

    if (existing) {
      return {
        conversationId: existing.id,
      }
    }

    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const participantIds = await getTeamMemberIds(ctx, args.teamId)
    const now = getNow()
    const conversationId = createId("conversation")

    await ctx.db.insert("conversations", {
      id: conversationId,
      kind: "chat",
      scopeType: "team",
      scopeId: args.teamId,
      variant: "team",
      title: args.title.trim() || `${team.name} chat`,
      description: args.description.trim() || team.settings.summary,
      participantIds,
      createdBy: args.currentUserId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      conversationId,
    }
  },
})

export const createChannel = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    const normalizedTeam = normalizeTeam(team)

    if (!normalizedTeam.settings.features.channels) {
      throw new Error("Channels are disabled for this team")
    }

    const participantIds = await getTeamMemberIds(ctx, args.teamId)
    const now = getNow()
    const conversationId = createId("conversation")

    await ctx.db.insert("conversations", {
      id: conversationId,
      kind: "channel",
      scopeType: "team",
      scopeId: args.teamId,
      variant: "team",
      title: args.title.trim(),
      description: args.description.trim(),
      participantIds,
      createdBy: args.currentUserId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      conversationId,
    }
  },
})

export const sendChatMessage = mutation({
  args: {
    currentUserId: v.string(),
    conversationId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, args.conversationId),
      args.currentUserId,
      "write"
    )

    if (conversation.kind !== "chat") {
      throw new Error("Messages can only be sent to chats")
    }

    const users = await ctx.db.query("users").collect()
    const now = getNow()
    const messageId = createId("chat_message")

    await ctx.db.insert("chatMessages", {
      id: messageId,
      conversationId: conversation.id,
      content: args.content.trim(),
      mentionUserIds: createMentionIds(args.content, users),
      createdBy: args.currentUserId,
      createdAt: now,
    })

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      messageId,
    }
  },
})

export const createChannelPost = mutation({
  args: {
    currentUserId: v.string(),
    conversationId: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, args.conversationId),
      args.currentUserId,
      "write"
    )

    if (conversation.kind !== "channel") {
      throw new Error("Posts can only be created in channels")
    }

    const now = getNow()
    const postId = createId("channel_post")

    await ctx.db.insert("channelPosts", {
      id: postId,
      conversationId: conversation.id,
      title: args.title.trim(),
      content: args.content.trim(),
      createdBy: args.currentUserId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId,
    }
  },
})

export const addChannelPostComment = mutation({
  args: {
    currentUserId: v.string(),
    postId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await getChannelPostDoc(ctx, args.postId)

    if (!post) {
      throw new Error("Post not found")
    }

    const conversation = await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, post.conversationId),
      args.currentUserId,
      "write"
    )

    if (conversation.kind !== "channel") {
      throw new Error("Comments can only be added to channels")
    }

    const users = await ctx.db.query("users").collect()
    const now = getNow()
    const commentId = createId("channel_comment")

    await ctx.db.insert("channelPostComments", {
      id: commentId,
      postId: post.id,
      content: args.content.trim(),
      mentionUserIds: createMentionIds(args.content, users),
      createdBy: args.currentUserId,
      createdAt: now,
    })

    await ctx.db.patch(post._id, {
      updatedAt: now,
    })

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      commentId,
    }
  },
})
