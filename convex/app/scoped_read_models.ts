import type { QueryCtx } from "../_generated/server"
import { v } from "convex/values"

import type {
  AppSnapshot,
  Attachment,
  Call,
  ChannelPost,
  ChannelPostComment,
  ChatMessage,
  Comment,
  Conversation,
  CustomPropertyDefinition,
  CustomPropertyValueRecord,
  Document,
  Invite,
  Label,
  Milestone,
  Notification,
  Project,
  ProjectUpdate,
  Team,
  TeamMembership,
  UserProfile,
  ViewDefinition,
  WorkItem,
  WorkItemActivity,
  Workspace,
  WorkspaceMembership,
} from "../../lib/domain/types"
import { isLabelVisibleToUser } from "../../lib/domain/labels"
import {
  getChannelPostRelatedScopeKeys,
  getChatMessageRelatedScopeKeys,
  getConversationRelatedScopeKeys,
  getCustomPropertyDefinitionScopeKeys,
  getDocumentRelatedScopeKeys,
  getProjectRelatedScopeKeys,
  getUserWorkspaceMembershipScopeKeys,
  getViewRelatedScopeKeys,
  getWorkItemDetailScopeKeys,
  selectReadModelForInstruction,
  type ScopedReadModelPatch,
  type ScopedReadModelReplaceInstruction,
} from "../../lib/scoped-sync/read-models"
import {
  createScopedCollectionScopeId,
  parseReadModelScopeKey,
  READ_MODEL_SCOPE_KINDS,
} from "../../lib/scoped-sync/scope-keys"
import {
  requireReadableDocumentAccess,
  requireReadableTeamAccess,
  requireReadableWorkItemAccess,
  requireReadableWorkspaceAccess,
} from "./access"
import { requireConversationAccess } from "./conversations"
import {
  assertServerToken,
  normalizeEmailAddress,
} from "./core"
import {
  getChannelPostDoc,
  getChatMessageDoc,
  getConversationDoc,
  getDocumentDoc,
  getProjectDoc,
  getUserAppState,
  getViewDoc,
  getWorkItemDoc,
  listAttachmentsByTargets,
  listCallsByConversation,
  listChannelPostCommentsByPosts,
  listChannelPostsByConversation,
  listChatMessagesByConversation,
  listLatestReadableChatMessagesByConversations,
  listChatReadStatesByUser,
  listCommentsByTargets,
  listConversationsByScope,
  listCustomPropertyDefinitionsByTeams,
  listCustomPropertyValuesByWorkItems,
  listDocumentsByIds,
  listInvitesByNormalizedEmail,
  listInvitesByTeams,
  listLabelsByWorkspaces,
  listMilestonesByProjects,
  listNotificationsByUser,
  listPrivateWorkItemsByCreator,
  listProjectUpdatesByProjects,
  listProjectsByScope,
  listTeamDocuments,
  listTeamMembershipsByTeams,
  listTeamMembershipsByUser,
  listTeamsByIds,
  listUsersByIds,
  listViewsByScope,
  listViewsByScopeEntity,
  listWorkItemActivitiesByWorkItems,
  listWorkItemsByTeam,
  listWorkspaceDocuments,
  listWorkspaceMembershipsByUser,
  listWorkspaceMembershipsByWorkspaces,
  listWorkspacesByIds,
  listWorkspacesOwnedByUser,
  resolvePreferredWorkspaceId,
} from "./data"
import {
  normalizeBootstrapChatMessage,
} from "./auth_bootstrap"
import {
  normalizeDocument,
  normalizeTeam,
  normalizeViewDefinition,
  normalizeWorkItem,
  resolveUserSnapshot,
  resolveWorkspaceSnapshot,
} from "./normalization"
import { resolveUserFromServerArgs } from "./server_users"

export const scopedReadModelInstructionValidator = v.union(
  v.object({
    kind: v.literal("document-detail"),
    documentId: v.string(),
  }),
  v.object({
    kind: v.literal("document-index"),
    scopeType: v.union(v.literal("team"), v.literal("workspace")),
    scopeId: v.string(),
  }),
  v.object({
    kind: v.literal("work-item-detail"),
    itemId: v.string(),
  }),
  v.object({
    kind: v.literal("work-index"),
    scopeType: v.union(
      v.literal("personal"),
      v.literal("team"),
      v.literal("workspace")
    ),
    scopeId: v.string(),
  }),
  v.object({
    kind: v.literal("project-detail"),
    projectId: v.string(),
  }),
  v.object({
    kind: v.literal("project-index"),
    scopeType: v.union(v.literal("team"), v.literal("workspace")),
    scopeId: v.string(),
  }),
  v.object({
    kind: v.literal("workspace-people"),
    workspaceId: v.string(),
  }),
  v.object({
    kind: v.literal("view-catalog"),
    scopeType: v.union(v.literal("team"), v.literal("workspace")),
    scopeId: v.string(),
  }),
  v.object({
    kind: v.literal("notification-inbox"),
  }),
  v.object({
    kind: v.literal("conversation-list"),
  }),
  v.object({
    kind: v.literal("conversation-thread"),
    conversationId: v.string(),
  }),
  v.object({
    kind: v.literal("channel-feed"),
    conversationId: v.string(),
  }),
  v.object({
    kind: v.literal("search-seed"),
    workspaceId: v.string(),
  })
)

export const scopedReadModelScopeKeyTargetValidator = v.union(
  v.object({
    kind: v.literal("document"),
    documentId: v.string(),
  }),
  v.object({
    kind: v.literal("work-item"),
    itemId: v.string(),
  }),
  v.object({
    kind: v.literal("custom-property-definition"),
    teamId: v.string(),
  }),
  v.object({
    kind: v.literal("project"),
    projectId: v.string(),
  }),
  v.object({
    kind: v.literal("view"),
    viewId: v.string(),
  }),
  v.object({
    kind: v.literal("conversation"),
    conversationId: v.string(),
  }),
  v.object({
    kind: v.literal("channel-post"),
    postId: v.string(),
  }),
  v.object({
    kind: v.literal("chat-message"),
    messageId: v.string(),
  }),
  v.object({
    kind: v.literal("user-workspace-membership"),
    userId: v.string(),
  })
)

type ScopedReadModelInstruction =
  | { kind: "document-detail"; documentId: string }
  | {
      kind: "document-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "work-item-detail"; itemId: string }
  | {
      kind: "work-index"
      scopeType: "personal" | "team" | "workspace"
      scopeId: string
    }
  | { kind: "project-detail"; projectId: string }
  | {
      kind: "project-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "workspace-people"; workspaceId: string }
  | {
      kind: "view-catalog"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "notification-inbox" }
  | { kind: "conversation-list" }
  | { kind: "conversation-thread"; conversationId: string }
  | { kind: "channel-feed"; conversationId: string }
  | { kind: "search-seed"; workspaceId: string }

type ScopedReadModelArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  instruction: ScopedReadModelInstruction
}

type ScopedReadModelScopeKeyTarget =
  | { kind: "document"; documentId: string }
  | { kind: "work-item"; itemId: string }
  | { kind: "custom-property-definition"; teamId: string }
  | { kind: "project"; projectId: string }
  | { kind: "view"; viewId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "channel-post"; postId: string }
  | { kind: "chat-message"; messageId: string }
  | { kind: "user-workspace-membership"; userId: string }

type ScopedReadModelScopeKeyArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  target: ScopedReadModelScopeKeyTarget
}

type AuthorizeScopedReadModelScopeKeysArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  scopeKeys: string[]
}

type ScopedUserContext = {
  accessibleTeamIds: Set<string>
  accessibleWorkspaceIds: Set<string>
  currentUserEmail: string
  currentUserId: string
  currentWorkspaceId: string
  teams: Team[]
  workspaces: Workspace[]
  workspaceMemberships: WorkspaceMembership[]
  teamMemberships: TeamMembership[]
}

