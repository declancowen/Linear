import type { QueryCtx } from "../_generated/server"

import {
  createDefaultTeamWorkflowSettings,
  getDefaultShowChildItemsForItemLevel,
  getDefaultViewItemLevelForTeamExperience,
  normalizeTeamFeatureSettings,
  normalizeStoredViewItemLevel,
  normalizeStoredViewItemTypes,
  normalizeStoredWorkItemType,
  normalizeStoredWorkflowItemTypes,
  type StoredWorkItemType,
  type TeamExperienceType,
  type TeamWorkflowSettings,
  type UserStatus,
} from "../../lib/domain/types"
import {
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
  normalizeTeamIcon,
} from "./core"
import { type AppCtx } from "./data"

const DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS = 2 * 60 * 1000

export function normalizeWorkspace<
  T extends { workosOrganizationId?: string | null },
>(workspace: T) {
  return {
    ...workspace,
    workosOrganizationId: workspace.workosOrganizationId ?? null,
  }
}

export function normalizeUser<
  T extends {
    emailNormalized?: string | null
    workosUserId?: string | null
    status?: string | null
    statusMessage?: string | null
    hasExplicitStatus?: boolean | null
    accountDeletionPendingAt?: string | null
    accountDeletedAt?: string | null
  },
>(user: T) {
  const restUser = {
    ...(user as T & { emailNormalized?: string | null }),
  }
  delete restUser.emailNormalized
  const normalizedUser = {
    ...restUser,
    workosUserId: user.workosUserId ?? null,
    hasExplicitStatus: resolveExplicitUserStatusFlag(user),
    accountDeletionPendingAt: user.accountDeletionPendingAt ?? null,
    accountDeletedAt: user.accountDeletedAt ?? null,
    status: resolveUserStatus(user.status),
    statusMessage: user.statusMessage ?? defaultUserStatusMessage,
  }

  return applyNormalizedUserPreferences(normalizedUser, user)
}

function resolveExplicitUserStatusFlag(user: {
  hasExplicitStatus?: boolean | null
  status?: string | null
}) {
  return typeof user.hasExplicitStatus === "boolean"
    ? user.hasExplicitStatus
    : user.status != null
}

function applyNormalizedUserPreferences<T>(normalizedUser: T, user: unknown) {
  const preferences = getNormalizedUserPreferences(user)

  if (!preferences) {
    return normalizedUser
  }

  return {
    ...normalizedUser,
    preferences,
  }
}

function getNormalizedUserPreferences(user: unknown) {
  if (!user || typeof user !== "object" || !("preferences" in user)) {
    return null
  }

  const preferences = user.preferences

  if (!preferences || typeof preferences !== "object") {
    return null
  }

  return {
    ...defaultUserPreferences,
    ...(preferences as Partial<typeof defaultUserPreferences>),
  }
}

export function resolveUserStatus(
  status: string | null | undefined
): UserStatus {
  return status === "offline" ||
    status === "active" ||
    status === "away" ||
    status === "busy" ||
    status === "out-of-office"
    ? status
    : defaultUserStatus
}

export async function resolveWorkspaceSnapshot<
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

export async function resolveUserSnapshot<
  T extends {
    avatarImageStorageId?: string | null
    workosUserId?: string | null
  },
>(ctx: AppCtx, user: T) {
  const avatarImageUrl = user.avatarImageStorageId
    ? await ctx.storage.getUrl(user.avatarImageStorageId as never)
    : null

  return {
    ...normalizeUser(user),
    avatarImageUrl,
  }
}

function isActiveDocumentPresence(lastSeenAt: string) {
  const parsedLastSeenAt = Date.parse(lastSeenAt)

  if (!Number.isFinite(parsedLastSeenAt)) {
    return false
  }

  return Date.now() - parsedLastSeenAt <= DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS
}

function getDocumentPresenceViewerKey(entry: {
  userId: string
  workosUserId?: string | null
}) {
  return entry.workosUserId ?? entry.userId
}

export async function listDocumentPresenceViewers(
  ctx: AppCtx,
  documentId: string,
  currentUserId: string,
  currentWorkosUserId?: string
) {
  const entries = await ctx.db
    .query("documentPresence")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect()

  const currentViewerKey = currentWorkosUserId ?? currentUserId
  const latestEntryByViewerKey = new Map<string, (typeof entries)[number]>()

  for (const entry of entries
    .filter((candidate) => isActiveDocumentPresence(candidate.lastSeenAt))
    .sort(
      (left, right) =>
        Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
    )) {
    const viewerKey = getDocumentPresenceViewerKey(entry)

    if (
      viewerKey === currentViewerKey ||
      latestEntryByViewerKey.has(viewerKey)
    ) {
      continue
    }

    latestEntryByViewerKey.set(viewerKey, entry)
  }

  const latestEntries = [...latestEntryByViewerKey.values()]
  return latestEntries.map((entry) => ({
    userId: getDocumentPresenceViewerKey(entry),
    name: entry.name ?? "User",
    avatarUrl: entry.avatarUrl ?? "",
    avatarImageUrl: entry.avatarImageUrl ?? null,
    activeBlockId: entry.activeBlockId ?? null,
    lastSeenAt: entry.lastSeenAt,
  }))
}

