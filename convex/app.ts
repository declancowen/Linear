import { addDays, differenceInCalendarDays } from "date-fns"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { v } from "convex/values"

import { createSeedState } from "../lib/domain/seed"
import {
  buildTeamIssueViews,
  canonicalTeamIssueViewNames,
} from "../lib/domain/default-views"
import {
  canParentWorkItemTypeAcceptChild,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  getAllowedWorkItemTypesForTemplate,
  getDefaultWorkItemTypesForTeamExperience,
  getTeamFeatureValidationMessage,
  normalizeTeamIconToken,
  type ViewDefinition,
} from "../lib/domain/types"
import { getPlainTextContent } from "../lib/utils"
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

const rolePriority: Record<"guest" | "viewer" | "member" | "admin", number> = {
  guest: 0,
  viewer: 1,
  member: 2,
  admin: 3,
}
const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

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
    .slice(0, 12)
}

function normalizeTeamIcon(
  icon: string | null | undefined,
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
    | null
    | undefined
) {
  return normalizeTeamIconToken(icon, experience)
}

function mergeMembershipRole(
  currentRole: "admin" | "member" | "viewer" | "guest" | null | undefined,
  requestedRole: "admin" | "member" | "viewer" | "guest"
) {
  if (!currentRole) {
    return requestedRole
  }

  return rolePriority[currentRole] >= rolePriority[requestedRole]
    ? currentRole
    : requestedRole
}

function createUniqueTeamSlug(
  teams: Array<{ slug: string }>,
  name: string,
  joinCode: string
) {
  const baseSlug = createSlug(name) || createSlug(joinCode) || "team"
  const takenSlugs = new Set(teams.map((team) => team.slug))

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!takenSlugs.has(candidate)) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique team slug")
}

function createUniqueWorkspaceSlug(
  workspaces: Array<{ slug: string }>,
  name: string
) {
  const baseSlug = createSlug(name) || "workspace"
  const takenSlugs = new Set(workspaces.map((workspace) => workspace.slug))

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!takenSlugs.has(candidate)) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique workspace slug")
}

function ensureJoinCodeAvailable(
  teams: Array<{ id: string; settings: { joinCode: string } }>,
  joinCode: string,
  excludedTeamId?: string
) {
  const duplicate = teams.find(
    (team) => team.settings.joinCode === joinCode && team.id !== excludedTeamId
  )

  if (duplicate) {
    throw new Error("Join code is already in use")
  }
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

function matchesTeamAccessIdentifier(
  team: { id: string; slug: string; settings: { joinCode: string } },
  value: string
) {
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

async function getProjectDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("projects")
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

async function getCommentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("comments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getConversationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("conversations")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

async function getCallDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("calls")
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

async function getPendingInvitesForEmail(ctx: AppCtx, email: string) {
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

async function getActiveInvitesForTeamAndEmail(
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

  return memberships.reduce<
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

async function bootstrapFirstAuthenticatedUser(
  ctx: MutationCtx,
  userId: string
) {
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

async function isTeamMember(ctx: AppCtx, teamId: string, userId: string) {
  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()

  return Boolean(membership)
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
  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []
  const canEdit = workspaceRoles.some(
    (role) => role === "admin" || role === "member"
  )

  if (!canEdit) {
    throw new Error("Your current role is read-only")
  }
}

async function requireReadableWorkspaceAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []

  if (workspaceRoles.length === 0) {
    throw new Error("You do not have access to this workspace")
  }
}

async function requireReadableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (
    document.kind === "team-document" ||
    document.kind === "item-description"
  ) {
    if (!document.teamId) {
      throw new Error("Document is missing a team")
    }

    await requireReadableTeamAccess(ctx, document.teamId, userId)
    return
  }

  if (!document.workspaceId) {
    throw new Error("Document is missing a workspace")
  }

  if (document.kind === "private-document" && document.createdBy !== userId) {
    throw new Error("You do not have access to this document")
  }

  await requireReadableWorkspaceAccess(ctx, document.workspaceId, userId)
}

async function requireEditableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (
    document.kind === "team-document" ||
    document.kind === "item-description"
  ) {
    if (!document.teamId) {
      throw new Error("Document is missing a team")
    }

    await requireEditableTeamAccess(ctx, document.teamId, userId)
    return
  }

  if (!document.workspaceId) {
    throw new Error("Document is missing a workspace")
  }

  if (document.kind === "private-document" && document.createdBy !== userId) {
    throw new Error("You can only edit your own private documents")
  }

  if (document.kind === "private-document") {
    await requireReadableWorkspaceAccess(ctx, document.workspaceId, userId)
    return
  }

  await requireEditableWorkspaceAccess(ctx, document.workspaceId, userId)
}

async function requireWorkspaceAdminAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []

  if (!workspaceRoles.includes("admin")) {
    throw new Error("Only workspace admins can perform this action")
  }
}

function projectBelongsToTeamScope(
  team: { id: string; workspaceId: string },
  project: { scopeType: "team" | "workspace"; scopeId: string }
) {
  return (
    (project.scopeType === "team" && project.scopeId === team.id) ||
    (project.scopeType === "workspace" && project.scopeId === team.workspaceId)
  )
}

async function validateWorkItemParent(
  ctx: AppCtx,
  options: {
    teamId: string
    itemType:
      | "epic"
      | "feature"
      | "requirement"
      | "task"
      | "bug"
      | "sub-task"
      | "qa-task"
      | "test-case"
    parentId: string | null
    currentItemId?: string
  }
) {
  if (!options.parentId) {
    return null
  }

  const parent = await getWorkItemDoc(ctx, options.parentId)

  if (!parent) {
    throw new Error("Parent issue not found")
  }

  if (parent.teamId !== options.teamId) {
    throw new Error("Parent issue must belong to the same team")
  }

  if (parent.parentId) {
    throw new Error("Sub-issues can't contain other sub-issues")
  }

  if (options.currentItemId && parent.id === options.currentItemId) {
    throw new Error("An issue cannot be its own parent")
  }

  if (!canParentWorkItemTypeAcceptChild(parent.type, options.itemType)) {
    throw new Error("Parent issue type cannot contain this child type")
  }

  if (!options.currentItemId) {
    return parent
  }

  const teamItems = await ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", options.teamId))
    .collect()

  if (teamItems.some((item) => item.parentId === options.currentItemId)) {
    throw new Error(
      "Issues with sub-issues can't be nested under another issue"
    )
  }

  const visited = new Set<string>([options.currentItemId])
  let cursor = parent

  while (cursor.parentId) {
    if (visited.has(cursor.parentId)) {
      throw new Error("Parent issue would create a cycle")
    }

    visited.add(cursor.parentId)
    const nextParent = await getWorkItemDoc(ctx, cursor.parentId)

    if (!nextParent) {
      break
    }

    cursor = nextParent
  }

  return parent
}

async function ensureTeamIssueViews(
  ctx: MutationCtx,
  team: Awaited<ReturnType<typeof getTeamDoc>>
) {
  if (!team) {
    return
  }

  const normalizedTeam = normalizeTeam(team)

  if (
    !normalizedTeam.settings.features.issues ||
    !normalizedTeam.settings.features.views
  ) {
    return
  }

  const existingViews = (await ctx.db.query("views").collect()).filter(
    (view) =>
      view.scopeType === "team" &&
      view.scopeId === team.id &&
      view.entityKind === "items" &&
      view.route === `/team/${team.slug}/work`
  )
  const existingByName = new Map(existingViews.map((view) => [view.name, view]))
  const legacyAllIssuesView =
    existingByName.get("All work") ?? existingByName.get("Platform Priorities")
  const needsPatch = (
    existing: (typeof existingViews)[number],
    canonicalView: ViewDefinition
  ) =>
    existing.name !== canonicalView.name ||
    existing.description !== canonicalView.description ||
    existing.layout !== canonicalView.layout ||
    JSON.stringify(existing.filters) !==
      JSON.stringify(canonicalView.filters) ||
    existing.grouping !== canonicalView.grouping ||
    existing.subGrouping !== canonicalView.subGrouping ||
    existing.ordering !== canonicalView.ordering ||
    JSON.stringify(existing.displayProps) !==
      JSON.stringify(canonicalView.displayProps) ||
    JSON.stringify(existing.hiddenState) !==
      JSON.stringify(canonicalView.hiddenState) ||
    existing.isShared !== canonicalView.isShared ||
    existing.route !== canonicalView.route

  const canonicalViews = buildTeamIssueViews({
    teamId: team.id,
    teamSlug: team.slug,
    createdAt: getNow(),
    updatedAt: getNow(),
  })

  for (const canonicalView of canonicalViews) {
    const existing =
      existingByName.get(canonicalView.name) ??
      (canonicalView.name === canonicalTeamIssueViewNames[0]
        ? legacyAllIssuesView
        : null)

    if (existing) {
      if (needsPatch(existing, canonicalView)) {
        await ctx.db.patch(existing._id, {
          name: canonicalView.name,
          description: canonicalView.description,
          layout: canonicalView.layout,
          filters: canonicalView.filters,
          grouping: canonicalView.grouping,
          subGrouping: canonicalView.subGrouping,
          ordering: canonicalView.ordering,
          displayProps: canonicalView.displayProps,
          hiddenState: canonicalView.hiddenState,
          isShared: true,
          route: canonicalView.route,
          updatedAt: getNow(),
        })
      }
      existingByName.set(canonicalView.name, existing)
      continue
    }

    await ctx.db.insert("views", canonicalView)
  }
}

function collectWorkItemCascadeIds(
  items: Array<{ id: string; parentId: string | null }>,
  rootItemId: string
) {
  const deletedItemIds = new Set<string>([rootItemId])
  const queue = [rootItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    for (const item of items) {
      if (item.parentId !== currentId || deletedItemIds.has(item.id)) {
        continue
      }

      deletedItemIds.add(item.id)
      queue.push(item.id)
    }
  }

  return deletedItemIds
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

async function findTeamChatConversation(ctx: AppCtx, teamId: string) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", teamId)
    )
    .collect()

  return (
    conversations.find((conversation) => conversation.variant === "team") ??
    null
  )
}

async function findPrimaryChannelConversation(
  ctx: AppCtx,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "channel").eq("scopeType", scopeType).eq("scopeId", scopeId)
    )
    .collect()

  return (
    conversations.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    )[0] ?? null
  )
}