type ScopedCollections = Partial<{
  attachments: Attachment[]
  calls: Call[]
  channelPostComments: ChannelPostComment[]
  channelPosts: ChannelPost[]
  chatMessages: ChatMessage[]
  chatReadStates: AppSnapshot["chatReadStates"]
  comments: Comment[]
  conversations: Conversation[]
  customPropertyDefinitions: CustomPropertyDefinition[]
  customPropertyValues: CustomPropertyValueRecord[]
  documents: Document[]
  invites: Invite[]
  labels: Label[]
  milestones: Milestone[]
  notifications: Notification[]
  projectUpdates: ProjectUpdate[]
  projects: Project[]
  teamMemberships: TeamMembership[]
  teams: Team[]
  users: UserProfile[]
  views: ViewDefinition[]
  workItemActivities: WorkItemActivity[]
  workItems: WorkItem[]
  workspaceMemberships: WorkspaceMembership[]
  workspaces: Workspace[]
}>

function dedupeById<T extends { id: string }>(entries: Iterable<T>) {
  return [
    ...new Map([...entries].map((entry) => [entry.id, entry] as const)).values(),
  ]
}

function dedupeMemberships<T extends { teamId?: string; workspaceId?: string; userId: string }>(
  entries: Iterable<T>
) {
  return [
    ...new Map(
      [...entries].map((entry) => [
        `${entry.teamId ?? entry.workspaceId ?? ""}:${entry.userId}`,
        entry,
      ] as const)
    ).values(),
  ]
}

function compactStringIds(values: Iterable<string | null | undefined>) {
  return [...values].filter((value): value is string => Boolean(value))
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}

async function loadScopedUserContext(
  ctx: QueryCtx,
  args: ScopedReadModelArgs
): Promise<ScopedUserContext> {
  assertServerToken(args.serverToken)
  const user = await resolveUserFromServerArgs(ctx, args)

  if (!user) {
    throw new Error("Authenticated user not found")
  }

  const currentUserId = user.id
  const currentUserEmail = user.email
  const [
    userAppState,
    workspaceMemberships,
    teamMemberships,
    ownedWorkspaces,
  ] = await Promise.all([
    getUserAppState(ctx, currentUserId),
    listWorkspaceMembershipsByUser(ctx, currentUserId),
    listTeamMembershipsByUser(ctx, currentUserId),
    listWorkspacesOwnedByUser(ctx, currentUserId),
  ])
  const teams = await listTeamsByIds(
    ctx,
    teamMemberships.map((membership) => membership.teamId)
  )
  const accessibleWorkspaceIds = new Set<string>([
    ...workspaceMemberships.map((membership) => membership.workspaceId),
    ...teams.map((team) => team.workspaceId),
    ...ownedWorkspaces.map((workspace) => workspace.id),
  ])
  const accessibleTeamIds = new Set(teams.map((team) => team.id))
  const workspaces = dedupeById([
    ...ownedWorkspaces,
    ...(await listWorkspacesByIds(ctx, accessibleWorkspaceIds)),
  ])
  const currentWorkspaceId =
    resolvePreferredWorkspaceId({
      selectedWorkspaceId: args.selectedWorkspaceId ?? null,
      accessibleWorkspaceIds,
      fallbackWorkspaceIds: [
        userAppState?.currentWorkspaceId,
        workspaceMemberships[0]?.workspaceId,
        teams[0]?.workspaceId,
        workspaces[0]?.id,
      ],
    }) ?? ""

  return {
    accessibleTeamIds,
    accessibleWorkspaceIds,
    currentUserEmail,
    currentUserId,
    currentWorkspaceId,
    teams: teams as Team[],
    workspaces: workspaces as Workspace[],
    workspaceMemberships: workspaceMemberships as WorkspaceMembership[],
    teamMemberships: teamMemberships as TeamMembership[],
  }
}

function filterAccessibleTeams(
  context: ScopedUserContext,
  scopeType: "personal" | "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return context.teams.filter((team) => team.id === scopeId)
  }

  if (scopeType === "workspace") {
    return context.teams.filter((team) => team.workspaceId === scopeId)
  }

  return context.teams
}

function isAccessibleCollectionScope(
  context: ScopedUserContext,
  scopeType: "personal" | "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "personal") {
    return scopeId === context.currentUserId
  }

  if (scopeType === "team") {
    return context.accessibleTeamIds.has(scopeId)
  }

  return context.accessibleWorkspaceIds.has(scopeId)
}

function isReadableScopedDocument(
  document: Document,
  context: ScopedUserContext,
  options: {
    visibleWorkItemDescriptionDocIds?: ReadonlySet<string>
  } = {}
) {
  if (document.kind === "item-description") {
    return (
      options.visibleWorkItemDescriptionDocIds?.has(document.id) ?? false
    )
  }

  if (document.kind === "team-document") {
    return Boolean(
      document.teamId && context.accessibleTeamIds.has(document.teamId)
    )
  }

  if (document.kind === "private-document") {
    return (
      document.createdBy === context.currentUserId &&
      context.accessibleWorkspaceIds.has(document.workspaceId)
    )
  }

  return context.accessibleWorkspaceIds.has(document.workspaceId)
}

function isReadableScopedProject(project: Project, context: ScopedUserContext) {
  return project.scopeType === "team"
    ? context.accessibleTeamIds.has(project.scopeId)
    : context.accessibleWorkspaceIds.has(project.scopeId)
}

function isReadableScopedConversation(
  conversation: Conversation,
  context: ScopedUserContext
) {
  if (conversation.scopeType === "team") {
    return context.accessibleTeamIds.has(conversation.scopeId)
  }

  if (!context.accessibleWorkspaceIds.has(conversation.scopeId)) {
    return false
  }

  return (
    conversation.kind === "channel" ||
    conversation.participantIds.includes(context.currentUserId)
  )
}

async function loadProjectsByScopes(
  ctx: QueryCtx,
  scopes: Iterable<{ scopeType: "team" | "workspace"; scopeId: string }>
) {
  const uniqueScopes = [
    ...new Map(
      [...scopes].map((scope) => [
        `${scope.scopeType}:${scope.scopeId}`,
        scope,
      ] as const)
    ).values(),
  ]

  return (
    await Promise.all(
      uniqueScopes.map((scope) =>
        listProjectsByScope(ctx, scope.scopeType, scope.scopeId)
      )
    )
  ).flat() as Project[]
}

async function getProjectsByIds(ctx: QueryCtx, projectIds: Iterable<string>) {
  return (
    await Promise.all([...new Set(projectIds)].map((id) => getProjectDoc(ctx, id)))
  ).filter(isPresent) as unknown as Project[]
}

async function getWorkItemsByIds(ctx: QueryCtx, itemIds: Iterable<string>) {
  return (
    await Promise.all([...new Set(itemIds)].map((id) => getWorkItemDoc(ctx, id)))
  ).filter(isPresent) as unknown as WorkItem[]
}

async function getDocumentsByIds(ctx: QueryCtx, documentIds: Iterable<string>) {
  return (await listDocumentsByIds(ctx, documentIds)) as Document[]
}

async function loadWorkItemsForScope(
  ctx: QueryCtx,
  context: ScopedUserContext,
  scopeType: "personal" | "team" | "workspace",
  scopeId: string
) {
  if (!isAccessibleCollectionScope(context, scopeType, scopeId)) {
    return [] as WorkItem[]
  }

  if (scopeType === "team") {
    return (await listWorkItemsByTeam(ctx, scopeId)) as WorkItem[]
  }

  const teams = filterAccessibleTeams(context, scopeType, scopeId)
  const teamItems = (
    await Promise.all(teams.map((team) => listWorkItemsByTeam(ctx, team.id)))
  ).flat() as WorkItem[]

  if (scopeType === "personal") {
    return dedupeById([
      ...teamItems,
      ...((await listPrivateWorkItemsByCreator(
        ctx,
        context.currentUserId
      )) as WorkItem[]),
    ])
  }

  return teamItems
}