export function normalizeTeamWorkflowSettings(
  workflow:
    | (Omit<TeamWorkflowSettings, "templateDefaults"> & {
        templateDefaults: Record<
          "software-delivery" | "bug-tracking" | "project-management",
          Omit<
            TeamWorkflowSettings["templateDefaults"]["software-delivery"],
            "recommendedItemTypes"
          > & {
            recommendedItemTypes: StoredWorkItemType[]
          }
        >
      })
    | null
    | undefined,
  experience: TeamExperienceType | null | undefined = "software-development"
) {
  const defaults = createDefaultTeamWorkflowSettings(
    experience ?? "software-development"
  )

  if (!workflow) {
    return defaults
  }

  const sanitizeRecommendedItemTypes = (
    templateType: "software-delivery" | "bug-tracking" | "project-management"
  ) => {
    const recommendedItemTypes = normalizeStoredWorkflowItemTypes(
      workflow.templateDefaults[templateType].recommendedItemTypes,
      experience,
      templateType
    )

    return recommendedItemTypes.length > 0
      ? recommendedItemTypes
      : defaults.templateDefaults[templateType].recommendedItemTypes
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
        recommendedItemTypes: sanitizeRecommendedItemTypes("software-delivery"),
      },
      "bug-tracking": {
        ...defaults.templateDefaults["bug-tracking"],
        ...workflow.templateDefaults["bug-tracking"],
        recommendedItemTypes: sanitizeRecommendedItemTypes("bug-tracking"),
      },
      "project-management": {
        ...defaults.templateDefaults["project-management"],
        ...workflow.templateDefaults["project-management"],
        recommendedItemTypes:
          sanitizeRecommendedItemTypes("project-management"),
      },
    },
  }
}

export function normalizeTeamFeatures(
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
  return normalizeTeamFeatureSettings(experience, features)
}

export function normalizeTeam<T extends { settings: Record<string, unknown> }>(
  team: T
) {
  const restTeam = {
    ...(team as T & { joinCodeNormalized?: string }),
  }
  delete restTeam.joinCodeNormalized
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
    ...restTeam,
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

export function normalizeDocument<
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

export function normalizeWorkItem<
  T extends {
    teamId: string
    type: StoredWorkItemType
    parentId?: string | null
  },
>(
  item: T,
  teams: Array<{
    id: string
    settings?: {
      experience?: TeamExperienceType | null
    }
  }>
) {
  const experience =
    teams.find((team) => team.id === item.teamId)?.settings?.experience ??
    "software-development"

  return {
    ...item,
    type: normalizeStoredWorkItemType(item.type, experience, {
      parentId: item.parentId ?? null,
    }),
  }
}

export function normalizeViewDefinition<
  T extends {
    scopeType: "personal" | "team" | "workspace"
    scopeId: string
    entityKind?: "items" | "projects" | "docs"
    filters: {
      itemTypes: StoredWorkItemType[]
    }
    itemLevel?: StoredWorkItemType | null
    showChildItems?: boolean
  },
>(
  view: T,
  teams: Array<{
    id: string
    settings?: {
      experience?: TeamExperienceType | null
    }
  }>
) {
  const experience = getViewDefinitionTeamExperience(view, teams)
  const normalizedItemLevel = normalizeViewDefinitionItemLevel(view, experience)

  return {
    ...view,
    itemLevel: normalizedItemLevel,
    showChildItems: normalizeViewDefinitionShowChildItems(
      view,
      normalizedItemLevel
    ),
    filters: {
      ...view.filters,
      itemTypes: normalizeStoredViewItemTypes(
        view.filters.itemTypes,
        experience
      ),
    },
  }
}

function getViewDefinitionTeamExperience(
  view: {
    scopeType: "personal" | "team" | "workspace"
    scopeId: string
  },
  teams: Array<{
    id: string
    settings?: {
      experience?: TeamExperienceType | null
    }
  }>
) {
  if (view.scopeType !== "team") {
    return null
  }

  return (
    teams.find((team) => team.id === view.scopeId)?.settings?.experience ??
    "software-development"
  )
}

function normalizeViewDefinitionItemLevel(
  view: {
    scopeType: "personal" | "team" | "workspace"
    entityKind?: "items" | "projects" | "docs"
    itemLevel?: StoredWorkItemType | null
  },
  experience: TeamExperienceType | null
) {
  if (view.entityKind !== "items") {
    return null
  }

  const defaultItemLevel =
    view.scopeType === "team"
      ? getDefaultViewItemLevelForTeamExperience(experience)
      : null

  return normalizeStoredViewItemLevel(
    view.itemLevel ?? defaultItemLevel,
    experience
  )
}

function normalizeViewDefinitionShowChildItems(
  view: {
    entityKind?: "items" | "projects" | "docs"
    showChildItems?: boolean
  },
  normalizedItemLevel: ReturnType<typeof normalizeStoredViewItemLevel> | null
) {
  if (view.entityKind !== "items" || !normalizedItemLevel) {
    return false
  }

  return (
    view.showChildItems ??
    getDefaultShowChildItemsForItemLevel(normalizedItemLevel)
  )
}