async function findPrimaryTeamChannelConversation(ctx: AppCtx, teamId: string) {
  return findPrimaryChannelConversation(ctx, "team", teamId)
}

async function findPrimaryWorkspaceChannelConversation(
  ctx: AppCtx,
  workspaceId: string
) {
  return findPrimaryChannelConversation(ctx, "workspace", workspaceId)
}

async function ensureTeamChatConversation(
  ctx: MutationCtx,
  input: {
    teamId: string
    currentUserId: string
    teamName: string
    teamSummary: string
    title?: string
    description?: string
  }
) {
  const existing = await findTeamChatConversation(ctx, input.teamId)

  if (existing) {
    return existing.id
  }

  const participantIds = await getTeamMemberIds(ctx, input.teamId)
  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "chat",
    scopeType: "team",
    scopeId: input.teamId,
    variant: "team",
    title: input.title?.trim() || input.teamName.trim(),
    description: input.description?.trim() || input.teamSummary.trim(),
    participantIds,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

async function ensureTeamChannelConversation(
  ctx: MutationCtx,
  input: {
    teamId: string
    currentUserId: string
    teamName: string
    teamSummary: string
    title?: string
    description?: string
  }
) {
  const existing = await findPrimaryTeamChannelConversation(ctx, input.teamId)

  if (existing) {
    return existing.id
  }

  const participantIds = await getTeamMemberIds(ctx, input.teamId)
  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "channel",
    scopeType: "team",
    scopeId: input.teamId,
    variant: "team",
    title: input.title?.trim() || input.teamName.trim(),
    description: input.description?.trim() || input.teamSummary.trim(),
    participantIds,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

async function ensureWorkspaceChannelConversation(
  ctx: MutationCtx,
  input: {
    workspaceId: string
    currentUserId: string
    workspaceName: string
    workspaceDescription: string
    title?: string
    description?: string
  }
) {
  const existing = await findPrimaryWorkspaceChannelConversation(
    ctx,
    input.workspaceId
  )

  if (existing) {
    return existing.id
  }

  const participantIds = await getWorkspaceUserIds(ctx, input.workspaceId)
  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "channel",
    scopeType: "workspace",
    scopeId: input.workspaceId,
    variant: "team",
    title: input.title?.trim() || input.workspaceName.trim(),
    description:
      input.description?.trim() ||
      input.workspaceDescription.trim() ||
      "Shared updates and threaded decisions for the whole workspace.",
    participantIds,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
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
    const workspaceRoles =
      (await getWorkspaceRoleMapForUser(ctx, userId))[conversation.scopeId] ??
      []

    if (workspaceRoles.length === 0) {
      throw new Error("You do not have access to this conversation")
    }

    if (
      conversation.kind === "chat" &&
      !conversation.participantIds.includes(userId)
    ) {
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

function createMentionIds(
  content: string,
  users: Array<{ id: string; handle: string }>
) {
  const handles = [...content.matchAll(/@([a-z0-9_-]+)/gi)].map((match) =>
    match[1]?.toLowerCase()
  )

  return users
    .filter((user) => handles.includes(user.handle.toLowerCase()))
    .map((user) => user.id)
}

function toggleReactionUsers(
  reactions: Array<{ emoji: string; userIds: string[] }> | undefined,
  emoji: string,
  userId: string
) {
  const nextReactions = [...(reactions ?? [])]
  const reactionIndex = nextReactions.findIndex(
    (entry) => entry.emoji === emoji
  )

  if (reactionIndex === -1) {
    return [
      ...nextReactions,
      {
        emoji,
        userIds: [userId],
      },
    ]
  }

  const reaction = nextReactions[reactionIndex]
  const hasReacted = reaction.userIds.includes(userId)
  const userIds = hasReacted
    ? reaction.userIds.filter((entry) => entry !== userId)
    : [...reaction.userIds, userId]

  if (userIds.length === 0) {
    nextReactions.splice(reactionIndex, 1)
    return nextReactions
  }

  nextReactions[reactionIndex] = {
    ...reaction,
    userIds,
  }

  return nextReactions
}

async function getChannelConversationPath(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  postId: string
) {
  if (!conversation || conversation.kind !== "channel") {
    return `/inbox#${postId}`
  }

  if (conversation.scopeType === "workspace") {
    return `/workspace/channel#${postId}`
  }

  const team = await getTeamDoc(ctx, conversation.scopeId)

  if (!team) {
    return `/inbox#${postId}`
  }

  return `/team/${team.slug}/channel#${postId}`
}

async function getChatConversationPath(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>
) {
  if (!conversation || conversation.kind !== "chat") {
    return "/chats"
  }

  if (conversation.scopeType === "workspace") {
    return `/chats?chatId=${conversation.id}`
  }

  const team = await getTeamDoc(ctx, conversation.scopeId)

  if (!team) {
    return "/chats"
  }

  return `/team/${team.slug}/chat`
}

function createNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat",
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

async function assertImageUpload(
  ctx: MutationCtx,
  storageId: string | null | undefined
) {
  if (!storageId) {
    return null
  }

  const metadata = await ctx.storage.getMetadata(storageId as never)

  if (!metadata) {
    throw new Error("Uploaded image not found")
  }

  if (!metadata.contentType?.startsWith("image/")) {
    throw new Error("Uploads must be image files")
  }

  if ((metadata.size ?? 0) <= 0) {
    throw new Error("Uploaded image is empty")
  }

  if ((metadata.size ?? 0) > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }

  return storageId as never
}

async function resolveWorkspaceSnapshot<
  T extends {
    logoImageStorageId?: string | null
    workosOrganizationId?: string | null
  },
>(ctx: QueryCtx, workspace: T) {
  const logoImageUrl = workspace.logoImageStorageId
    ? await ctx.storage.getUrl(workspace.logoImageStorageId as never)
    : null

  return {
    ...normalizeWorkspace(workspace),
    logoImageUrl,
  }
}

async function resolveUserSnapshot<
  T extends {
    avatarImageStorageId?: string | null
    workosUserId?: string | null
  },
>(ctx: QueryCtx, user: T) {
  const avatarImageUrl = user.avatarImageStorageId
    ? await ctx.storage.getUrl(user.avatarImageStorageId as never)
    : null

  return {
    ...normalizeUser(user),
    avatarImageUrl,
  }
}

function normalizeTeamWorkflowSettings(
  workflow:
    | {
        statusOrder: Array<
          | "backlog"
          | "todo"
          | "in-progress"
          | "done"
          | "cancelled"
          | "duplicate"
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
      }
    | null
    | undefined,
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
    | null
    | undefined = "software-development"
) {
  const defaults = createDefaultTeamWorkflowSettings(
    experience ?? "software-development"
  )

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
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
    | null
    | undefined,
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

function normalizeTeam<T extends { settings: Record<string, unknown> }>(
  team: T
) {
  const settings = team.settings as {
    experience?:
      | "software-development"
      | "issue-analysis"
      | "project-management"
      | "community"
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
    icon: normalizeTeamIcon(
      (team as T & { icon?: string }).icon,
      settings.experience ?? "software-development"
    ),
    settings: {
      ...team.settings,
      experience: settings.experience ?? "software-development",
      features: normalizeTeamFeatures(settings.experience, settings.features),
      workflow: normalizeTeamWorkflowSettings(
        settings.workflow,
        settings.experience
      ),
    },
  }
}

function normalizeDocument<
  T extends { workspaceId?: string; teamId?: string | null },
>(document: T, teams: Array<{ id: string; workspaceId: string }>) {
  return {
    ...document,
    workspaceId:
      document.workspaceId ??
      teams.find((team) => team.id === document.teamId)?.workspaceId ??
      "",
  }
}

async function getTeamSurfaceDisableMessage(
  ctx: MutationCtx,
  team: {
    id: string
    settings: {
      experience?:
        | "software-development"
        | "issue-analysis"
        | "community"
        | "project-management"
      features?: {
        issues: boolean
        projects: boolean
        views: boolean
        docs: boolean
        chat: boolean
        channels: boolean
      }
    }
  },
  nextFeatures: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
) {
  const currentFeatures = normalizeTeamFeatures(
    team.settings.experience,
    team.settings.features
  )

  if (currentFeatures.docs && !nextFeatures.docs) {
    const documents = await ctx.db.query("documents").collect()
    const hasTeamDocuments = documents.some(
      (document) =>
        document.kind === "team-document" && document.teamId === team.id
    )

    if (hasTeamDocuments) {
      return "Docs cannot be turned off while this team still has documents."
    }
  }

  if (currentFeatures.chat && !nextFeatures.chat) {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_kind_scope", (q) =>
        q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", team.id)
      )
      .collect()
    const teamChat = conversations.find(
      (conversation) => conversation.variant === "team"
    )

    if (teamChat) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", teamChat.id)
        )
        .take(1)

      if (messages.length > 0) {
        return "Chat cannot be turned off while the team chat has messages."
      }
    }
  }

  if (currentFeatures.channels && !nextFeatures.channels) {
    const channels = await ctx.db
      .query("conversations")
      .withIndex("by_kind_scope", (q) =>
        q.eq("kind", "channel").eq("scopeType", "team").eq("scopeId", team.id)
      )
      .collect()

    for (const channel of channels) {
      const posts = await ctx.db
        .query("channelPosts")
        .withIndex("by_conversation", (q) => q.eq("conversationId", channel.id))
        .take(1)

      if (posts.length > 0) {
        return "Channel cannot be turned off while posts exist."
      }
    }
  }

  return null
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

  for (const call of seed.calls) {
    await ctx.db.insert("calls", call)
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
    teamExperience: v.optional(teamExperienceTypeValidator),
    role: v.optional(roleValidator),
  },
  handler: async (ctx, args) => {
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

    await ensureTeamIssueViews(ctx, await getTeamDoc(ctx, teamId))

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
    const users = await ctx.db.query("users").collect()
    const authenticatedUser = args.email
      ? await getUserByEmail(ctx, args.email)
      : null
    const firstUser = users[0]
    const currentUserId =
      authenticatedUser?.id ?? config?.currentUserId ?? firstUser?.id ?? ""
    const currentUserEmail =
      authenticatedUser?.email ??
      users.find((user) => user.id === currentUserId)?.email ??
      ""
    const accessibleMemberships = teamMemberships.filter(
      (membership) => membership.userId === currentUserId
    )
    const accessibleTeamIds = new Set(
      accessibleMemberships.map((membership) => membership.teamId)
    )
    const visibleTeams = teams.filter((team) => accessibleTeamIds.has(team.id))
    const accessibleWorkspaceIds = new Set(
      visibleTeams.map((team) => team.workspaceId)
    )
    const currentUserMembership = accessibleMemberships.find(
      (membership) => membership.userId === currentUserId
    )
    const membershipWorkspaceId =
      visibleTeams.find((team) => team.id === currentUserMembership?.teamId)
        ?.workspaceId ?? null
    const fallbackWorkspaceId =
      membershipWorkspaceId ??
      (config?.currentWorkspaceId &&
      accessibleWorkspaceIds.has(config.currentWorkspaceId)
        ? config.currentWorkspaceId
        : null) ??
      visibleTeams[0]?.workspaceId ??
      ""
    const currentWorkspaceId = membershipWorkspaceId ?? fallbackWorkspaceId
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
    const visibleProjectIds = new Set(
      visibleProjects.map((project) => project.id)
    )
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
    const visibleViews = (await ctx.db.query("views").collect()).filter(
      (view) => {
        if (view.scopeType === "personal") {
          return view.scopeId === currentUserId
        }

        if (view.scopeType === "team") {
          return accessibleTeamIds.has(view.scopeId)
        }

        return accessibleWorkspaceIds.has(view.scopeId)
      }
    )
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
      ? await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", currentUserId))
          .collect()
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
    const visibleCalls = (await ctx.db.query("calls").collect()).filter(
      (call) => visibleConversationIds.has(call.conversationId)
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
      teams: visibleTeams.map(normalizeTeam),
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
      workItems: visibleWorkItems,
      documents: visibleDocuments,
      views: visibleViews,
      comments: visibleComments,
      attachments,
      notifications: visibleNotifications,
      invites: visibleInvites,
      projectUpdates: visibleProjectUpdates,
      conversations: visibleConversations,
      calls: visibleCalls.map((call) => ({
        ...call,
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
    const workspaces = await ctx.db.query("workspaces").collect()
    const teams = await ctx.db.query("teams").collect()
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .collect()
    const workspaceRoleMap = await getWorkspaceRoleMapForUser(ctx, user.id)
    const pendingInvites = await getPendingInvitesForEmail(ctx, user.email)
    const accessibleWorkspaceIds = [
      ...new Set(
        memberships
          .map(
            (membership) =>
              teams.find((team) => team.id === membership.teamId)?.workspaceId
          )
          .filter(Boolean)
      ),
    ]
    const preferredWorkspaceId = accessibleWorkspaceIds.includes(
      config?.currentWorkspaceId ?? ""
    )
      ? (config?.currentWorkspaceId ?? null)
      : (accessibleWorkspaceIds[0] ?? config?.currentWorkspaceId ?? null)
    const currentWorkspace = preferredWorkspaceId
      ? await getWorkspaceDoc(ctx, preferredWorkspaceId)
      : null
    const pendingWorkspaceCandidates = workspaces.filter((workspace) => {
      if (workspace.createdBy !== user.id) {
        return false
      }

      return !teams.some((team) => team.workspaceId === workspace.id)
    })
    const pendingWorkspace =
      pendingWorkspaceCandidates.find(
        (workspace) => workspace.id === config?.currentWorkspaceId
      ) ??
      pendingWorkspaceCandidates[0] ??
      null
    const onboardingState = currentWorkspace
      ? "ready"
      : pendingWorkspace
        ? "needs-team"
        : "needs-workspace"

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
        workosUserId: args.workosUserId,
        handle: createHandle(args.email),
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
        email: args.email,
        name: args.name,
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
  },
})

export const lookupTeamByJoinCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
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

export const createWorkspace = mutation({
  args: {
    currentUserId: v.string(),
    name: v.string(),
    logoUrl: v.string(),
    accent: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
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

    const config = await getAppConfig(ctx)

    if (config) {
      await ctx.db.patch(config._id, {
        currentUserId: args.currentUserId,
        currentWorkspaceId: workspaceId,
      })
    } else {
      await ctx.db.insert("appConfig", {
        key: "singleton",
        currentUserId: args.currentUserId,
        currentWorkspaceId: workspaceId,
      })
    }

    return {
      workspaceId,
      workspaceSlug,
    }
  },
})

export const updateWorkspaceBranding = mutation({
  args: {
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    logoUrl: v.string(),
    logoImageStorageId: v.optional(v.id("_storage")),
    clearLogoImage: v.optional(v.boolean()),
    accent: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
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
    avatarImageStorageId: v.optional(v.id("_storage")),
    clearAvatarImage: v.optional(v.boolean()),
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
      preferences: args.preferences,
    })
  },
})

export const ensureWorkspaceScaffolding = mutation({
  args: {
    currentUserId: v.string(),
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireReadableWorkspaceAccess(
      ctx,
      args.workspaceId,
      args.currentUserId
    )

    const teams = (await ctx.db.query("teams").collect()).filter(
      (team) => team.workspaceId === args.workspaceId
    )

    for (const team of teams) {
      await ensureTeamIssueViews(ctx, team)
    }

    return {
      workspaceId: args.workspaceId,
      ensuredTeamCount: teams.length,
    }
  },
})

export const createTeam = mutation({
  args: {
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    icon: v.string(),
    summary: v.string(),
    joinCode: v.string(),
    experience: teamExperienceTypeValidator,
    features: teamFeatureSettingsValidator,
  },
  handler: async (ctx, args) => {
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

    await ensureTeamIssueViews(ctx, await getTeamDoc(ctx, teamId))

    return {
      teamId,
      teamSlug,
      joinCode: normalizedJoinCode,
      features: normalizedFeatures,
    }
  },
})

export const updateTeamDetails = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    name: v.string(),
    icon: v.string(),
    summary: v.string(),
    joinCode: v.optional(v.string()),
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

    const normalizedFeatures = normalizeTeamFeatures(
      args.experience,
      args.features
    )
    const normalizedIcon = normalizeTeamIcon(args.icon, args.experience)
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

    await ensureTeamIssueViews(ctx, await getTeamDoc(ctx, team.id))

    return {
      teamId: team.id,
      joinCode: normalizedJoinCode,
      experience: args.experience,
      features: normalizedFeatures,
    }
  },
})