async function loadDocumentsForScope(
  ctx: QueryCtx,
  context: ScopedUserContext,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (!isAccessibleCollectionScope(context, scopeType, scopeId)) {
    return [] as Document[]
  }

  if (scopeType === "team") {
    return (await listTeamDocuments(ctx, scopeId)) as Document[]
  }

  return (await listWorkspaceDocuments(ctx, scopeId)) as Document[]
}

async function loadViewsForScope(
  ctx: QueryCtx,
  context: ScopedUserContext,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string,
  entityKind?: "items" | "projects" | "docs"
) {
  if (!isAccessibleCollectionScope(context, scopeType, scopeId)) {
    return [] as ViewDefinition[]
  }

  if (scopeType === "personal") {
    return (await listViewsByScope(ctx, "personal", scopeId)) as ViewDefinition[]
  }

  if (entityKind) {
    return ((await listViewsByScope(
      ctx,
      scopeType,
      scopeId
    )) as ViewDefinition[]).filter((view) => view.entityKind === entityKind)
  }

  const scopeViews = (await listViewsByScope(
    ctx,
    scopeType,
    scopeId
  )) as ViewDefinition[]
  const personalWorkspaceViews =
    scopeType === "workspace" && scopeId === context.currentWorkspaceId
      ? ((await listViewsByScope(
          ctx,
          "personal",
          context.currentUserId
        )) as ViewDefinition[]).filter((view) =>
          view.route.startsWith("/workspace/")
        )
      : []

  return [...scopeViews, ...personalWorkspaceViews]
}

async function loadCollectionReadModelCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  instruction: Extract<
    ScopedReadModelInstruction,
    { kind: "document-index" | "project-index" | "work-index" | "view-catalog" }
  >
): Promise<ScopedCollections> {
  if (
    !isAccessibleCollectionScope(
      context,
      instruction.scopeType,
      instruction.scopeId
    )
  ) {
    return {}
  }

  const teams = filterAccessibleTeams(
    context,
    instruction.scopeType,
    instruction.scopeId
  )
  const teamIds = new Set(teams.map((team) => team.id))
  const workspaceIds = new Set(
    instruction.scopeType === "workspace"
      ? [instruction.scopeId]
      : teams.map((team) => team.workspaceId)
  )

  if (instruction.kind === "document-index") {
    const documents = await loadDocumentsForScope(
      ctx,
      context,
      instruction.scopeType,
      instruction.scopeId
    )
    const projects = await getProjectsByIds(
      ctx,
      documents.flatMap((document) => document.linkedProjectIds)
    )
    const workItems = await getWorkItemsByIds(
      ctx,
      documents.flatMap((document) => document.linkedWorkItemIds)
    )
    const views = await loadViewsForScope(
      ctx,
      context,
      instruction.scopeType,
      instruction.scopeId,
      "docs"
    )

    return { documents, projects, workItems, teams, views }
  }

  if (instruction.kind === "project-index") {
    const projectScopes = [
      ...(instruction.scopeType === "workspace"
        ? [{ scopeType: "workspace" as const, scopeId: instruction.scopeId }]
        : []),
      ...teams.map((team) => ({
        scopeType: "team" as const,
        scopeId: team.id,
      })),
    ]
    const projects = await loadProjectsByScopes(ctx, projectScopes)
    const workItems = await loadWorkItemsForScope(
      ctx,
      context,
      instruction.scopeType,
      instruction.scopeId
    )
    const projectIds = new Set(projects.map((project) => project.id))
    const projectWorkItems = workItems.filter(
      (item) =>
        (item.primaryProjectId && projectIds.has(item.primaryProjectId)) ||
        item.linkedProjectIds.some((projectId) => projectIds.has(projectId))
    )
    const customPropertyDefinitions =
      await listCustomPropertyDefinitionsByTeams(ctx, teamIds)
    const customPropertyValues = await listCustomPropertyValuesByWorkItems(
      ctx,
      projectWorkItems.map((item) => item.id)
    )
    const views = await loadViewsForScope(
      ctx,
      context,
      instruction.scopeType,
      instruction.scopeId,
      "projects"
    )

    return {
      customPropertyDefinitions: customPropertyDefinitions as CustomPropertyDefinition[],
      customPropertyValues: customPropertyValues as CustomPropertyValueRecord[],
      projects,
      teams,
      views,
      workItems: projectWorkItems,
    }
  }

  if (instruction.kind === "view-catalog") {
    const views = [
      ...(await loadViewsForScope(
        ctx,
        context,
        instruction.scopeType,
        instruction.scopeId
      )),
      ...(instruction.scopeType === "workspace"
        ? (
            await Promise.all(
              teams.map((team) => listViewsByScope(ctx, "team", team.id))
            )
          ).flat()
        : []),
    ] as ViewDefinition[]
    const customPropertyDefinitions =
      await listCustomPropertyDefinitionsByTeams(ctx, teamIds)

    return {
      customPropertyDefinitions: customPropertyDefinitions as CustomPropertyDefinition[],
      teams,
      views,
      workspaces: context.workspaces.filter((workspace) =>
        workspaceIds.has(workspace.id)
      ),
    }
  }

  const workItems = await loadWorkItemsForScope(
    ctx,
    context,
    instruction.scopeType,
    instruction.scopeId
  )
  const projectScopes = [
    ...teams.map((team) => ({ scopeType: "team" as const, scopeId: team.id })),
    ...[...workspaceIds].map((workspaceId) => ({
      scopeType: "workspace" as const,
      scopeId: workspaceId,
    })),
  ]
  const projects = await loadProjectsByScopes(ctx, projectScopes)
  const milestones = await listMilestonesByProjects(
    ctx,
    projects.map((project) => project.id)
  )
  const customPropertyDefinitions =
    await listCustomPropertyDefinitionsByTeams(ctx, teamIds)
  const customPropertyValues = await listCustomPropertyValuesByWorkItems(
    ctx,
    workItems.map((item) => item.id)
  )
  const views = await loadViewsForScope(
    ctx,
    context,
    instruction.scopeType,
    instruction.scopeId,
    "items"
  )

  return {
    customPropertyDefinitions: customPropertyDefinitions as CustomPropertyDefinition[],
    customPropertyValues: customPropertyValues as CustomPropertyValueRecord[],
    milestones: milestones as Milestone[],
    projects,
    teams,
    views,
    workItems,
  }
}

async function loadDocumentDetailCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  documentId: string
): Promise<ScopedCollections> {
  const document = (await getDocumentDoc(ctx, documentId)) as Document | null

  if (!document) {
    return { documents: [] }
  }

  await requireReadableDocumentAccess(ctx, document as never, context.currentUserId)

  const [comments, attachments] = await Promise.all([
    listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: [document.id],
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "document",
      targetIds: [document.id],
    }),
  ])

  return {
    attachments: attachments as unknown as Attachment[],
    comments: comments as Comment[],
    documents: [document],
  }
}

