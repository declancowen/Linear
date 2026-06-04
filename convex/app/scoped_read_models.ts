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
import { collectNotificationInboxEntityIds } from "../../lib/scoped-sync/notification-inbox"
import type {
  ScopedReadModelInstruction,
  ScopedReadModelScopeKeyTarget,
} from "../../lib/scoped-sync/read-model-instructions"
import {
  createScopedCollectionScopeId,
  parseReadModelScopeKey,
  READ_MODEL_SCOPE_KINDS,
  type ReadModelScopeKind,
} from "../../lib/scoped-sync/scope-keys"
import { supportsChatMessageReadReceipts } from "../../lib/domain/chat-read-state"
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
  listChatReadStatesByConversation,
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
  listUsersByIds,
  listViewsByScope,
  listViewsByScopeEntity,
  listWorkItemActivitiesByWorkItems,
  listWorkItemsByTeam,
  loadUserWorkspaceAccessSummary,
  listWorkspaceDocuments,
  listWorkspaceMembershipsByWorkspaces,
  listWorkspacesByIds,
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

type ScopedReadModelArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  instruction: ScopedReadModelInstruction
}

type ScopedReadModelScopeKeyArgs = {
  serverToken: string
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  target: ScopedReadModelScopeKeyTarget
}

type ScopedReadModelScopeKeySnapshot = {
  context: ScopedUserContext
  snapshot: AppSnapshot
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
  const [userAppState, accessSummary] = await Promise.all([
    getUserAppState(ctx, currentUserId),
    loadUserWorkspaceAccessSummary(ctx, currentUserId),
  ])
  const {
    accessibleTeamIds,
    accessibleWorkspaceIds,
    ownedWorkspaces,
    teamMemberships,
    teams,
    workspaceMemberships,
  } = accessSummary
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

function isReadableScopedWorkItem(item: WorkItem, context: ScopedUserContext) {
  if ((item.visibility ?? "team") === "private") {
    return Boolean(
      item.creatorId === context.currentUserId &&
        item.workspaceId &&
        context.accessibleWorkspaceIds.has(item.workspaceId)
    )
  }

  return Boolean(item.teamId && context.accessibleTeamIds.has(item.teamId))
}

function isDocumentInCollectionScope(
  document: Document,
  context: ScopedUserContext,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (!isReadableScopedDocument(document, context)) {
    return false
  }

  if (scopeType === "team") {
    return document.kind === "team-document" && document.teamId === scopeId
  }

  if (document.kind === "workspace-document") {
    return document.workspaceId === scopeId
  }

  return (
    document.kind === "private-document" &&
    document.workspaceId === scopeId &&
    document.createdBy === context.currentUserId
  )
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
    return ((await listWorkItemsByTeam(ctx, scopeId)) as WorkItem[]).filter(
      (item) => isReadableScopedWorkItem(item, context)
    )
  }

  const teams = filterAccessibleTeams(context, scopeType, scopeId)
  const teamItems = (
    await Promise.all(teams.map((team) => listWorkItemsByTeam(ctx, team.id)))
  ).flat() as WorkItem[]
  const readableTeamItems = teamItems.filter((item) =>
    isReadableScopedWorkItem(item, context)
  )

  if (scopeType === "personal") {
    const privateItems = (await listPrivateWorkItemsByCreator(
      ctx,
      context.currentUserId
    )) as WorkItem[]

    return dedupeById([
      ...readableTeamItems,
      ...privateItems.filter((item) => isReadableScopedWorkItem(item, context)),
    ])
  }

  return readableTeamItems
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
    return ((await listTeamDocuments(ctx, scopeId)) as Document[]).filter(
      (document) =>
        isDocumentInCollectionScope(document, context, scopeType, scopeId)
    )
  }

  return ((await listWorkspaceDocuments(ctx, scopeId)) as Document[]).filter(
    (document) =>
      isDocumentInCollectionScope(document, context, scopeType, scopeId)
  )
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
    const linkedProjects = await getProjectsByIds(
      ctx,
      documents.flatMap((document) => document.linkedProjectIds)
    )
    const projects = linkedProjects.filter((project) =>
      isReadableScopedProject(project, context)
    )
    const linkedWorkItems = await getWorkItemsByIds(
      ctx,
      documents.flatMap((document) => document.linkedWorkItemIds)
    )
    const workItems = linkedWorkItems.filter((item) =>
      isReadableScopedWorkItem(item, context)
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
        isReadableScopedWorkItem(item, context) &&
        ((item.primaryProjectId && projectIds.has(item.primaryProjectId)) ||
          item.linkedProjectIds.some((projectId) => projectIds.has(projectId)))
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
            (candidate.workspaceId ?? itemWorkspaceId) === itemWorkspaceId &&
            isReadableScopedWorkItem(candidate, context)
        )
      : item.teamId
        ? ((await listWorkItemsByTeam(ctx, item.teamId)) as WorkItem[]).filter(
            (candidate) => isReadableScopedWorkItem(candidate, context)
          )
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
  ]).filter((project) => isReadableScopedProject(project, context))
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
  const projectCandidateItems = (
    await Promise.all(teams.map((team) => listWorkItemsByTeam(ctx, team.id)))
  ).flat() as WorkItem[]
  const workItems = projectCandidateItems.filter(
    (item) =>
      isReadableScopedWorkItem(item, context) &&
      (item.primaryProjectId === project.id ||
        item.linkedProjectIds.includes(project.id) ||
        (item.referencedProjectIds ?? []).includes(project.id))
  )
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
      listChatReadStatesByConversation(ctx, conversation.id),
    ])
    const participantReadStates = (
      chatReadStates as AppSnapshot["chatReadStates"]
    ).filter((readState) => conversation.participantIds.includes(readState.userId))
    const visibleReadStates = supportsChatMessageReadReceipts(conversation)
      ? participantReadStates
      : participantReadStates
          .filter((readState) => readState.userId === context.currentUserId)
          .map((readState) => {
            const readStateWithoutReceipts = { ...readState }

            delete readStateWithoutReceipts.messageReadAtById

            return readStateWithoutReceipts
          })

    return {
      calls: calls as Call[],
      chatMessages: (messages as ChatMessage[]).filter(
        (message) =>
          !message.deletedAt || message.createdBy === context.currentUserId
      ),
      chatReadStates: visibleReadStates,
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
  const { conversationIds, inviteIds, postIds, projectIds } =
    collectNotificationInboxEntityIds(notifications)
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

function getWorkspaceScopedTeams(context: ScopedUserContext, workspaceId: string) {
  return context.teams.filter((team) => team.workspaceId === workspaceId)
}

function getWorkspaceAndTeamProjectScopes(
  workspaceId: string,
  teams: Team[]
) {
  return [
    { scopeType: "workspace" as const, scopeId: workspaceId },
    ...teams.map((team) => ({ scopeType: "team" as const, scopeId: team.id })),
  ]
}

async function loadWorkspacePeopleCollections(
  ctx: QueryCtx,
  context: ScopedUserContext,
  workspaceId: string
): Promise<ScopedCollections> {
  if (!context.accessibleWorkspaceIds.has(workspaceId)) {
    return { workspaces: [] }
  }

  const teams = getWorkspaceScopedTeams(context, workspaceId)
  const workItems = await loadWorkItemsForScope(
    ctx,
    context,
    "workspace",
    workspaceId
  )
  const documents = (
    (await listWorkspaceDocuments(ctx, workspaceId)) as Document[]
  ).filter((document) => isReadableScopedDocument(document, context))
  const projects = await loadProjectsByScopes(
    ctx,
    getWorkspaceAndTeamProjectScopes(workspaceId, teams)
  )
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

  const teams = getWorkspaceScopedTeams(context, workspaceId)
  const [workItems, documents, projects] = await Promise.all([
    loadWorkItemsForScope(ctx, context, "workspace", workspaceId),
    loadDocumentsForScope(ctx, context, "workspace", workspaceId),
    loadProjectsByScopes(ctx, getWorkspaceAndTeamProjectScopes(workspaceId, teams)),
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

function collectBasicUserIds(input: ScopedCollections) {
  return [
    ...(input.users ?? []).map((user) => user.id),
    ...(input.workspaces ?? []).map((workspace) => workspace.createdBy),
    ...(input.attachments ?? []).map((attachment) => attachment.uploadedBy),
    ...(input.invites ?? []).map((invite) => invite.invitedBy),
    ...(input.projectUpdates ?? []).map((update) => update.createdBy),
  ]
}

function collectMembershipUserIds(input: ScopedCollections) {
  return [
    ...(input.workspaceMemberships ?? []).map((membership) => membership.userId),
    ...(input.teamMemberships ?? []).map((membership) => membership.userId),
  ]
}

function collectWorkEntityUserIds(input: ScopedCollections) {
  return [
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
    ...collectCustomPropertyValueUserIds(
      input.customPropertyDefinitions ?? [],
      input.customPropertyValues ?? []
    ),
  ]
}

function collectViewAndNotificationUserIds(input: ScopedCollections) {
  return [
    ...(input.views ?? []).flatMap((view) => [
      ...(view.scopeType === "personal" ? [view.scopeId] : []),
      ...view.filters.assigneeIds,
      ...view.filters.creatorIds,
      ...(view.filters.updatedByIds ?? []),
      ...view.filters.leadIds,
    ]),
    ...(input.notifications ?? []).flatMap((notification) => [
      notification.userId,
      notification.actorId,
    ]),
  ]
}

function collectThreadContentUserIds(input: ScopedCollections) {
  return [
    ...(input.comments ?? []).flatMap((comment) => [
      comment.createdBy,
      ...(comment.mentionUserIds ?? []),
      ...(comment.reactions ?? []).flatMap((reaction) => reaction.userIds),
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
  ]
}

function collectConversationUserIds(input: ScopedCollections) {
  return [
    ...(input.conversations ?? []).flatMap((conversation) => [
      conversation.createdBy,
      ...conversation.participantIds,
    ]),
    ...(input.calls ?? []).flatMap((call) => [
      call.startedBy,
      call.lastJoinedBy,
      ...(call.participantUserIds ?? []),
    ]),
  ]
}

function collectUserIds(input: ScopedCollections) {
  return compactStringIds([
    ...collectBasicUserIds(input),
    ...collectMembershipUserIds(input),
    ...collectWorkEntityUserIds(input),
    ...collectViewAndNotificationUserIds(input),
    ...collectThreadContentUserIds(input),
    ...collectConversationUserIds(input),
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

type ScopedSnapshotMaterialization = {
  normalizedTeams: AppSnapshot["teams"]
  teams: Team[]
  userCollections: ScopedCollections
  workspaces: Workspace[]
}

async function loadScopedSnapshotMaterialization(
  ctx: QueryCtx,
  context: ScopedUserContext,
  collections: ScopedCollections
): Promise<ScopedSnapshotMaterialization> {
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

  return {
    normalizedTeams: teams.map((team) =>
      normalizeTeam(team)
    ) as AppSnapshot["teams"],
    teams,
    userCollections,
    workspaces,
  }
}

function normalizeScopedComments(comments: ScopedCollections["comments"]) {
  return (comments ?? []).map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
    reactions: comment.reactions ?? [],
  }))
}

function normalizeScopedNotifications(
  notifications: ScopedCollections["notifications"]
) {
  return (notifications ?? []).map((notification) => ({
    ...notification,
    archivedAt: notification.archivedAt ?? null,
  }))
}

function normalizeScopedChannelContent<T extends {
  mentionUserIds?: string[]
  reactions?: unknown[]
}>(entries: T[] | undefined) {
  return (entries ?? []).map((entry) => ({
    ...entry,
    mentionUserIds: entry.mentionUserIds ?? [],
    reactions: entry.reactions ?? [],
  }))
}

async function resolveScopedWorkspaceSnapshots(
  ctx: QueryCtx,
  workspaces: Workspace[]
): Promise<AppSnapshot["workspaces"]> {
  return Promise.all(
    workspaces.map((workspace) => resolveWorkspaceSnapshot(ctx, workspace))
  )
}

async function resolveScopedUserSnapshots(
  ctx: QueryCtx,
  context: ScopedUserContext,
  userCollections: ScopedCollections
): Promise<AppSnapshot["users"]> {
  const users = await listUsersByIds(ctx, [
    context.currentUserId,
    ...collectUserIds(userCollections),
  ])

  return Promise.all(users.map((user) => resolveUserSnapshot(ctx, user)))
}

function getVisibleScopedLabels(
  labels: ScopedCollections["labels"],
  currentUserId: string
): AppSnapshot["labels"] {
  return (
    labels?.filter((label) => isLabelVisibleToUser(label, currentUserId)) ?? []
  )
}

function materializeScopedMembershipData(
  context: ScopedUserContext,
  userCollections: ScopedCollections,
  normalizedTeams: AppSnapshot["teams"]
): Pick<
  AppSnapshot,
  "workspaceMemberships" | "teams" | "teamMemberships" | "labels"
> {
  return {
    workspaceMemberships: userCollections.workspaceMemberships ?? [],
    teams: normalizedTeams,
    teamMemberships: userCollections.teamMemberships ?? [],
    labels: getVisibleScopedLabels(
      userCollections.labels,
      context.currentUserId
    ),
  }
}

function materializeScopedWorkData(
  collections: ScopedCollections,
  normalizedTeams: AppSnapshot["teams"]
): Pick<
  AppSnapshot,
  | "projects"
  | "milestones"
  | "workItems"
  | "workItemActivities"
  | "customPropertyDefinitions"
  | "customPropertyValues"
  | "documents"
  | "views"
> {
  return {
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
  }
}

async function materializeScopedCollaborationData(
  ctx: QueryCtx,
  collections: ScopedCollections
): Promise<
  Pick<
    AppSnapshot,
    | "comments"
    | "attachments"
    | "notifications"
    | "invites"
    | "projectUpdates"
    | "conversations"
    | "calls"
    | "chatMessages"
    | "chatReadStates"
    | "channelPosts"
    | "channelPostComments"
  >
> {
  return {
    comments: normalizeScopedComments(collections.comments),
    attachments: await resolveAttachmentSnapshots(
      ctx,
      collections.attachments ?? []
    ),
    notifications: normalizeScopedNotifications(collections.notifications),
    invites: collections.invites ?? [],
    projectUpdates: collections.projectUpdates ?? [],
    conversations: (collections.conversations ?? []).map(normalizeConversation),
    calls: (collections.calls ?? []).map(normalizeCall),
    chatMessages: (collections.chatMessages ?? []).map((message) =>
      normalizeBootstrapChatMessage(message as never)
    ) as AppSnapshot["chatMessages"],
    chatReadStates: collections.chatReadStates ?? [],
    channelPosts: normalizeScopedChannelContent(collections.channelPosts),
    channelPostComments: normalizeScopedChannelContent(
      collections.channelPostComments
    ),
  }
}

async function materializeScopedSnapshot(
  ctx: QueryCtx,
  context: ScopedUserContext,
  collections: ScopedCollections
): Promise<AppSnapshot> {
  const { normalizedTeams, userCollections, workspaces } =
    await loadScopedSnapshotMaterialization(ctx, context, collections)
  const [workspaceSnapshots, userSnapshots, collaborationData] =
    await Promise.all([
      resolveScopedWorkspaceSnapshots(ctx, workspaces),
      resolveScopedUserSnapshots(ctx, context, userCollections),
      materializeScopedCollaborationData(ctx, collections),
    ])

  return {
    currentUserId: context.currentUserId,
    currentWorkspaceId: context.currentWorkspaceId,
    workspaces: workspaceSnapshots,
    users: userSnapshots,
    ...materializeScopedMembershipData(
      context,
      userCollections,
      normalizedTeams
    ),
    ...materializeScopedWorkData(collections, normalizedTeams),
    ...collaborationData,
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

async function loadConversationListContext(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs
) {
  return loadScopedUserContext(ctx, {
    serverToken: args.serverToken,
    workosUserId: args.workosUserId,
    email: args.email,
    selectedWorkspaceId: args.selectedWorkspaceId,
    instruction: { kind: "conversation-list" },
  })
}

async function loadEmptyScopeKeySnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  collections: ScopedCollections = {}
) {
  const context = await loadConversationListContext(ctx, args)
  const snapshot = await materializeScopedSnapshot(ctx, context, collections)

  return { context, snapshot }
}

function instructionForConversationTarget(
  conversation: Conversation,
  conversationId: string
): ScopedReadModelInstruction {
  return {
    kind:
      conversation.kind === "channel" ? "channel-feed" : "conversation-thread",
    conversationId,
  }
}

function instructionForSimpleScopeKeyTarget(
  target: ScopedReadModelScopeKeyArgs["target"]
): ScopedReadModelInstruction | null {
  switch (target.kind) {
    case "document":
      return { kind: "document-detail", documentId: target.documentId }
    case "work-item":
      return { kind: "work-item-detail", itemId: target.itemId }
    case "custom-property-definition":
      return {
        kind: "work-index",
        scopeType: "team",
        scopeId: target.teamId,
      }
    case "project":
      return { kind: "project-detail", projectId: target.projectId }
    default:
      return null
  }
}

async function loadConversationTargetSnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  target: Extract<ScopedReadModelScopeKeyTarget, { kind: "conversation" }>
): Promise<ScopedReadModelScopeKeySnapshot> {
  const conversation = await getConversationDoc(ctx, target.conversationId)

  if (!conversation) {
    return loadEmptyScopeKeySnapshot(ctx, args)
  }

  const context = await loadConversationListContext(ctx, args)
  await requireConversationAccess(ctx, conversation, context.currentUserId)

  return loadSnapshotForInstruction(
    ctx,
    args,
    instructionForConversationTarget(conversation, target.conversationId)
  )
}

async function loadChannelPostTargetSnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  target: Extract<ScopedReadModelScopeKeyTarget, { kind: "channel-post" }>
): Promise<ScopedReadModelScopeKeySnapshot> {
  const post = await getChannelPostDoc(ctx, target.postId)

  return post
    ? loadSnapshotForInstruction(ctx, args, {
        kind: "channel-feed",
        conversationId: post.conversationId,
      })
    : loadEmptyScopeKeySnapshot(ctx, args)
}

async function loadChatMessageTargetSnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  target: Extract<ScopedReadModelScopeKeyTarget, { kind: "chat-message" }>
): Promise<ScopedReadModelScopeKeySnapshot> {
  const message = await getChatMessageDoc(ctx, target.messageId)

  return message
    ? loadSnapshotForInstruction(ctx, args, {
        kind: "conversation-thread",
        conversationId: message.conversationId,
      })
    : loadEmptyScopeKeySnapshot(ctx, args)
}

async function loadViewTargetSnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  target: Extract<ScopedReadModelScopeKeyTarget, { kind: "view" }>
): Promise<ScopedReadModelScopeKeySnapshot> {
  const context = await loadConversationListContext(ctx, args)
  const view = (await getViewDoc(ctx, target.viewId)) as ViewDefinition | null

  if (!view || view.containerType) {
    const snapshot = await materializeScopedSnapshot(ctx, context, {
      views: view ? [view] : [],
    })
    return { context, snapshot }
  }

  if (view.scopeType === "team") {
    await requireReadableTeamAccess(ctx, view.scopeId, context.currentUserId)
  } else if (view.scopeType === "workspace") {
    await requireReadableWorkspaceAccess(ctx, view.scopeId, context.currentUserId)
  }

  const snapshot = await materializeScopedSnapshot(ctx, context, {
    views: [view],
  })
  return { context, snapshot }
}

async function loadUserWorkspaceMembershipTargetSnapshot(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs,
  target: Extract<
    ScopedReadModelScopeKeyTarget,
    { kind: "user-workspace-membership" }
  >
): Promise<ScopedReadModelScopeKeySnapshot> {
  const context = await loadScopedUserContext(ctx, {
    serverToken: args.serverToken,
    workosUserId: args.workosUserId,
    email: args.email,
      selectedWorkspaceId: args.selectedWorkspaceId,
      instruction: { kind: "conversation-list" },
    })
  const {
    accessibleWorkspaceIds,
    teamMemberships,
    teams,
    workspaceMemberships,
  } = await loadUserWorkspaceAccessSummary(ctx, target.userId)
  const workspaces = await listWorkspacesByIds(ctx, accessibleWorkspaceIds)
  const snapshot = await materializeScopedSnapshot(ctx, context, {
    teamMemberships: teamMemberships as TeamMembership[],
    teams: teams as Team[],
    workspaceMemberships: workspaceMemberships as WorkspaceMembership[],
    workspaces: workspaces as Workspace[],
  })

  return { context, snapshot }
}

async function getScopedSnapshotForScopeKeyTarget(
  ctx: QueryCtx,
  args: ScopedReadModelScopeKeyArgs
): Promise<ScopedReadModelScopeKeySnapshot> {
  const simpleInstruction = instructionForSimpleScopeKeyTarget(args.target)

  if (simpleInstruction) {
    return loadSnapshotForInstruction(ctx, args, simpleInstruction)
  }

  switch (args.target.kind) {
    case "conversation":
      return loadConversationTargetSnapshot(ctx, args, args.target)
    case "channel-post": {
      return loadChannelPostTargetSnapshot(ctx, args, args.target)
    }
    case "chat-message": {
      return loadChatMessageTargetSnapshot(ctx, args, args.target)
    }
    case "view": {
      return loadViewTargetSnapshot(ctx, args, args.target)
    }
    case "user-workspace-membership": {
      return loadUserWorkspaceMembershipTargetSnapshot(ctx, args, args.target)
    }
  }

  throw new Error(`Unsupported read model scope key target: ${args.target.kind}`)
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

type ParsedScopeKeyDescriptor = NonNullable<
  ReturnType<typeof parseReadModelScopeKey>
>

function userOwnedInstructionFromScopeKey(
  descriptor: ParsedScopeKeyDescriptor,
  currentUserId: string
): ScopedReadModelInstruction | null | undefined {
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

  return undefined
}

function searchInstructionFromScopeKey(
  descriptor: ParsedScopeKeyDescriptor,
  currentUserId: string
): ScopedReadModelInstruction | null | undefined {
  if (
    descriptor.kind !== READ_MODEL_SCOPE_KINDS.searchSeed &&
    descriptor.kind !== READ_MODEL_SCOPE_KINDS.privateSearchSeed &&
    descriptor.kind !== READ_MODEL_SCOPE_KINDS.privateDocumentIndex
  ) {
    return undefined
  }

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

type DetailInstructionFactory = (id: string) => ScopedReadModelInstruction

const detailInstructionFactories: Partial<
  Record<ReadModelScopeKind, DetailInstructionFactory>
> = {
  [READ_MODEL_SCOPE_KINDS.workspacePeople]: (workspaceId) => ({
    kind: "workspace-people",
    workspaceId,
  }),
  [READ_MODEL_SCOPE_KINDS.documentDetail]: (documentId) => ({
    kind: "document-detail",
    documentId,
  }),
  [READ_MODEL_SCOPE_KINDS.workItemDetail]: (itemId) => ({
    kind: "work-item-detail",
    itemId,
  }),
  [READ_MODEL_SCOPE_KINDS.projectDetail]: (projectId) => ({
    kind: "project-detail",
    projectId,
  }),
  [READ_MODEL_SCOPE_KINDS.conversationThread]: (conversationId) => ({
    kind: "conversation-thread",
    conversationId,
  }),
  [READ_MODEL_SCOPE_KINDS.channelFeed]: (conversationId) => ({
    kind: "channel-feed",
    conversationId,
  }),
}

function detailInstructionFromScopeKey(
  descriptor: ParsedScopeKeyDescriptor
): ScopedReadModelInstruction | null | undefined {
  const createInstruction = detailInstructionFactories[descriptor.kind]
  const id = descriptor.parts[0]

  return createInstruction ? (id ? createInstruction(id) : null) : undefined
}

function instructionFromScopeKey(
  descriptor: ParsedScopeKeyDescriptor,
  currentUserId: string
): ScopedReadModelInstruction | null {
  const userOwnedInstruction = userOwnedInstructionFromScopeKey(
    descriptor,
    currentUserId
  )

  if (userOwnedInstruction !== undefined) {
    return userOwnedInstruction
  }

  const searchInstruction = searchInstructionFromScopeKey(
    descriptor,
    currentUserId
  )

  if (searchInstruction !== undefined) {
    return searchInstruction
  }

  const detailInstruction = detailInstructionFromScopeKey(descriptor)

  if (detailInstruction !== undefined) {
    return detailInstruction
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

function requireParsedScopeKey(scopeKey: string): ParsedScopeKeyDescriptor {
  const descriptor = parseReadModelScopeKey(scopeKey)

  if (!descriptor) {
    throw new Error(`Invalid scoped read model key: ${scopeKey}`)
  }

  return descriptor
}

function authorizeWorkspaceMembershipScopeKey(
  descriptor: ParsedScopeKeyDescriptor,
  context: ScopedUserContext,
  scopeKey: string
) {
  if (descriptor.kind !== READ_MODEL_SCOPE_KINDS.workspaceMembership) {
    return false
  }

  if (
    descriptor.parts.length !== 1 ||
    !context.accessibleWorkspaceIds.has(descriptor.parts[0])
  ) {
    throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
  }

  return true
}

function resolveScopeKeyAuthorizationInstruction(
  descriptor: ParsedScopeKeyDescriptor,
  context: ScopedUserContext,
  scopeKey: string
): ScopedReadModelInstruction | null {
  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.shellContext) {
    return null
  }

  if (authorizeWorkspaceMembershipScopeKey(descriptor, context, scopeKey)) {
    return null
  }

  const instruction = instructionFromScopeKey(
    descriptor,
    context.currentUserId
  )

  if (!instruction) {
    throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
  }

  if (!isCollectionReadModelScopeKind(descriptor.kind)) {
    return instruction
  }

  if (!contextAuthorizesCollectionScope(descriptor, context)) {
    throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
  }

  return null
}

async function authorizeScopedReadModelScopeKey(
  ctx: QueryCtx,
  args: AuthorizeScopedReadModelScopeKeysArgs,
  context: ScopedUserContext,
  scopeKey: string
) {
  const descriptor = requireParsedScopeKey(scopeKey)
  const instruction = resolveScopeKeyAuthorizationInstruction(
    descriptor,
    context,
    scopeKey
  )

  if (!instruction) {
    return
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
    await authorizeScopedReadModelScopeKey(ctx, args, context, scopeKey)
  }
}