export const regenerateTeamJoinCode = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.string(),
    joinCode: v.string(),
  },
  handler: async (ctx, args) => {
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
    layout: v.optional(
      v.union(v.literal("list"), v.literal("board"), v.literal("timeline"))
    ),
    grouping: v.optional(groupFieldValidator),
    subGrouping: v.optional(v.union(groupFieldValidator, v.null())),
    ordering: v.optional(orderingFieldValidator),
    showCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(
      ctx,
      args.viewId,
      args.currentUserId
    )

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
    const view = await requireViewMutationAccess(
      ctx,
      args.viewId,
      args.currentUserId
    )

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
    const view = await requireViewMutationAccess(
      ctx,
      args.viewId,
      args.currentUserId
    )

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
    const view = await requireViewMutationAccess(
      ctx,
      args.viewId,
      args.currentUserId
    )

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

export const clearViewFilters = mutation({
  args: {
    currentUserId: v.string(),
    viewId: v.string(),
  },
  handler: async (ctx, args) => {
    const view = await requireViewMutationAccess(
      ctx,
      args.viewId,
      args.currentUserId
    )

    await ctx.db.patch(view._id, {
      filters: {
        ...view.filters,
        status: [],
        priority: [],
        assigneeIds: [],
        projectIds: [],
        itemTypes: [],
        labelIds: [],
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
      parentId: v.optional(nullableStringValidator),
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
    const team = await getTeamDoc(ctx, existing.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    await validateWorkItemParent(ctx, {
      teamId: existing.teamId,
      itemType: existing.type,
      parentId:
        args.patch.parentId === undefined
          ? existing.parentId
          : args.patch.parentId,
      currentItemId: existing.id,
    })

    if (
      args.patch.assigneeId !== undefined &&
      args.patch.assigneeId &&
      !(await isTeamMember(ctx, existing.teamId, args.patch.assigneeId))
    ) {
      throw new Error("Assignee must belong to the selected team")
    }

    if (
      args.patch.primaryProjectId !== undefined &&
      args.patch.primaryProjectId
    ) {
      const project = await getProjectDoc(ctx, args.patch.primaryProjectId)

      if (!project) {
        throw new Error("Project not found")
      }

      if (!projectBelongsToTeamScope(team, project)) {
        throw new Error("Project must belong to the same team or workspace")
      }

      if (
        !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
          existing.type
        )
      ) {
        throw new Error(
          "Work item type is not allowed for the selected project template"
        )
      }
    }

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

      await ctx.db.insert("notifications", notification)

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

export const deleteWorkItem = mutation({
  args: {
    currentUserId: v.string(),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await getWorkItemDoc(ctx, args.itemId)

    if (!item) {
      throw new Error("Work item not found")
    }

    await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)

    const teamItems = await ctx.db
      .query("workItems")
      .withIndex("by_team_id", (q) => q.eq("teamId", item.teamId))
      .collect()
    const deletedItemIds = collectWorkItemCascadeIds(teamItems, item.id)
    const deletedWorkItems = teamItems.filter((entry) =>
      deletedItemIds.has(entry.id)
    )
    const deletedDescriptionDocIds = new Set(
      deletedWorkItems.map((entry) => entry.descriptionDocId)
    )
    const comments = await ctx.db.query("comments").collect()
    const attachments = await ctx.db.query("attachments").collect()
    const notifications = await ctx.db.query("notifications").collect()
    const documents = await ctx.db.query("documents").collect()

    for (const attachment of attachments) {
      const targetsDeletedItem =
        attachment.targetType === "workItem" &&
        deletedItemIds.has(attachment.targetId)
      const targetsDeletedDescription =
        attachment.targetType === "document" &&
        deletedDescriptionDocIds.has(attachment.targetId)

      if (!targetsDeletedItem && !targetsDeletedDescription) {
        continue
      }

      await ctx.storage.delete(attachment.storageId)
      await ctx.db.delete(attachment._id)
    }

    for (const comment of comments) {
      const targetsDeletedItem =
        comment.targetType === "workItem" &&
        deletedItemIds.has(comment.targetId)
      const targetsDeletedDescription =
        comment.targetType === "document" &&
        deletedDescriptionDocIds.has(comment.targetId)

      if (!targetsDeletedItem && !targetsDeletedDescription) {
        continue
      }

      await ctx.db.delete(comment._id)
    }

    for (const notification of notifications) {
      const targetsDeletedItem =
        notification.entityType === "workItem" &&
        deletedItemIds.has(notification.entityId)
      const targetsDeletedDescription =
        notification.entityType === "document" &&
        deletedDescriptionDocIds.has(notification.entityId)

      if (!targetsDeletedItem && !targetsDeletedDescription) {
        continue
      }

      await ctx.db.delete(notification._id)
    }

    for (const workItem of teamItems) {
      if (deletedItemIds.has(workItem.id)) {
        continue
      }

      const nextLinkedDocumentIds = workItem.linkedDocumentIds.filter(
        (documentId) => !deletedDescriptionDocIds.has(documentId)
      )

      if (nextLinkedDocumentIds.length === workItem.linkedDocumentIds.length) {
        continue
      }

      await ctx.db.patch(workItem._id, {
        linkedDocumentIds: nextLinkedDocumentIds,
        updatedAt: getNow(),
      })
    }

    for (const document of documents) {
      if (deletedDescriptionDocIds.has(document.id)) {
        await ctx.db.delete(document._id)
        continue
      }

      const nextLinkedWorkItemIds = document.linkedWorkItemIds.filter(
        (linkedItemId) => !deletedItemIds.has(linkedItemId)
      )

      if (nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length) {
        continue
      }

      await ctx.db.patch(document._id, {
        linkedWorkItemIds: nextLinkedWorkItemIds,
        updatedAt: getNow(),
        updatedBy: args.currentUserId,
      })
    }

    for (const workItem of deletedWorkItems) {
      const workItemDoc = await getWorkItemDoc(ctx, workItem.id)

      if (workItemDoc) {
        await ctx.db.delete(workItemDoc._id)
      }
    }

    return {
      deletedItemIds: [...deletedItemIds],
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

export const updateDocument = mutation({
  args: {
    currentUserId: v.string(),
    documentId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.title === undefined && args.content === undefined) {
      return
    }

    const document = await getDocumentDoc(ctx, args.documentId)

    if (!document) {
      return
    }

    await requireEditableDocumentAccess(ctx, document, args.currentUserId)

    await ctx.db.patch(document._id, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
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
    const target = await resolveAttachmentTarget(
      ctx,
      args.targetType,
      args.targetId
    )
    await requireEditableTeamAccess(ctx, target.teamId, args.currentUserId)

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    }
  },
})

export const generateSettingsImageUploadUrl = mutation({
  args: {
    currentUserId: v.string(),
    kind: v.union(v.literal("user-avatar"), v.literal("workspace-logo")),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.kind === "workspace-logo") {
      if (!args.workspaceId) {
        throw new Error("Workspace not found")
      }

      await requireWorkspaceAdminAccess(
        ctx,
        args.workspaceId,
        args.currentUserId
      )
    } else {
      const user = await getUserDoc(ctx, args.currentUserId)

      if (!user) {
        throw new Error("User not found")
      }
    }

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
    const target = await resolveAttachmentTarget(
      ctx,
      args.targetType,
      args.targetId
    )
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
      contentType:
        args.contentType || metadata.contentType || "application/octet-stream",
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
    parentCommentId: v.optional(nullableStringValidator),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    let teamId = ""
    let followerIds: string[] = []
    let entityType: "workItem" | "document" = "workItem"
    let entityTitle = "item"
    const existingComments = (await ctx.db.query("comments").collect()).filter(
      (comment) =>
        comment.targetType === args.targetType &&
        comment.targetId === args.targetId
    )
    const parentComment = args.parentCommentId
      ? await getCommentDoc(ctx, args.parentCommentId)
      : null

    if (args.parentCommentId) {
      if (!parentComment) {
        throw new Error("Parent comment not found")
      }

      if (
        parentComment.targetType !== args.targetType ||
        parentComment.targetId !== args.targetId
      ) {
        throw new Error("Reply must stay on the same thread target")
      }
    }

    if (args.targetType === "workItem") {
      const item = await getWorkItemDoc(ctx, args.targetId)
      if (!item) {
        return
      }

      teamId = item.teamId
      followerIds = [
        ...item.subscriberIds,
        item.creatorId,
        item.assigneeId ?? "",
        ...existingComments.map((comment) => comment.createdBy),
      ].filter(Boolean)
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
      followerIds = [
        document.createdBy,
        document.updatedBy,
        ...existingComments.map((comment) => comment.createdBy),
      ]
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
      commentText: string
    }> = []

    await ctx.db.insert("comments", {
      id: createId("comment"),
      targetType: args.targetType,
      targetId: args.targetId,
      parentCommentId: args.parentCommentId ?? null,
      content: args.content.trim(),
      mentionUserIds,
      reactions: [],
      createdBy: args.currentUserId,
      createdAt: getNow(),
    })

    for (const mentionedUserId of mentionUserIds) {
      if (
        mentionedUserId === args.currentUserId ||
        notifiedUserIds.has(mentionedUserId)
      ) {
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

      await ctx.db.insert("notifications", notification)

      if (mentionedUser?.preferences.emailMentions) {
        mentionEmails.push({
          notificationId: notification.id,
          email: mentionedUser.email,
          name: mentionedUser.name,
          entityTitle,
          entityType,
          entityId: args.targetId,
          actorName: actor?.name ?? "Someone",
          commentText: getPlainTextContent(args.content),
        })
      }
      notifiedUserIds.add(mentionedUserId)
    }

    const followerMessage = args.parentCommentId
      ? `${actor?.name ?? "Someone"} replied in ${entityTitle}`
      : `${actor?.name ?? "Someone"} commented on ${entityTitle}`

    for (const followerId of followerIds) {
      if (
        !followerId ||
        followerId === args.currentUserId ||
        notifiedUserIds.has(followerId)
      ) {
        continue
      }

      await ctx.db.insert(
        "notifications",
        createNotification(
          followerId,
          args.currentUserId,
          followerMessage,
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

export const toggleCommentReaction = mutation({
  args: {
    currentUserId: v.string(),
    commentId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const comment = await getCommentDoc(ctx, args.commentId)

    if (!comment) {
      throw new Error("Comment not found")
    }

    if (comment.targetType === "workItem") {
      const item = await getWorkItemDoc(ctx, comment.targetId)

      if (!item) {
        throw new Error("Work item not found")
      }

      await requireReadableTeamAccess(ctx, item.teamId, args.currentUserId)
    } else {
      await requireReadableDocumentAccess(
        ctx,
        await getDocumentDoc(ctx, comment.targetId),
        args.currentUserId
      )
    }

    await ctx.db.patch(comment._id, {
      reactions: toggleReactionUsers(
        comment.reactions,
        args.emoji.trim(),
        args.currentUserId
      ),
    })

    return {
      commentId: comment.id,
      ok: true,
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
      declinedAt: null,
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

    if (!existingMembership || existingMembership.role !== resolvedRole) {
      await ctx.db.insert(
        "notifications",
        createNotification(
          args.currentUserId,
          args.currentUserId,
          `You joined ${team?.name ?? "the team"} as ${resolvedRole}`,
          "invite",
          invite.teamId,
          "invite"
        )
      )
    }

    return {
      teamSlug: team?.slug ?? null,
      workspaceId: invite.workspaceId,
      workspaceSlug: workspace?.slug ?? null,
      workosOrganizationId: workspace?.workosOrganizationId ?? null,
    }
  },
})

export const declineInvite = mutation({
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
      throw new Error("Invite has already been accepted")
    }

    if (!invite.declinedAt) {
      await ctx.db.patch(invite._id, {
        declinedAt: getNow(),
      })
    }

    return {
      inviteId: invite.id,
      declinedAt: invite.declinedAt ?? getNow(),
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
    const team = teams.find((entry) =>
      matchesTeamAccessIdentifier(entry, args.code)
    )

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
    let invitedRole: "admin" | "member" | "viewer" | "guest" | null = null

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

    const config = await getAppConfig(ctx)
    if (config) {
      await ctx.db.patch(config._id, {
        currentWorkspaceId: team.workspaceId,
      })
    }

    if (!existingMembership || existingMembership.role !== resolvedRole) {
      await ctx.db.insert(
        "notifications",
        createNotification(
          args.currentUserId,
          args.currentUserId,
          `You joined ${team.name} as ${resolvedRole}`,
          "invite",
          team.id,
          "invite"
        )
      )
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

      if (!settingsTeam) {
        throw new Error("Team not found")
      }

      if (!normalizeTeam(settingsTeam).settings.features.projects) {
        throw new Error("Projects are disabled for this team")
      }
    } else {
      await requireEditableWorkspaceAccess(
        ctx,
        args.scopeId,
        args.currentUserId
      )

      if (args.settingsTeamId) {
        settingsTeam = await getTeamDoc(ctx, args.settingsTeamId)

        if (!settingsTeam) {
          throw new Error("Settings team not found")
        }

        if (settingsTeam.workspaceId !== args.scopeId) {
          throw new Error("Settings team must belong to the current workspace")
        }

        await requireEditableTeamAccess(
          ctx,
          settingsTeam.id,
          args.currentUserId
        )

        if (!normalizeTeam(settingsTeam).settings.features.projects) {
          throw new Error("Projects are disabled for the selected team")
        }
      }
    }

    const settingsTeamExperience =
      (
        settingsTeam?.settings as {
          experience?:
            | "software-development"
            | "issue-analysis"
            | "project-management"
            | "community"
        } | null
      )?.experience ?? "software-development"
    const workflow = normalizeTeamWorkflowSettings(
      settingsTeam?.settings.workflow,
      settingsTeamExperience
    )
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
        ? ((await getTeamDoc(ctx, args.teamId ?? ""))?.workspaceId ?? "")
        : (args.workspaceId ?? "")

    if (args.kind === "team-document") {
      if (!args.teamId) {
        throw new Error("Team is required")
      }

      await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
      const team = await getTeamDoc(ctx, args.teamId)

      if (!team) {
        throw new Error("Team not found")
      }

      if (!normalizeTeam(team).settings.features.docs) {
        throw new Error("Docs are disabled for this team")
      }
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
      teamId: args.kind === "team-document" ? (args.teamId ?? null) : null,
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
    parentId: v.optional(nullableStringValidator),
    primaryProjectId: nullableStringValidator,
    assigneeId: nullableStringValidator,
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    const normalizedTeam = normalizeTeam(team)
    const parent = await validateWorkItemParent(ctx, {
      teamId: args.teamId,
      itemType: args.type,
      parentId: args.parentId ?? null,
    })
    const resolvedPrimaryProjectId =
      args.primaryProjectId ?? parent?.primaryProjectId ?? null

    if (!normalizedTeam.settings.features.issues) {
      throw new Error("Issues are disabled for this team")
    }

    if (
      args.assigneeId &&
      !(await isTeamMember(ctx, args.teamId, args.assigneeId))
    ) {
      throw new Error("Assignee must belong to the selected team")
    }

    if (resolvedPrimaryProjectId) {
      const project = await getProjectDoc(ctx, resolvedPrimaryProjectId)

      if (!project) {
        throw new Error("Project not found")
      }

      if (!projectBelongsToTeamScope(team, project)) {
        throw new Error("Project must belong to the same team or workspace")
      }

      if (
        !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
          args.type
        )
      ) {
        throw new Error(
          "Work item type is not allowed for the selected project template"
        )
      }
    } else if (
      !getDefaultWorkItemTypesForTeamExperience(
        normalizedTeam.settings.experience
      ).includes(args.type)
    ) {
      throw new Error("Work item type is not allowed for this team")
    }

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
      linkedProjectIds: resolvedPrimaryProjectId
        ? [resolvedPrimaryProjectId]
        : [],
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
      parentId: parent?.id ?? null,
      primaryProjectId: resolvedPrimaryProjectId,
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
    const workspaceRoles =
      (await getWorkspaceRoleMapForUser(ctx, args.currentUserId))[
        args.workspaceId
      ] ?? []

    if (workspaceRoles.length === 0) {
      throw new Error("You do not have access to this workspace")
    }

    const workspaceUserIds = new Set(
      await getWorkspaceUserIds(ctx, args.workspaceId)
    )
    const participantIds = [
      ...new Set([args.currentUserId, ...args.participantIds]),
    ].filter((userId) => workspaceUserIds.has(userId))

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
        ? (users.find((user) => user.id === otherParticipantIds[0])?.name ??
          "Direct chat")
        : otherParticipantIds
            .map(
              (userId) => users.find((user) => user.id === userId)?.name ?? ""
            )
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

    const existing = await findTeamChatConversation(ctx, args.teamId)

    if (existing) {
      return {
        conversationId: existing.id,
      }
    }

    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const conversationId = await ensureTeamChatConversation(ctx, {
      teamId: args.teamId,
      currentUserId: args.currentUserId,
      teamName: team.name,
      teamSummary: team.settings.summary,
      title: args.title,
      description: args.description,
    })

    return {
      conversationId,
    }
  },
})

export const createChannel = mutation({
  args: {
    currentUserId: v.string(),
    teamId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const targets =
      Number(Boolean(args.teamId)) + Number(Boolean(args.workspaceId))

    if (targets !== 1) {
      throw new Error("Channel must target exactly one team or workspace")
    }

    if (args.teamId) {
      await requireReadableTeamAccess(ctx, args.teamId, args.currentUserId)
      const team = await getTeamDoc(ctx, args.teamId)

      if (!team) {
        throw new Error("Team not found")
      }

      const normalizedTeam = normalizeTeam(team)

      if (!normalizedTeam.settings.features.channels) {
        throw new Error("Channel is disabled for this team")
      }

      const existing = await findPrimaryTeamChannelConversation(
        ctx,
        args.teamId
      )

      if (existing) {
        return {
          conversationId: existing.id,
        }
      }

      await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
      const conversationId = await ensureTeamChannelConversation(ctx, {
        teamId: args.teamId,
        currentUserId: args.currentUserId,
        teamName: team.name,
        teamSummary: team.settings.summary,
        title: args.title,
        description: args.description,
      })

      return {
        conversationId,
      }
    }

    const workspaceId = args.workspaceId
    if (!workspaceId) {
      throw new Error("Workspace not found")
    }

    const workspaceRoles =
      (await getWorkspaceRoleMapForUser(ctx, args.currentUserId))[
        workspaceId
      ] ?? []

    if (workspaceRoles.length === 0) {
      throw new Error("You do not have access to this workspace")
    }

    const workspace = await getWorkspaceDoc(ctx, workspaceId)

    if (!workspace) {
      throw new Error("Workspace not found")
    }

    const existing = await findPrimaryWorkspaceChannelConversation(
      ctx,
      workspaceId
    )

    if (existing) {
      return {
        conversationId: existing.id,
      }
    }

    const conversationId = await ensureWorkspaceChannelConversation(ctx, {
      workspaceId,
      currentUserId: args.currentUserId,
      workspaceName: workspace.name,
      workspaceDescription: workspace.settings.description,
      title: args.title,
      description: args.description,
    })

    return {
      conversationId,
    }
  },
})

export const startChatCall = mutation({
  args: {
    currentUserId: v.string(),
    conversationId: v.string(),
    roomId: v.string(),
    roomName: v.string(),
    roomKey: v.string(),
    roomDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, args.conversationId),
      args.currentUserId,
      "write"
    )

    if (conversation.kind !== "chat") {
      throw new Error("Calls can only be started from chats")
    }

    const now = getNow()
    const call = {
      id: createId("call"),
      conversationId: conversation.id,
      scopeType: conversation.scopeType,
      scopeId: conversation.scopeId,
      roomId: args.roomId,
      roomName: args.roomName,
      roomKey: args.roomKey,
      roomDescription: args.roomDescription,
      startedBy: args.currentUserId,
      startedAt: now,
      updatedAt: now,
      endedAt: null,
      participantUserIds: [],
      lastJoinedAt: null,
      lastJoinedBy: null,
      joinCount: 0,
    }
    const message = {
      id: createId("chat_message"),
      conversationId: conversation.id,
      kind: "call" as const,
      content: "Started a call",
      callId: call.id,
      mentionUserIds: [],
      createdBy: args.currentUserId,
      createdAt: now,
    }

    await ctx.db.insert("calls", call)
    await ctx.db.insert("chatMessages", message)
    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      call,
      message,
    }
  },
})

export const markCallJoined = mutation({
  args: {
    currentUserId: v.string(),
    callId: v.string(),
  },
  handler: async (ctx, args) => {
    const call = await getCallDoc(ctx, args.callId)

    if (!call) {
      throw new Error("Call not found")
    }

    await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, call.conversationId),
      args.currentUserId
    )

    if (call.endedAt) {
      throw new Error("Call has already ended")
    }

    const now = getNow()
    const participantUserIds = [
      ...new Set([...(call.participantUserIds ?? []), args.currentUserId]),
    ]

    await ctx.db.patch(call._id, {
      participantUserIds,
      lastJoinedAt: now,
      lastJoinedBy: args.currentUserId,
      joinCount: (call.joinCount ?? 0) + 1,
      updatedAt: now,
    })

    return {
      ok: true,
      callId: call.id,
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
    const actor = users.find((user) => user.id === args.currentUserId)
    const mentionUserIds = createMentionIds(args.content, users).filter(
      (userId) => conversation.participantIds.includes(userId)
    )
    const mentionEmails: Array<{
      notificationId: string
      email: string
      name: string
      entityTitle: string
      entityType: "chat"
      entityId: string
      entityPath: string
      entityLabel: string
      actorName: string
      commentText: string
    }> = []
    const entityTitle = conversation.title.trim() || "a chat"
    const entityPath = await getChatConversationPath(ctx, conversation)
    const messageText = args.content.trim()
    const notifiedUserIds = new Set<string>()

    await ctx.db.insert("chatMessages", {
      id: messageId,
      conversationId: conversation.id,
      kind: "text",
      content: messageText,
      callId: null,
      mentionUserIds,
      createdBy: args.currentUserId,
      createdAt: now,
    })

    for (const mentionedUserId of mentionUserIds) {
      if (
        mentionedUserId === args.currentUserId ||
        notifiedUserIds.has(mentionedUserId)
      ) {
        continue
      }

      const mentionedUser = users.find((user) => user.id === mentionedUserId)
      const notification = createNotification(
        mentionedUserId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
        "chat",
        conversation.id,
        "mention"
      )

      await ctx.db.insert("notifications", notification)

      if (mentionedUser?.preferences.emailMentions) {
        mentionEmails.push({
          notificationId: notification.id,
          email: mentionedUser.email,
          name: mentionedUser.name,
          entityTitle,
          entityType: "chat",
          entityId: conversation.id,
          entityPath,
          entityLabel: "chat",
          actorName: actor?.name ?? "Someone",
          commentText: messageText,
        })
      }

      notifiedUserIds.add(mentionedUserId)
    }

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      messageId,
      mentionEmails,
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

    const users = await ctx.db.query("users").collect()
    const now = getNow()
    const postId = createId("channel_post")
    const actor = users.find((user) => user.id === args.currentUserId)
    const mentionUserIds = createMentionIds(args.content, users)
    const mentionEmails: Array<{
      notificationId: string
      email: string
      name: string
      entityTitle: string
      entityType: "channelPost"
      entityId: string
      entityPath: string
      entityLabel: string
      actorName: string
      commentText: string
    }> = []
    const notifiedUserIds = new Set<string>()
    const entityTitle = args.title.trim() || "a channel post"
    const entityPath = await getChannelConversationPath(
      ctx,
      conversation,
      postId
    )
    const commentText = getPlainTextContent(args.content)

    await ctx.db.insert("channelPosts", {
      id: postId,
      conversationId: conversation.id,
      title: args.title.trim(),
      content: args.content.trim(),
      reactions: [],
      createdBy: args.currentUserId,
      createdAt: now,
      updatedAt: now,
    })

    for (const mentionedUserId of mentionUserIds) {
      if (
        mentionedUserId === args.currentUserId ||
        notifiedUserIds.has(mentionedUserId)
      ) {
        continue
      }

      const mentionedUser = users.find((user) => user.id === mentionedUserId)
      const notification = createNotification(
        mentionedUserId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
        "channelPost",
        postId,
        "mention"
      )

      await ctx.db.insert("notifications", notification)

      if (mentionedUser?.preferences.emailMentions) {
        mentionEmails.push({
          notificationId: notification.id,
          email: mentionedUser.email,
          name: mentionedUser.name,
          entityTitle,
          entityType: "channelPost",
          entityId: postId,
          entityPath,
          entityLabel: "channel post",
          actorName: actor?.name ?? "Someone",
          commentText,
        })
      }

      notifiedUserIds.add(mentionedUserId)
    }

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      postId,
      mentionEmails,
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
    const actor = users.find((user) => user.id === args.currentUserId)
    const existingComments = await ctx.db
      .query("channelPostComments")
      .withIndex("by_post", (q) => q.eq("postId", post.id))
      .collect()
    const now = getNow()
    const commentId = createId("channel_comment")
    const mentionUserIds = createMentionIds(args.content, users)
    const notifiedUserIds = new Set<string>()
    const entityTitle = post.title.trim() || "a channel post"
    const entityPath = await getChannelConversationPath(
      ctx,
      conversation,
      post.id
    )
    const commentText = getPlainTextContent(args.content)
    const mentionEmails: Array<{
      notificationId: string
      email: string
      name: string
      entityTitle: string
      entityType: "channelPost"
      entityId: string
      entityPath: string
      entityLabel: string
      actorName: string
      commentText: string
    }> = []

    await ctx.db.insert("channelPostComments", {
      id: commentId,
      postId: post.id,
      content: args.content.trim(),
      mentionUserIds,
      createdBy: args.currentUserId,
      createdAt: now,
    })

    for (const mentionedUserId of mentionUserIds) {
      if (
        mentionedUserId === args.currentUserId ||
        notifiedUserIds.has(mentionedUserId)
      ) {
        continue
      }

      const mentionedUser = users.find((user) => user.id === mentionedUserId)
      const notification = createNotification(
        mentionedUserId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
        "channelPost",
        post.id,
        "mention"
      )

      await ctx.db.insert("notifications", notification)

      if (mentionedUser?.preferences.emailMentions) {
        mentionEmails.push({
          notificationId: notification.id,
          email: mentionedUser.email,
          name: mentionedUser.name,
          entityTitle,
          entityType: "channelPost",
          entityId: post.id,
          entityPath,
          entityLabel: "channel post",
          actorName: actor?.name ?? "Someone",
          commentText,
        })
      }

      notifiedUserIds.add(mentionedUserId)
    }

    const followerIds = [
      post.createdBy,
      ...existingComments.map((comment) => comment.createdBy),
    ]

    for (const followerId of followerIds) {
      if (
        !followerId ||
        followerId === args.currentUserId ||
        notifiedUserIds.has(followerId)
      ) {
        continue
      }

      await ctx.db.insert(
        "notifications",
        createNotification(
          followerId,
          args.currentUserId,
          `${actor?.name ?? "Someone"} commented on ${entityTitle}`,
          "channelPost",
          post.id,
          "comment"
        )
      )

      notifiedUserIds.add(followerId)
    }

    await ctx.db.patch(post._id, {
      updatedAt: now,
    })

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
      lastActivityAt: now,
    })

    return {
      commentId,
      mentionEmails,
    }
  },
})

export const deleteChannelPost = mutation({
  args: {
    currentUserId: v.string(),
    postId: v.string(),
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

    if (post.createdBy !== args.currentUserId) {
      throw new Error("You can only delete your own posts")
    }

    const comments = await ctx.db
      .query("channelPostComments")
      .withIndex("by_post", (q) => q.eq("postId", post.id))
      .collect()
    const notifications = (
      await ctx.db.query("notifications").collect()
    ).filter(
      (notification) =>
        notification.entityType === "channelPost" &&
        notification.entityId === post.id
    )

    for (const comment of comments) {
      await ctx.db.delete(comment._id)
    }

    for (const notification of notifications) {
      await ctx.db.delete(notification._id)
    }

    await ctx.db.delete(post._id)

    await ctx.db.patch(conversation._id, {
      updatedAt: getNow(),
      lastActivityAt: getNow(),
    })

    return {
      ok: true,
    }
  },
})

export const toggleChannelPostReaction = mutation({
  args: {
    currentUserId: v.string(),
    postId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await getChannelPostDoc(ctx, args.postId)

    if (!post) {
      throw new Error("Post not found")
    }

    await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, post.conversationId),
      args.currentUserId,
      "write"
    )

    await ctx.db.patch(post._id, {
      reactions: toggleReactionUsers(
        post.reactions,
        args.emoji.trim(),
        args.currentUserId
      ),
    })

    return {
      ok: true,
    }
  },
})