async function loadWorkItemDetailCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  itemId: string
): Promise<ScopedCollections> {
  const item = (await getWorkItemDoc(ctx, itemId)) as WorkItem | null

  if (!item) {
    return { workItems: [] }
  }

  await requireReadableWorkItemAccess(ctx, item as never, context.currentUserId)

  const itemWorkspaceId =
    item.workspaceId ??
    context.teams.find((team) => team.id === item.teamId)?.workspaceId ??
    ""
  const workItems =
    (item.visibility ?? "team") === "private"
      ? ((await listPrivateWorkItemsByCreator(
          ctx,
          item.creatorId
        )) as WorkItem[]).filter(
          (candidate) =>
            (candidate.workspaceId ?? itemWorkspaceId) === itemWorkspaceId
        )
      : item.teamId
        ? ((await listWorkItemsByTeam(ctx, item.teamId)) as WorkItem[])
        : [item]
  const workItemIds = new Set(workItems.map((entry) => entry.id))
  const linkedDocumentIds = new Set<string>([
    item.descriptionDocId,
    ...item.linkedDocumentIds,
  ])
  const visibleWorkItemDescriptionDocIds = new Set(
    compactStringIds(workItems.map((entry) => entry.descriptionDocId))
  )
  const workspaceDocuments = itemWorkspaceId
    ? ((await listWorkspaceDocuments(ctx, itemWorkspaceId)) as Document[])
    : []
  const documents = dedupeById([
    ...(await getDocumentsByIds(ctx, linkedDocumentIds)),
    ...workspaceDocuments.filter((document) =>
      document.linkedWorkItemIds.includes(item.id)
    ),
  ]).filter((document) =>
    isReadableScopedDocument(document, context, {
      visibleWorkItemDescriptionDocIds,
    })
  )
  const relatedProjectIds = new Set(
    compactStringIds(
      workItems.flatMap((candidate) => [
        candidate.primaryProjectId,
        ...candidate.linkedProjectIds,
      ])
    )
  )
  const projects = dedupeById([
    ...(await getProjectsByIds(ctx, relatedProjectIds)),
    ...(item.teamId
      ? ((await listProjectsByScope(ctx, "team", item.teamId)) as Project[])
      : []),
    ...(itemWorkspaceId
      ? ((await listProjectsByScope(
          ctx,
          "workspace",
          itemWorkspaceId
        )) as Project[])
      : []),
  ])
  const [milestones, comments, attachments, activities] = await Promise.all([
    listMilestonesByProjects(ctx, projects.map((project) => project.id)),
    listCommentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: [item.id],
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: [item.id],
    }),
    listWorkItemActivitiesByWorkItems(ctx, [item.id]),
  ])
  const teamIds = new Set(compactStringIds(workItems.map((entry) => entry.teamId)))
  const customPropertyDefinitions =
    await listCustomPropertyDefinitionsByTeams(ctx, teamIds)
  const customPropertyValues = await listCustomPropertyValuesByWorkItems(
    ctx,
    workItemIds
  )

  return {
    attachments: attachments as unknown as Attachment[],
    comments: comments as Comment[],
    customPropertyDefinitions: customPropertyDefinitions as CustomPropertyDefinition[],
    customPropertyValues: customPropertyValues as CustomPropertyValueRecord[],
    documents,
    milestones: milestones as Milestone[],
    projects,
    workItemActivities: activities as WorkItemActivity[],
    workItems,
  }
}

async function loadProjectDetailCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  projectId: string
): Promise<ScopedCollections> {
  const project = (await getProjectDoc(ctx, projectId)) as Project | null

  if (!project) {
    return { projects: [] }
  }

  if (project.scopeType === "team") {
    await requireReadableTeamAccess(ctx, project.scopeId, context.currentUserId)
  } else {
    await requireReadableWorkspaceAccess(
      ctx,
      project.scopeId,
      context.currentUserId
    )
  }

  const teams =
    project.scopeType === "team"
      ? context.teams.filter((team) => team.id === project.scopeId)
      : context.teams.filter((team) => team.workspaceId === project.scopeId)
  const workItems = (
    await Promise.all(teams.map((team) => listWorkItemsByTeam(ctx, team.id)))
  )
    .flat()
    .filter(
      (item) =>
        item.primaryProjectId === project.id ||
        item.linkedProjectIds.includes(project.id) ||
        (item.referencedProjectIds ?? []).includes(project.id)
    ) as WorkItem[]
  const workspaceIds = new Set([
    project.scopeType === "workspace" ? project.scopeId : null,
    ...teams.map((team) => team.workspaceId),
  ].filter((value): value is string => Boolean(value)))
  const documents = (
    await Promise.all([...workspaceIds].map((id) => listWorkspaceDocuments(ctx, id)))
  )
    .flat()
    .filter(
      (document) =>
        document.kind !== "item-description" &&
        isReadableScopedDocument(document as Document, context) &&
        document.linkedProjectIds.includes(project.id)
    ) as Document[]
  const [updates, milestones, views] = await Promise.all([
    listProjectUpdatesByProjects(ctx, [project.id]),
    listMilestonesByProjects(ctx, [project.id]),
    Promise.all([
      listViewsByScope(ctx, project.scopeType, project.scopeId),
      listViewsByScopeEntity(ctx, project.scopeType, project.scopeId, "items"),
    ]).then((entries) => entries.flat()),
  ])
  const customPropertyDefinitions =
    await listCustomPropertyDefinitionsByTeams(
      ctx,
      teams.map((team) => team.id)
    )
  const customPropertyValues = await listCustomPropertyValuesByWorkItems(
    ctx,
    workItems.map((item) => item.id)
  )

  return {
    customPropertyDefinitions: customPropertyDefinitions as CustomPropertyDefinition[],
    customPropertyValues: customPropertyValues as CustomPropertyValueRecord[],
    documents,
    milestones: milestones as Milestone[],
    projectUpdates: updates as ProjectUpdate[],
    projects: [project],
    teams,
    views: views as ViewDefinition[],
    workItems,
  }
}

async function loadConversationCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  conversationId: string,
  kind: "chat" | "channel"
): Promise<ScopedCollections> {
  const conversation = (await getConversationDoc(
    ctx,
    conversationId
  )) as Conversation | null

  if (!conversation || conversation.kind !== kind) {
    return { conversations: [] }
  }

  await requireConversationAccess(ctx, conversation as never, context.currentUserId)

  const teams =
    conversation.scopeType === "team"
      ? context.teams.filter((team) => team.id === conversation.scopeId)
      : context.teams.filter((team) => team.workspaceId === conversation.scopeId)

  if (kind === "chat") {
    const [messages, calls, chatReadStates] = await Promise.all([
      listChatMessagesByConversation(ctx, conversation.id),
      listCallsByConversation(ctx, conversation.id),
      listChatReadStatesByUser(ctx, context.currentUserId),
    ])

    return {
      calls: calls as Call[],
      chatMessages: (messages as ChatMessage[]).filter(
        (message) =>
          !message.deletedAt || message.createdBy === context.currentUserId
      ),
      chatReadStates: chatReadStates as AppSnapshot["chatReadStates"],
      conversations: [conversation],
      teams,
    }
  }

  const posts = (await listChannelPostsByConversation(
    ctx,
    conversation.id
  )) as ChannelPost[]
  const comments = await listChannelPostCommentsByPosts(
    ctx,
    posts.map((post) => post.id)
  )

  return {
    channelPostComments: comments as ChannelPostComment[],
    channelPosts: posts,
    conversations: [conversation],
    teams,
  }
}

async function loadConversationListCollections(
  ctx: QueryCtx,
  context: ScopedUserContext
): Promise<ScopedCollections> {
  const conversations = (
    await Promise.all([
      ...context.teams.map((team) =>
        listConversationsByScope(ctx, "team", team.id)
      ),
      ...context.workspaces.map((workspace) =>
        listConversationsByScope(ctx, "workspace", workspace.id)
      ),
    ])
  )
    .flat()
    .filter(
      (conversation) =>
        conversation.kind === "channel" ||
        conversation.scopeType === "team" ||
        conversation.participantIds.includes(context.currentUserId)
    ) as Conversation[]
  const chatConversationIds = conversations
    .filter((conversation) => conversation.kind === "chat")
    .map((conversation) => conversation.id)
  const [chatMessages, chatReadStates] = await Promise.all([
    listLatestReadableChatMessagesByConversations(ctx, chatConversationIds),
    listChatReadStatesByUser(ctx, context.currentUserId),
  ])

  return {
    chatMessages: chatMessages as ChatMessage[],
    chatReadStates: chatReadStates as AppSnapshot["chatReadStates"],
    conversations,
  }
}

async function loadNotificationInboxCollections(
  ctx: QueryCtx,
  context: ScopedUserContext
): Promise<ScopedCollections> {
  const notifications = (await listNotificationsByUser(
    ctx,
    context.currentUserId
  )) as Notification[]
  const inviteIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "invite")
      .map((notification) => notification.entityId)
  )
  const conversationIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "chat")
      .map((notification) => notification.entityId)
  )
  const postIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "channelPost")
      .map((notification) => notification.entityId)
  )
  const projectIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "project")
      .map((notification) => notification.entityId)
  )
  const [
    allInviteCandidates,
    conversationCandidates,
    channelPostCandidates,
    projectCandidates,
  ] = await Promise.all([
    Promise.all([
      listInvitesByNormalizedEmail(
        ctx,
        normalizeEmailAddress(context.currentUserEmail)
      ),
      listInvitesByTeams(ctx, context.accessibleTeamIds),
    ]).then((entries) => entries.flat()),
    Promise.all([...conversationIds].map((id) => getConversationDoc(ctx, id))),
    Promise.all([...postIds].map((id) => getChannelPostDoc(ctx, id))),
    getProjectsByIds(ctx, projectIds),
  ])
  const invites = (allInviteCandidates as Invite[]).filter((invite) =>
    inviteIds.has(invite.id)
  )
  const directConversations = (conversationCandidates.filter(
    isPresent
  ) as unknown as Conversation[]).filter((conversation) =>
    isReadableScopedConversation(conversation, context)
  )
  const channelPosts = channelPostCandidates.filter(
    isPresent
  ) as unknown as ChannelPost[]
  const channelPostConversations = (
    await Promise.all(
      [
        ...new Set(
          channelPosts.map((post) => post.conversationId).filter(Boolean)
        ),
      ].map((id) => getConversationDoc(ctx, id))
    )
  )
    .filter(isPresent)
    .filter(
      (conversation) =>
        conversation.kind === "channel" &&
        isReadableScopedConversation(conversation as Conversation, context)
    ) as unknown as Conversation[]
  const readableChannelPostConversationIds = new Set(
    channelPostConversations.map((conversation) => conversation.id)
  )
  const projects = (projectCandidates as Project[]).filter((project) =>
    isReadableScopedProject(project, context)
  )

  return {
    channelPosts: channelPosts.filter((post) =>
      readableChannelPostConversationIds.has(post.conversationId)
    ),
    conversations: dedupeById([
      ...directConversations,
      ...channelPostConversations,
    ]),
    invites,
    notifications,
    projects,
  }
}

async function loadWorkspacePeopleCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  workspaceId: string
): Promise<ScopedCollections> {
  if (!context.accessibleWorkspaceIds.has(workspaceId)) {
    return { workspaces: [] }
  }

  const teams = context.teams.filter((team) => team.workspaceId === workspaceId)
  const workItems = await loadWorkItemsForScope(
    ctx,
    context,
    "workspace",
    workspaceId
  )
  const documents = (
    (await listWorkspaceDocuments(ctx, workspaceId)) as Document[]
  ).filter((document) => isReadableScopedDocument(document, context))
  const projects = await loadProjectsByScopes(ctx, [
    { scopeType: "workspace", scopeId: workspaceId },
    ...teams.map((team) => ({ scopeType: "team" as const, scopeId: team.id })),
  ])
  const [comments, projectUpdates, conversations] = await Promise.all([
    Promise.all([
      listCommentsByTargets(ctx, {
        targetType: "workItem",
        targetIds: workItems.map((item) => item.id),
      }),
      listCommentsByTargets(ctx, {
        targetType: "document",
        targetIds: documents.map((document) => document.id),
      }),
    ]).then((entries) => entries.flat()),
    listProjectUpdatesByProjects(ctx, projects.map((project) => project.id)),
    Promise.all([
      listConversationsByScope(ctx, "workspace", workspaceId),
      ...teams.map((team) => listConversationsByScope(ctx, "team", team.id)),
    ]).then((entries) =>
      entries.flat().filter((conversation) => conversation.kind === "channel")
    ),
  ])
  const channelPosts = (
    await Promise.all(
      conversations.map((conversation) =>
        listChannelPostsByConversation(ctx, conversation.id)
      )
    )
  ).flat() as ChannelPost[]
  const channelPostComments = await listChannelPostCommentsByPosts(
    ctx,
    channelPosts.map((post) => post.id)
  )

  return {
    channelPostComments: channelPostComments as ChannelPostComment[],
    channelPosts,
    comments: comments as Comment[],
    conversations: conversations as Conversation[],
    documents,
    projectUpdates: projectUpdates as ProjectUpdate[],
    projects,
    teams,
    workItems,
  }
}

async function loadSearchSeedCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  workspaceId: string
): Promise<ScopedCollections> {
  if (!context.accessibleWorkspaceIds.has(workspaceId)) {
    return { workspaces: [] }
  }

  const teams = context.teams.filter((team) => team.workspaceId === workspaceId)
  const [workItems, documents, projects] = await Promise.all([
    loadWorkItemsForScope(ctx, context, "workspace", workspaceId),
    loadDocumentsForScope(ctx, context, "workspace", workspaceId),
    loadProjectsByScopes(ctx, [
      { scopeType: "workspace", scopeId: workspaceId },
      ...teams.map((team) => ({ scopeType: "team" as const, scopeId: team.id })),
    ]),
  ])

  return {
    documents,
    projects,
    teams,
    workItems,
    workspaces: context.workspaces.filter((workspace) => workspace.id === workspaceId),
  }
}

async function loadScopedCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  instruction: ScopedReadModelInstruction
): Promise<ScopedCollections> {
  switch (instruction.kind) {
    case "document-detail":
      return loadDocumentDetailCollections(ctx, context, instruction.documentId)
    case "document-index":
    case "project-index":
    case "work-index":
    case "view-catalog":
      return loadCollectionReadModelCollections(ctx, context, instruction)
    case "work-item-detail":
      return loadWorkItemDetailCollections(ctx, context, instruction.itemId)
    case "project-detail":
      return loadProjectDetailCollections(ctx, context, instruction.projectId)
    case "workspace-people":
      return loadWorkspacePeopleCollections(ctx, context, instruction.workspaceId)
    case "notification-inbox":
      return loadNotificationInboxCollections(ctx, context)
    case "conversation-list":
      return loadConversationListCollections(ctx, context)
    case "conversation-thread":
      return loadConversationCollections(
        ctx,
        context,
        instruction.conversationId,
        "chat"
      )
    case "channel-feed":
      return loadConversationCollections(
        ctx,
        context,
        instruction.conversationId,
        "channel"
      )
    case "search-seed":
      return loadSearchSeedCollections(ctx, context, instruction.workspaceId)
  }
}

function collectCustomPropertyValueUserIds(
  definitions: CustomPropertyDefinition[],
  values: CustomPropertyValueRecord[]
) {
  const personPropertyIds = new Set(
    definitions
      .filter((definition) => definition.type === "person")
      .map((definition) => definition.id)
  )
  return values
    .filter(
      (value) =>
        personPropertyIds.has(value.propertyId) &&
        typeof value.value === "string"
    )
    .map((value) => value.value as string)
}

function collectUserIds(input: ScopedCollections) {
  return compactStringIds([
    ...(input.users ?? []).map((user) => user.id),
    ...(input.workspaces ?? []).map((workspace) => workspace.createdBy),
    ...(input.workspaceMemberships ?? []).map((membership) => membership.userId),
    ...(input.teamMemberships ?? []).map((membership) => membership.userId),
    ...(input.projects ?? []).flatMap((project) => [
      project.leadId,
      ...project.memberIds,
    ]),
    ...(input.workItems ?? []).flatMap((item) => [
      item.creatorId,
      item.assigneeId,
      ...(item.assigneeIds ?? []),
      ...item.subscriberIds,
    ]),
    ...(input.workItemActivities ?? []).map((activity) => activity.actorId),
    ...(input.documents ?? []).flatMap((document) => [
      document.createdBy,
      document.updatedBy,
    ]),
    ...(input.views ?? []).flatMap((view) => [
      ...(view.scopeType === "personal" ? [view.scopeId] : []),
      ...view.filters.assigneeIds,
      ...view.filters.creatorIds,
      ...(view.filters.updatedByIds ?? []),
      ...view.filters.leadIds,
    ]),
    ...(input.comments ?? []).flatMap((comment) => [
      comment.createdBy,
      ...(comment.mentionUserIds ?? []),
      ...(comment.reactions ?? []).flatMap((reaction) => reaction.userIds),
    ]),
    ...(input.attachments ?? []).map((attachment) => attachment.uploadedBy),
    ...(input.notifications ?? []).flatMap((notification) => [
      notification.userId,
      notification.actorId,
    ]),
    ...(input.invites ?? []).map((invite) => invite.invitedBy),
    ...(input.projectUpdates ?? []).map((update) => update.createdBy),
    ...(input.conversations ?? []).flatMap((conversation) => [
      conversation.createdBy,
      ...conversation.participantIds,
    ]),
    ...(input.calls ?? []).flatMap((call) => [
      call.startedBy,
      call.lastJoinedBy,
      ...(call.participantUserIds ?? []),
    ]),
    ...(input.chatMessages ?? []).flatMap((message) => [
      message.createdBy,
      ...(message.mentionUserIds ?? []),
      ...(message.reactions ?? []).flatMap((reaction) => reaction.userIds),
    ]),
    ...(input.channelPosts ?? []).flatMap((post) => [
      post.createdBy,
      ...(post.mentionUserIds ?? []),
      ...(post.reactions ?? []).flatMap((reaction) => reaction.userIds),
    ]),
    ...(input.channelPostComments ?? []).flatMap((comment) => [
      comment.createdBy,
      ...(comment.mentionUserIds ?? []),
      ...(comment.reactions ?? []).flatMap((reaction) => reaction.userIds),
    ]),
    ...collectCustomPropertyValueUserIds(
      input.customPropertyDefinitions ?? [],
      input.customPropertyValues ?? []
    ),
  ])
}

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    roomId: conversation.roomId ?? null,
    roomName: conversation.roomName ?? null,
  }
}

function normalizeCall(call: Call): Call {
  return {
    ...call,
    roomId: call.roomId ?? null,
    roomName: call.roomName ?? null,
    endedAt: call.endedAt ?? null,
    lastJoinedAt: call.lastJoinedAt ?? null,
    lastJoinedBy: call.lastJoinedBy ?? null,
    joinCount: call.joinCount ?? 0,
    participantUserIds: call.participantUserIds ?? [],
  }
}

async function resolveAttachmentSnapshots(
  ctx: QueryCtx,
  attachments: Attachment[]
) {
  return Promise.all(
    attachments.map(async (attachment) => {
      const rawAttachment = attachment as Attachment & { storageId?: unknown }

      return {
        ...attachment,
        fileUrl: rawAttachment.storageId
          ? await ctx.storage.getUrl(rawAttachment.storageId as never)
          : attachment.fileUrl,
      }
    })
  )
}

async function materializeScopedSnapshot(
  ctx: QueryCtx,
  context: ScopedUserContext,
  collections: ScopedCollections
): Promise<AppSnapshot> {
  const teams = dedupeById([...(collections.teams ?? []), ...context.teams])
  const teamIds = new Set(teams.map((team) => team.id))
  const workspaceIds = new Set([
    ...context.workspaces.map((workspace) => workspace.id),
    ...teams.map((team) => team.workspaceId),
    ...(collections.workspaces ?? []).map((workspace) => workspace.id),
    ...(collections.documents ?? []).map((document) => document.workspaceId),
  ])
  const [teamMemberships, workspaceMemberships, labels] = await Promise.all([
    listTeamMembershipsByTeams(ctx, teamIds),
    listWorkspaceMembershipsByWorkspaces(ctx, workspaceIds),
    listLabelsByWorkspaces(ctx, workspaceIds),
  ])
  const workspaces = dedupeById([
    ...context.workspaces,
    ...(collections.workspaces ?? []),
    ...(await listWorkspacesByIds(ctx, workspaceIds)),
  ]) as Workspace[]
  const userCollections: ScopedCollections = {
    ...collections,
    labels: [...(collections.labels ?? []), ...(labels as Label[])],
    teamMemberships: dedupeMemberships([
      ...context.teamMemberships,
      ...(collections.teamMemberships ?? []),
      ...(teamMemberships as TeamMembership[]),
    ]),
    teams,
    workspaceMemberships: dedupeMemberships([
      ...context.workspaceMemberships,
      ...(collections.workspaceMemberships ?? []),
      ...(workspaceMemberships as WorkspaceMembership[]),
    ]),
    workspaces,
  }
  const users = await listUsersByIds(ctx, [
    context.currentUserId,
    ...collectUserIds(userCollections),
  ])
  const normalizedTeams = teams.map((team) =>
    normalizeTeam(team)
  ) as AppSnapshot["teams"]

  return {
    currentUserId: context.currentUserId,
    currentWorkspaceId: context.currentWorkspaceId,
    workspaces: await Promise.all(
      workspaces.map((workspace) => resolveWorkspaceSnapshot(ctx, workspace))
    ),
    workspaceMemberships: userCollections.workspaceMemberships ?? [],
    teams: normalizedTeams,
    teamMemberships: userCollections.teamMemberships ?? [],
    users: await Promise.all(users.map((user) => resolveUserSnapshot(ctx, user))),
    labels: userCollections.labels?.filter((label) =>
      isLabelVisibleToUser(label, context.currentUserId)
    ) ?? [],
    projects: dedupeById(collections.projects ?? []),
    milestones: collections.milestones ?? [],
    workItems: dedupeById(collections.workItems ?? []).map((item) =>
      normalizeWorkItem(item, normalizedTeams)
    ),
    workItemActivities: collections.workItemActivities ?? [],
    customPropertyDefinitions: collections.customPropertyDefinitions ?? [],
    customPropertyValues: collections.customPropertyValues ?? [],
    documents: dedupeById(collections.documents ?? []).map((document) =>
      normalizeDocument(document, normalizedTeams)
    ),
    views: dedupeById(collections.views ?? []).map((view) =>
      normalizeViewDefinition(view, normalizedTeams)
    ),
    comments: (collections.comments ?? []).map((comment) => ({
      ...comment,
      mentionUserIds: comment.mentionUserIds ?? [],
      reactions: comment.reactions ?? [],
    })),
    attachments: await resolveAttachmentSnapshots(
      ctx,
      collections.attachments ?? []
    ),
    notifications: (collections.notifications ?? []).map((notification) => ({
      ...notification,
      archivedAt: notification.archivedAt ?? null,
    })),
    invites: collections.invites ?? [],
    projectUpdates: collections.projectUpdates ?? [],
    conversations: (collections.conversations ?? []).map(normalizeConversation),
    calls: (collections.calls ?? []).map(normalizeCall),
    chatMessages: (collections.chatMessages ?? []).map((message) =>
      normalizeBootstrapChatMessage(message as never)
    ) as AppSnapshot["chatMessages"],
    chatReadStates: collections.chatReadStates ?? [],
    channelPosts: (collections.channelPosts ?? []).map((post) => ({
      ...post,
      mentionUserIds: post.mentionUserIds ?? [],
      reactions: post.reactions ?? [],
    })),
    channelPostComments: (collections.channelPostComments ?? []).map(
      (comment) => ({
        ...comment,
        mentionUserIds: comment.mentionUserIds ?? [],
        reactions: comment.reactions ?? [],
      })
    ),
  }
}

function toSelectorInstruction(
  instruction: ScopedReadModelInstruction,
  currentUserId: string
): ScopedReadModelReplaceInstruction {
  if (instruction.kind === "notification-inbox") {
    return { kind: "notification-inbox", userId: currentUserId }
  }

  if (instruction.kind === "conversation-list") {
    return { kind: "conversation-list", userId: currentUserId }
  }

  return instruction
}

export async function getScopedReadModelHandler(
  ctx: QueryCtx,
  args: ScopedReadModelArgs
): Promise<ScopedReadModelPatch | null> {
  const { context, snapshot } = await loadSnapshotForInstruction(
    ctx,
    args,
    args.instruction
  )

  return selectReadModelForInstruction(
    snapshot,
    toSelectorInstruction(args.instruction, context.currentUserId)
  )
}

async function loadSnapshotForInstruction(
  ctx: QueryCtx,
  args:
    | ScopedReadModelArgs
    | ScopedReadModelScopeKeyArgs
    | AuthorizeScopedReadModelScopeKeysArgs,
  instruction: ScopedReadModelInstruction
) {
  const context = await loadScopedUserContext(ctx, {
    serverToken: args.serverToken,
    workosUserId: args.workosUserId,
    email: args.email,
    selectedWorkspaceId: args.selectedWorkspaceId,
    instruction,
  })
  const collections = await loadScopedCollections(ctx, context, instruction)
  const snapshot = await materializeScopedSnapshot(ctx, context, collections)

  return { context, snapshot }
}

async function getScopedSnapshotForScopeKeyTarget(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs
) {
  switch (args.target.kind) {
    case "document":
      return loadSnapshotForInstruction(ctx, args, {
        kind: "document-detail",
        documentId: args.target.documentId,
      })
    case "work-item":
      return loadSnapshotForInstruction(ctx, args, {
        kind: "work-item-detail",
        itemId: args.target.itemId,
      })
    case "custom-property-definition":
      return loadSnapshotForInstruction(ctx, args, {
        kind: "work-index",
        scopeType: "team",
        scopeId: args.target.teamId,
      })
    case "project":
      return loadSnapshotForInstruction(ctx, args, {
        kind: "project-detail",
        projectId: args.target.projectId,
      })
    case "conversation": {
      const context = await loadScopedUserContext(ctx, {
        serverToken: args.serverToken,
        workosUserId: args.workosUserId,
        email: args.email,
        selectedWorkspaceId: args.selectedWorkspaceId,
        instruction: { kind: "conversation-list" },
      })
      const conversation = await getConversationDoc(
        ctx,
        args.target.conversationId
      )
      if (!conversation) {
        const snapshot = await materializeScopedSnapshot(ctx, context, {})
        return { context, snapshot }
      }

      await requireConversationAccess(ctx, conversation, context.currentUserId)

      return loadSnapshotForInstruction(ctx, args, {
        kind:
          conversation.kind === "channel"
            ? "channel-feed"
            : "conversation-thread",
        conversationId: args.target.conversationId,
      })
    }
    case "channel-post": {
      const post = await getChannelPostDoc(ctx, args.target.postId)
      if (!post) {
        const context = await loadScopedUserContext(ctx, {
          serverToken: args.serverToken,
          workosUserId: args.workosUserId,
          email: args.email,
          selectedWorkspaceId: args.selectedWorkspaceId,
          instruction: { kind: "conversation-list" },
        })
        const snapshot = await materializeScopedSnapshot(ctx, context, {})
        return { context, snapshot }
      }

      return loadSnapshotForInstruction(ctx, args, {
        kind: "channel-feed",
        conversationId: post.conversationId,
      })
    }
    case "chat-message": {
      const message = await getChatMessageDoc(ctx, args.target.messageId)
      if (!message) {
        const context = await loadScopedUserContext(ctx, {
          serverToken: args.serverToken,
          workosUserId: args.workosUserId,
          email: args.email,
          selectedWorkspaceId: args.selectedWorkspaceId,
          instruction: { kind: "conversation-list" },
        })
        const snapshot = await materializeScopedSnapshot(ctx, context, {})
        return { context, snapshot }
      }

      return loadSnapshotForInstruction(ctx, args, {
        kind: "conversation-thread",
        conversationId: message.conversationId,
      })
    }
    case "view": {
      const context = await loadScopedUserContext(ctx, {
        serverToken: args.serverToken,
        workosUserId: args.workosUserId,
        email: args.email,
        selectedWorkspaceId: args.selectedWorkspaceId,
        instruction: { kind: "conversation-list" },
      })
      const view = (await getViewDoc(ctx, args.target.viewId)) as ViewDefinition | null

      if (!view || view.containerType) {
        const snapshot = await materializeScopedSnapshot(ctx, context, {
          views: view ? [view] : [],
        })
        return { context, snapshot }
      }

      if (view.scopeType === "team") {
        await requireReadableTeamAccess(ctx, view.scopeId, context.currentUserId)
      } else if (view.scopeType === "workspace") {
        await requireReadableWorkspaceAccess(
          ctx,
          view.scopeId,
          context.currentUserId
        )
      }

      const snapshot = await materializeScopedSnapshot(ctx, context, {
        views: [view],
      })
      return { context, snapshot }
    }
    case "user-workspace-membership": {
      const context = await loadScopedUserContext(ctx, {
        serverToken: args.serverToken,
        workosUserId: args.workosUserId,
        email: args.email,
        selectedWorkspaceId: args.selectedWorkspaceId,
        instruction: { kind: "conversation-list" },
      })
      const [workspaceMemberships, teamMemberships, ownedWorkspaces] =
        await Promise.all([
          listWorkspaceMembershipsByUser(ctx, args.target.userId),
          listTeamMembershipsByUser(ctx, args.target.userId),
          listWorkspacesOwnedByUser(ctx, args.target.userId),
        ])
      const teams = await listTeamsByIds(
        ctx,
        teamMemberships.map((membership) => membership.teamId)
      )
      const workspaces = await listWorkspacesByIds(ctx, [
        ...workspaceMemberships.map((membership) => membership.workspaceId),
        ...teams.map((team) => team.workspaceId),
        ...ownedWorkspaces.map((workspace) => workspace.id),
      ])
      const snapshot = await materializeScopedSnapshot(ctx, context, {
        teamMemberships: teamMemberships as TeamMembership[],
        teams: teams as Team[],
        workspaceMemberships: workspaceMemberships as WorkspaceMembership[],
        workspaces: workspaces as Workspace[],
      })
      return { context, snapshot }
    }
  }
}

export async function resolveScopedReadModelScopeKeysHandler(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs
) {
  const { snapshot } = await getScopedSnapshotForScopeKeyTarget(ctx, args)

  switch (args.target.kind) {
    case "document":
      return getDocumentRelatedScopeKeys(snapshot, args.target.documentId)
    case "work-item":
      return getWorkItemDetailScopeKeys(snapshot, args.target.itemId)
    case "custom-property-definition":
      return getCustomPropertyDefinitionScopeKeys(snapshot, args.target.teamId)
    case "project":
      return getProjectRelatedScopeKeys(snapshot, args.target.projectId)
    case "view":
      return getViewRelatedScopeKeys(snapshot, args.target.viewId)
    case "conversation":
      return getConversationRelatedScopeKeys(snapshot, args.target.conversationId)
    case "channel-post":
      return getChannelPostRelatedScopeKeys(snapshot, args.target.postId)
    case "chat-message":
      return getChatMessageRelatedScopeKeys(snapshot, args.target.messageId)
    case "user-workspace-membership":
      return getUserWorkspaceMembershipScopeKeys(snapshot, args.target.userId)
  }
}

function collectionInstructionFromScopeKey(
  descriptor: NonNullable<ReturnType<typeof parseReadModelScopeKey>>
): ScopedReadModelInstruction | null {
  const [rawScopeId] = descriptor.parts
  const [scopeType, ...scopeIdParts] = rawScopeId?.split("_") ?? []
  const scopeId = scopeIdParts.join("_")

  if (
    !scopeId ||
    (scopeType !== "personal" && scopeType !== "team" && scopeType !== "workspace")
  ) {
    return null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.workIndex) {
    return { kind: "work-index", scopeType, scopeId }
  }

  if (scopeType === "personal") {
    return null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.documentIndex) {
    return { kind: "document-index", scopeType, scopeId }
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.projectIndex) {
    return { kind: "project-index", scopeType, scopeId }
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.viewCatalog) {
    return { kind: "view-catalog", scopeType, scopeId }
  }

  return null
}

type CollectionScopeType = "personal" | "team" | "workspace"

function isCollectionScopeType(
  value: string | undefined
): value is CollectionScopeType {
  return value === "personal" || value === "team" || value === "workspace"
}

function parseCollectionScopeKeyDescriptor(
  descriptor: NonNullable<ReturnType<typeof parseReadModelScopeKey>>
) {
  const [rawScopeId] = descriptor.parts
  const [scopeType, ...scopeIdParts] = rawScopeId?.split("_") ?? []
  const scopeId = scopeIdParts.join("_")

  if (!rawScopeId || !scopeId || !isCollectionScopeType(scopeType)) {
    return null
  }

  return { rawScopeId, scopeType, scopeId }
}

function isCollectionReadModelScopeKind(
  kind: NonNullable<ReturnType<typeof parseReadModelScopeKey>>["kind"]
) {
  return (
    kind === READ_MODEL_SCOPE_KINDS.workIndex ||
    kind === READ_MODEL_SCOPE_KINDS.documentIndex ||
    kind === READ_MODEL_SCOPE_KINDS.projectIndex ||
    kind === READ_MODEL_SCOPE_KINDS.viewCatalog
  )
}

function contextAuthorizesCollectionScope(
  descriptor: NonNullable<ReturnType<typeof parseReadModelScopeKey>>,
  context: ScopedUserContext
) {
  const collectionScope = parseCollectionScopeKeyDescriptor(descriptor)

  if (!collectionScope) {
    return false
  }

  if (
    collectionScope.rawScopeId !==
    createScopedCollectionScopeId(
      collectionScope.scopeType,
      collectionScope.scopeId
    )
  ) {
    return false
  }

  if (collectionScope.scopeType === "personal") {
    return collectionScope.scopeId === context.currentUserId
  }

  if (collectionScope.scopeType === "team") {
    return context.accessibleTeamIds.has(collectionScope.scopeId)
  }

  return context.accessibleWorkspaceIds.has(collectionScope.scopeId)
}

function instructionFromScopeKey(
  descriptor: NonNullable<ReturnType<typeof parseReadModelScopeKey>>,
  currentUserId: string
): ScopedReadModelInstruction | null {
  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.notificationInbox) {
    return descriptor.parts[0] === currentUserId
      ? { kind: "notification-inbox" }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.conversationList) {
    return descriptor.parts[0] === currentUserId
      ? { kind: "conversation-list" }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.workspacePeople) {
    return descriptor.parts[0]
      ? { kind: "workspace-people", workspaceId: descriptor.parts[0] }
      : null
  }

  if (
    descriptor.kind === READ_MODEL_SCOPE_KINDS.searchSeed ||
    descriptor.kind === READ_MODEL_SCOPE_KINDS.privateSearchSeed ||
    descriptor.kind === READ_MODEL_SCOPE_KINDS.privateDocumentIndex
  ) {
    if (
      (descriptor.kind === READ_MODEL_SCOPE_KINDS.privateSearchSeed ||
        descriptor.kind === READ_MODEL_SCOPE_KINDS.privateDocumentIndex) &&
      descriptor.parts[1] !== currentUserId
    ) {
      return null
    }

    return descriptor.parts[0]
      ? { kind: "search-seed", workspaceId: descriptor.parts[0] }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.documentDetail) {
    return descriptor.parts[0]
      ? { kind: "document-detail", documentId: descriptor.parts[0] }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.workItemDetail) {
    return descriptor.parts[0]
      ? { kind: "work-item-detail", itemId: descriptor.parts[0] }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.projectDetail) {
    return descriptor.parts[0]
      ? { kind: "project-detail", projectId: descriptor.parts[0] }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.conversationThread) {
    return descriptor.parts[0]
      ? { kind: "conversation-thread", conversationId: descriptor.parts[0] }
      : null
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.channelFeed) {
    return descriptor.parts[0]
      ? { kind: "channel-feed", conversationId: descriptor.parts[0] }
      : null
  }

  return collectionInstructionFromScopeKey(descriptor)
}

function readModelDataAuthorizesScope(
  scopeKey: string,
  data: ScopedReadModelPatch | null
) {
  if (!data) {
    return false
  }

  const descriptor = parseReadModelScopeKey(scopeKey)

  if (!descriptor) {
    return false
  }

  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.workspacePeople) {
    return (data.workspaces ?? []).some(
      (workspace) => workspace.id === descriptor.parts[0]
    )
  }

  if (
    descriptor.kind === READ_MODEL_SCOPE_KINDS.searchSeed ||
    descriptor.kind === READ_MODEL_SCOPE_KINDS.privateSearchSeed ||
    descriptor.kind === READ_MODEL_SCOPE_KINDS.privateDocumentIndex
  ) {
    return (data.workspaces ?? []).some(
      (workspace) => workspace.id === descriptor.parts[0]
    )
  }

  if (isCollectionReadModelScopeKind(descriptor.kind)) {
    return false
  }

  return true
}

export async function authorizeScopedReadModelScopeKeysHandler(
  ctx: QueryCtx,
  args: AuthorizeScopedReadModelScopeKeysArgs
) {
  const context = await loadScopedUserContext(ctx, {
    serverToken: args.serverToken,
    workosUserId: args.workosUserId,
    email: args.email,
    selectedWorkspaceId: args.selectedWorkspaceId,
    instruction: { kind: "conversation-list" },
  })

  for (const scopeKey of args.scopeKeys) {
    const descriptor = parseReadModelScopeKey(scopeKey)

    if (!descriptor) {
      throw new Error(`Invalid scoped read model key: ${scopeKey}`)
    }

    if (descriptor.kind === READ_MODEL_SCOPE_KINDS.shellContext) {
      continue
    }

    if (descriptor.kind === READ_MODEL_SCOPE_KINDS.workspaceMembership) {
      if (
        descriptor.parts.length !== 1 ||
        !context.accessibleWorkspaceIds.has(descriptor.parts[0])
      ) {
        throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
      }
      continue
    }

    const instruction = instructionFromScopeKey(
      descriptor,
      context.currentUserId
    )

    if (!instruction) {
      throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
    }

    if (isCollectionReadModelScopeKind(descriptor.kind)) {
      if (!contextAuthorizesCollectionScope(descriptor, context)) {
        throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
      }
      continue
    }

    const data = await getScopedReadModelHandler(ctx, {
      serverToken: args.serverToken,
      workosUserId: args.workosUserId,
      email: args.email,
      selectedWorkspaceId: args.selectedWorkspaceId,
      instruction,
    })

    if (!readModelDataAuthorizesScope(scopeKey, data)) {
      throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
    }
  }
}
