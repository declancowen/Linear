"use client"

import { addDays, differenceInCalendarDays } from "date-fns"
import { create } from "zustand"
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware"
import { toast } from "sonner"

import {
  fetchSnapshot,
  hasConvex,
  syncAddComment,
  syncAddChannelPostComment,
  syncClearViewFilters,
  syncCreateAttachment,
  syncCreateChannel,
  syncCreateChannelPost,
  syncCreateDocument,
  syncCreateInvite,
  syncCreateProject,
  syncCreateTeam,
  syncCreateWorkspaceChat,
  syncCreateWorkItem,
  syncDeleteAttachment,
  syncDeleteChannelPost,
  syncDeleteWorkItem,
  syncEnsureTeamChat,
  syncGenerateAttachmentUploadUrl,
  syncJoinTeamByCode,
  syncMarkNotificationRead,
  syncRegenerateTeamJoinCode,
  syncSendChatMessage,
  syncShiftTimelineItem,
  syncStartConversationCall,
  syncToggleChannelPostReaction,
  syncToggleCommentReaction,
  syncToggleNotificationRead,
  syncToggleViewDisplayProperty,
  syncToggleViewFilterValue,
  syncToggleViewHiddenValue,
  syncUpdateTeamDetails,
  syncUpdateCurrentUserProfile,
  syncUpdateDocument,
  syncUpdateItemDescription,
  syncUpdateTeamWorkflowSettings,
  syncUpdateViewConfig,
  syncUpdateWorkItem,
  syncUpdateWorkspaceBranding,
} from "@/lib/convex/client"
import {
  getTeamFeatureSettings,
  getWorkItemDescendantIds,
  getTeamSurfaceDisableReason,
} from "@/lib/domain/selectors"
import { createSeedState } from "@/lib/domain/seed"
import {
  canParentWorkItemTypeAcceptChild,
  type AttachmentTargetType,
  type AppSnapshot,
  channelPostCommentSchema,
  channelPostSchema,
  channelSchema,
  chatMessageSchema,
  commentSchema,
  createDefaultTeamWorkflowSettings,
  documentSchema,
  getAllowedWorkItemTypesForTemplate,
  getDefaultWorkItemTypesForTeamExperience,
  inviteSchema,
  joinCodeSchema,
  normalizeTeamIconToken,
  normalizeTeamFeatureSettings,
  profileSchema,
  projectSchema,
  type AppData,
  type CommentTargetType,
  type Conversation,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type Priority,
  type Role,
  type ScopeType,
  type TeamFeatureSettings,
  teamDetailsSchema,
  type TeamWorkflowSettings,
  type WorkItemType,
  type WorkStatus,
  templateMeta,
  teamChatSchema,
  workspaceBrandingSchema,
  workspaceChatSchema,
  workItemSchema,
} from "@/lib/domain/types"

type WorkItemPatch = {
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

type CreateProjectInput = {
  scopeType: ScopeType
  scopeId: string
  templateType: "software-delivery" | "bug-tracking" | "project-management"
  name: string
  summary: string
  priority: Priority
  settingsTeamId?: string | null
}

type CreateWorkItemInput = {
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  priority: Priority
}

type CreateDocumentInput =
  | {
      kind: "team-document"
      teamId: string
      title: string
    }
  | {
      kind: "workspace-document" | "private-document"
      workspaceId: string
      title: string
    }

type CreateInviteInput = {
  teamIds: string[]
  email: string
  role: Role
}

type UpdateWorkspaceBrandingInput = {
  name: string
  logoUrl: string
  logoImageStorageId?: string
  clearLogoImage?: boolean
  accent: string
  description: string
}

type TeamDetailsInput = {
  name: string
  icon: string
  summary: string
  experience: AppData["teams"][number]["settings"]["experience"]
  features: AppData["teams"][number]["settings"]["features"]
}

type CreateTeamInput = TeamDetailsInput

type UpdateTeamDetailsInput = TeamDetailsInput

type UpdateProfileInput = {
  name: string
  title: string
  avatarUrl: string
  avatarImageStorageId?: string
  clearAvatarImage?: boolean
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: "light" | "dark" | "system"
  }
}

type AddCommentInput = {
  targetType: CommentTargetType
  targetId: string
  parentCommentId?: string | null
  content: string
}

type CreateWorkspaceChatInput = {
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}

type EnsureTeamChatInput = {
  teamId: string
  title: string
  description: string
}

type CreateChannelInput =
  | {
      teamId: string
      workspaceId?: never
      silent?: boolean
      title: string
      description: string
    }
  | {
      workspaceId: string
      teamId?: never
      silent?: boolean
      title: string
      description: string
    }

type SendChatMessageInput = {
  conversationId: string
  content: string
}

type CreateChannelPostInput = {
  conversationId: string
  title: string
  content: string
}

type AddChannelPostCommentInput = {
  postId: string
  content: string
}

export type AppStore = AppData & {
  replaceDomainData: (data: AppSnapshot) => void
  resetDemo: () => void
  setActiveTeam: (teamId: string) => void
  setRolePreview: (role: Role | null) => void
  setSelectedView: (route: string, viewId: string) => void
  setActiveInboxNotification: (notificationId: string | null) => void
  markNotificationRead: (notificationId: string) => void
  toggleNotificationRead: (notificationId: string) => void
  updateWorkspaceBranding: (input: UpdateWorkspaceBrandingInput) => void
  createTeam: (input: CreateTeamInput) => Promise<{
    teamId: string
    teamSlug: string
    features: TeamFeatureSettings
  } | null>
  updateTeamDetails: (
    teamId: string,
    input: UpdateTeamDetailsInput
  ) => Promise<boolean>
  regenerateTeamJoinCode: (teamId: string) => Promise<boolean>
  updateCurrentUserProfile: (input: UpdateProfileInput) => void
  updateViewConfig: (
    viewId: string,
    patch: Partial<{
      layout: "list" | "board" | "timeline"
      grouping: GroupField
      subGrouping: GroupField | null
      ordering: OrderingField
      showCompleted: boolean
    }>
  ) => void
  toggleViewDisplayProperty: (viewId: string, property: DisplayProperty) => void
  toggleViewHiddenValue: (
    viewId: string,
    key: "groups" | "subgroups",
    value: string
  ) => void
  toggleViewFilterValue: (
    viewId: string,
    key:
      | "status"
      | "priority"
      | "assigneeIds"
      | "projectIds"
      | "itemTypes"
      | "labelIds",
    value: string
  ) => void
  clearViewFilters: (viewId: string) => void
  updateWorkItem: (itemId: string, patch: WorkItemPatch) => void
  deleteWorkItem: (itemId: string) => Promise<boolean>
  shiftTimelineItem: (itemId: string, nextStartDate: string) => void
  updateDocumentContent: (documentId: string, content: string) => void
  renameDocument: (documentId: string, title: string) => void
  updateItemDescription: (itemId: string, content: string) => void
  uploadAttachment: (
    targetType: AttachmentTargetType,
    targetId: string,
    file: File
  ) => Promise<{ fileName: string; fileUrl: string | null } | null>
  deleteAttachment: (attachmentId: string) => Promise<void>
  addComment: (input: AddCommentInput) => void
  toggleCommentReaction: (commentId: string, emoji: string) => void
  createWorkspaceChat: (input: CreateWorkspaceChatInput) => string | null
  ensureTeamChat: (input: EnsureTeamChatInput) => string | null
  createChannel: (input: CreateChannelInput) => string | null
  startConversationCall: (conversationId: string) => Promise<string | null>
  sendChatMessage: (input: SendChatMessageInput) => void
  createChannelPost: (input: CreateChannelPostInput) => void
  addChannelPostComment: (input: AddChannelPostCommentInput) => void
  deleteChannelPost: (postId: string) => void
  toggleChannelPostReaction: (postId: string, emoji: string) => void
  createInvite: (input: CreateInviteInput) => void
  joinTeamByCode: (code: string) => Promise<boolean>
  createProject: (input: CreateProjectInput) => void
  createDocument: (input: CreateDocumentInput) => void
  createWorkItem: (input: CreateWorkItemInput) => string | null
  updateTeamWorkflowSettings: (
    teamId: string,
    workflow: TeamWorkflowSettings
  ) => void
}

function getNow() {
  return new Date().toISOString()
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function extractDocumentTitleFromContent(content: string) {
  const match = content.match(/<h1[^>]*>(.*?)<\/h1>/)

  if (!match?.[1]) {
    return null
  }

  const plainTitle = match[1].replace(/<[^>]*>/g, "").trim()
  return plainTitle.length > 0 ? plainTitle : null
}

const RICH_TEXT_SYNC_DELAY_MS = 350

type QueuedSyncEntry = {
  fallbackMessage: string
  inFlight: boolean
  latestTask: (() => Promise<unknown> | null) | null
  timeoutId: ReturnType<typeof setTimeout> | null
}

const queuedRichTextSyncs = new Map<string, QueuedSyncEntry>()

async function handleSyncFailure(error: unknown, fallbackMessage: string) {
  console.error(error)
  const state = useAppStore.getState()
  const currentUserEmail = state.users.find(
    (user) => user.id === state.currentUserId
  )?.email
  const snapshot = await fetchSnapshot(currentUserEmail)

  if (snapshot) {
    useAppStore.getState().replaceDomainData(snapshot)
  }

  toast.error(fallbackMessage)
}

async function flushQueuedRichTextSync(key: string) {
  const entry = queuedRichTextSyncs.get(key)

  if (!entry || entry.inFlight || !entry.latestTask) {
    return
  }

  const task = entry.latestTask
  entry.latestTask = null
  entry.inFlight = true

  try {
    await task()
  } catch (error) {
    await handleSyncFailure(error, entry.fallbackMessage)
  } finally {
    entry.inFlight = false

    if (entry.latestTask) {
      void flushQueuedRichTextSync(key)
      return
    }

    if (!entry.timeoutId) {
      queuedRichTextSyncs.delete(key)
    }
  }
}

function queueRichTextSync(
  key: string,
  task: () => Promise<unknown> | null,
  fallbackMessage: string
) {
  const existingEntry = queuedRichTextSyncs.get(key)

  if (existingEntry?.timeoutId) {
    clearTimeout(existingEntry.timeoutId)
  }

  const entry: QueuedSyncEntry = existingEntry ?? {
    fallbackMessage,
    inFlight: false,
    latestTask: null,
    timeoutId: null,
  }

  entry.fallbackMessage = fallbackMessage
  entry.latestTask = task
  entry.timeoutId = setTimeout(() => {
    entry.timeoutId = null
    void flushQueuedRichTextSync(key)
  }, RICH_TEXT_SYNC_DELAY_MS)

  queuedRichTextSyncs.set(key, entry)
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

function createMentionIds(
  content: string,
  users: AppData["users"],
  allowedUserIds?: Iterable<string>
) {
  const audience = allowedUserIds ? new Set(allowedUserIds) : null
  const handles = [...content.matchAll(/@([a-z0-9_-]+)/gi)].map((match) =>
    match[1]?.toLowerCase()
  )

  return [...new Set(
    users
      .filter((user) => handles.includes(user.handle.toLowerCase()))
      .filter((user) => (audience ? audience.has(user.id) : true))
      .map((user) => user.id)
  )]
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

function getTeamMemberIds(state: AppData, teamId: string) {
  return state.teamMemberships
    .filter((membership) => membership.teamId === teamId)
    .map((membership) => membership.userId)
}

function getProjectsForTeamScope(state: AppData, teamId: string) {
  const team = state.teams.find((entry) => entry.id === teamId)

  if (!team) {
    return []
  }

  return state.projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === teamId) ||
      (project.scopeType === "workspace" &&
        project.scopeId === team.workspaceId)
  )
}

function getProjectCreationValidationMessage(
  state: AppData,
  input: CreateProjectInput
) {
  if (input.scopeType !== "team") {
    return null
  }

  const team = state.teams.find((entry) => entry.id === input.scopeId)

  if (!team) {
    return "Team not found"
  }

  return getTeamFeatureSettings(team).projects
    ? null
    : "Projects are disabled for this team"
}

function getDocumentCreationValidationMessage(
  state: AppData,
  input: CreateDocumentInput
) {
  if (input.kind !== "team-document") {
    return null
  }

  const team = state.teams.find((entry) => entry.id === input.teamId)

  if (!team) {
    return "Team not found"
  }

  return getTeamFeatureSettings(team).docs
    ? null
    : "Docs are disabled for this team"
}

function getWorkItemValidationMessage(
  state: AppData,
  input: CreateWorkItemInput & { currentItemId?: string | null }
) {
  const team = state.teams.find((entry) => entry.id === input.teamId)

  if (!team) {
    return "Team not found"
  }

  if (!getTeamFeatureSettings(team).issues) {
    return "Issues are disabled for this team"
  }

  if (
    input.assigneeId &&
    !getTeamMemberIds(state, input.teamId).includes(input.assigneeId)
  ) {
    return "Assignee must belong to the selected team"
  }

  const parent = input.parentId
    ? (state.workItems.find((entry) => entry.id === input.parentId) ?? null)
    : null

  if (input.parentId) {
    if (!parent) {
      return "Parent issue not found"
    }

    if (parent.teamId !== input.teamId) {
      return "Parent issue must belong to the same team"
    }

    if (parent.parentId) {
      return "Sub-issues can't contain other sub-issues"
    }

    if (input.currentItemId && parent.id === input.currentItemId) {
      return "Issue cannot be its own parent"
    }

    if (!canParentWorkItemTypeAcceptChild(parent.type, input.type)) {
      return "Selected parent cannot contain this work item type"
    }

    if (
      input.currentItemId &&
      getWorkItemDescendantIds(state, input.currentItemId).has(parent.id)
    ) {
      return "Issue hierarchy cannot contain cycles"
    }

    if (
      input.currentItemId &&
      getWorkItemDescendantIds(state, input.currentItemId).size > 0
    ) {
      return "Issues with sub-issues can't be nested under another issue"
    }
  }

  const resolvedPrimaryProjectId =
    input.primaryProjectId ?? parent?.primaryProjectId ?? null

  if (resolvedPrimaryProjectId) {
    const project = getProjectsForTeamScope(state, input.teamId).find(
      (entry) => entry.id === resolvedPrimaryProjectId
    )

    if (!project) {
      return "Project must belong to the same team or workspace"
    }

    return getAllowedWorkItemTypesForTemplate(project.templateType).includes(
      input.type
    )
      ? null
      : "Work item type is not allowed for the selected project template"
  }

  return getDefaultWorkItemTypesForTeamExperience(
    team.settings.experience
  ).includes(input.type)
    ? null
    : "Work item type is not allowed for this team"
}

function getWorkItemCascadeDeletePlan(state: AppData, itemId: string) {
  const item = state.workItems.find((entry) => entry.id === itemId) ?? null

  if (!item) {
    return null
  }

  const deletedItemIds = new Set<string>([
    itemId,
    ...getWorkItemDescendantIds(state, itemId),
  ])
  const deletedDescriptionDocIds = new Set(
    state.workItems
      .filter((entry) => deletedItemIds.has(entry.id))
      .map((entry) => entry.descriptionDocId)
  )
  const deletedCommentIds = new Set(
    state.comments
      .filter((comment) => {
        const targetsDeletedItem =
          comment.targetType === "workItem" &&
          deletedItemIds.has(comment.targetId)
        const targetsDeletedDescription =
          comment.targetType === "document" &&
          deletedDescriptionDocIds.has(comment.targetId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((comment) => comment.id)
  )
  const deletedAttachmentIds = new Set(
    state.attachments
      .filter((attachment) => {
        const targetsDeletedItem =
          attachment.targetType === "workItem" &&
          deletedItemIds.has(attachment.targetId)
        const targetsDeletedDescription =
          attachment.targetType === "document" &&
          deletedDescriptionDocIds.has(attachment.targetId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((attachment) => attachment.id)
  )
  const deletedNotificationIds = new Set(
    state.notifications
      .filter((notification) => {
        const targetsDeletedItem =
          notification.entityType === "workItem" &&
          deletedItemIds.has(notification.entityId)
        const targetsDeletedDescription =
          notification.entityType === "document" &&
          deletedDescriptionDocIds.has(notification.entityId)

        return targetsDeletedItem || targetsDeletedDescription
      })
      .map((notification) => notification.id)
  )
  const nextWorkItems = state.workItems
    .filter((entry) => !deletedItemIds.has(entry.id))
    .map((entry) => {
      const nextLinkedDocumentIds = entry.linkedDocumentIds.filter(
        (documentId) => !deletedDescriptionDocIds.has(documentId)
      )

      if (nextLinkedDocumentIds.length === entry.linkedDocumentIds.length) {
        return entry
      }

      return {
        ...entry,
        linkedDocumentIds: nextLinkedDocumentIds,
        updatedAt: getNow(),
      }
    })
  const nextDocuments = state.documents
    .filter((document) => !deletedDescriptionDocIds.has(document.id))
    .map((document) => {
      const nextLinkedWorkItemIds = document.linkedWorkItemIds.filter(
        (linkedItemId) => !deletedItemIds.has(linkedItemId)
      )

      if (nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length) {
        return document
      }

      return {
        ...document,
        linkedWorkItemIds: nextLinkedWorkItemIds,
        updatedAt: getNow(),
        updatedBy: state.currentUserId,
      }
    })

  return {
    item,
    deletedItemIds,
    deletedCommentIds,
    deletedAttachmentIds,
    deletedNotificationIds,
    nextWorkItems,
    nextDocuments,
  }
}

function getWorkspaceMemberIds(state: AppData, workspaceId: string) {
  const workspaceTeamIds = state.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)

  return [
    ...new Set(
      state.teamMemberships
        .filter((membership) => workspaceTeamIds.includes(membership.teamId))
        .map((membership) => membership.userId)
    ),
  ]
}

function getConversationAudienceUserIds(
  state: AppData,
  conversation: Conversation
) {
  if (conversation.scopeType === "team") {
    return getTeamMemberIds(state, conversation.scopeId)
  }

  const workspaceUserIds = new Set(
    getWorkspaceMemberIds(state, conversation.scopeId)
  )

  if (conversation.kind === "channel") {
    return [...workspaceUserIds]
  }

  return conversation.participantIds.filter((userId) => workspaceUserIds.has(userId))
}

function buildWorkspaceChatTitle(
  state: AppData,
  currentUserId: string,
  participantIds: string[],
  title: string
) {
  const trimmedTitle = title.trim()

  if (trimmedTitle) {
    return trimmedTitle
  }

  const otherParticipants = participantIds.filter(
    (userId) => userId !== currentUserId
  )

  if (otherParticipants.length === 1) {
    return (
      state.users.find((user) => user.id === otherParticipants[0])?.name ??
      "Direct chat"
    )
  }

  const names = otherParticipants
    .map((userId) => state.users.find((user) => user.id === userId)?.name ?? "")
    .filter(Boolean)
    .join(", ")

  return names.slice(0, 80) || "Group chat"
}

function effectiveRole(data: AppData, teamId: string) {
  if (data.ui.rolePreview) {
    return data.ui.rolePreview
  }

  return (
    data.teamMemberships.find(
      (membership) =>
        membership.teamId === teamId && membership.userId === data.currentUserId
    )?.role ?? null
  )
}

function canEditWorkspaceDocuments(data: AppData, workspaceId: string) {
  return data.teams.some((team) => {
    if (team.workspaceId !== workspaceId) {
      return false
    }

    const role = effectiveRole(data, team.id)
    return role === "admin" || role === "member"
  })
}

function getTeamWorkflowSettings(
  state: AppData,
  teamId: string | null | undefined
) {
  const team = teamId
    ? (state.teams.find((entry) => entry.id === teamId) ?? null)
    : null

  return (
    team?.settings.workflow ??
    createDefaultTeamWorkflowSettings(
      team?.settings.experience ?? "software-development"
    )
  )
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

function normalizeChannelPosts<
  T extends { reactions?: { emoji: string; userIds: string[] }[] },
>(channelPosts: T[]) {
  return channelPosts.map((post) => ({
    ...post,
    reactions: post.reactions ?? [],
  }))
}

function normalizeComments<
  T extends {
    mentionUserIds?: string[]
    reactions?: { emoji: string; userIds: string[] }[]
  },
>(comments: T[]) {
  return comments.map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
    reactions: comment.reactions ?? [],
  }))
}

function normalizeChatMessages<
  T extends {
    mentionUserIds?: string[]
    kind?: "text" | "call"
    callId?: string | null
  },
>(chatMessages: T[]) {
  return chatMessages.map((message) => ({
    ...message,
    kind: message.kind ?? "text",
    callId: message.callId ?? null,
    mentionUserIds: message.mentionUserIds ?? [],
  }))
}

function normalizeChannelPostComments<T extends { mentionUserIds?: string[] }>(
  channelPostComments: T[]
) {
  return channelPostComments.map((comment) => ({
    ...comment,
    mentionUserIds: comment.mentionUserIds ?? [],
  }))
}

function syncInBackground(
  task: Promise<unknown> | null,
  fallbackMessage: string
) {
  if (!task) {
    return
  }

  void task.catch((error) => handleSyncFailure(error, fallbackMessage))
}

function getTeamDetailsDisableMessage(
  state: AppData,
  teamId: string,
  nextFeatures: AppData["teams"][number]["settings"]["features"]
) {
  const team = state.teams.find((entry) => entry.id === teamId)

  if (!team) {
    return "Team not found"
  }

  const currentFeatures = getTeamFeatureSettings(team)

  for (const feature of ["docs", "chat", "channels"] as const) {
    if (!currentFeatures[feature] || nextFeatures[feature]) {
      continue
    }

    const disableReason = getTeamSurfaceDisableReason(state, teamId, feature)

    if (disableReason) {
      return disableReason
    }
  }

  return null
}

async function refreshFromServer() {
  const state = useAppStore.getState()
  const currentUserEmail = state.users.find(
    (user) => user.id === state.currentUserId
  )?.email
  const snapshot = await fetchSnapshot(currentUserEmail)

  if (snapshot) {
    useAppStore.getState().replaceDomainData(snapshot)
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...createSeedState(),
      replaceDomainData(data) {
        set((state) => ({
          ...state,
          ...data,
          comments: normalizeComments(data.comments),
          chatMessages: normalizeChatMessages(data.chatMessages),
          channelPosts: normalizeChannelPosts(data.channelPosts),
          channelPostComments: normalizeChannelPostComments(
            data.channelPostComments
          ),
          ui: {
            ...state.ui,
            activeTeamId:
              state.ui.activeTeamId ||
              data.teams[0]?.id ||
              state.ui.activeTeamId,
          },
        }))
      },
      resetDemo() {
        if (hasConvex) {
          toast.error("Reset is disabled while Convex is connected")
          return
        }

        set(createSeedState())
        toast.success("Demo data reset")
      },
      setActiveTeam(teamId) {
        set((state) => ({
          ui: {
            ...state.ui,
            activeTeamId: teamId,
          },
        }))
      },
      setRolePreview(role) {
        set((state) => ({
          ui: {
            ...state.ui,
            rolePreview: role,
          },
        }))
      },
      setSelectedView(route, viewId) {
        set((state) => ({
          ui: {
            ...state.ui,
            selectedViewByRoute: {
              ...state.ui.selectedViewByRoute,
              [route]: viewId,
            },
          },
        }))
      },
      setActiveInboxNotification(notificationId) {
        set((state) => ({
          ui: {
            ...state.ui,
            activeInboxNotificationId: notificationId,
          },
        }))
      },
      markNotificationRead(notificationId) {
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === notificationId
              ? { ...notification, readAt: notification.readAt ?? getNow() }
              : notification
          ),
        }))

        syncInBackground(
          syncMarkNotificationRead(notificationId),
          "Failed to update notification"
        )
      },
      toggleNotificationRead(notificationId) {
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === notificationId
              ? {
                  ...notification,
                  readAt: notification.readAt ? null : getNow(),
                }
              : notification
          ),
        }))

        syncInBackground(
          syncToggleNotificationRead(notificationId),
          "Failed to update notification"
        )
      },
      updateWorkspaceBranding(input) {
        const parsed = workspaceBrandingSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Workspace branding is invalid")
          return
        }

        set((state) => ({
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === state.currentWorkspaceId
              ? {
                  ...workspace,
                  name: parsed.data.name,
                  logoUrl: parsed.data.logoUrl,
                  logoImageUrl: parsed.data.clearLogoImage
                    ? null
                    : workspace.logoImageUrl,
                  settings: {
                    ...workspace.settings,
                    accent: parsed.data.accent,
                    description: parsed.data.description,
                  },
                }
              : workspace
          ),
        }))

        syncInBackground(
          syncUpdateWorkspaceBranding(
            useAppStore.getState().currentWorkspaceId,
            parsed.data.name,
            parsed.data.logoUrl,
            parsed.data.accent,
            parsed.data.description,
            {
              logoImageStorageId: parsed.data.logoImageStorageId,
              clearLogoImage: parsed.data.clearLogoImage,
            }
          ),
          "Failed to update workspace"
        )

        toast.success("Workspace updated")
      },
      async createTeam(input) {
        const parsed = teamDetailsSchema.safeParse({
          ...input,
          icon: normalizeTeamIconToken(input.icon, input.experience),
        })
        if (!parsed.success) {
          toast.error("Team details are invalid")
          return null
        }

        try {
          const result = await syncCreateTeam(parsed.data)

          if (!result?.teamId || !result.teamSlug) {
            throw new Error("Failed to create team")
          }

          await refreshFromServer()
          useAppStore.getState().setActiveTeam(result.teamId)
          toast.success("Team created")

          return {
            teamId: result.teamId,
            teamSlug: result.teamSlug,
            features: result.features,
          }
        } catch (error) {
          console.error(error)
          toast.error(
            error instanceof Error ? error.message : "Failed to create team"
          )
          return null
        }
      },
      async updateTeamDetails(teamId, input) {
        const parsed = teamDetailsSchema.safeParse({
          ...input,
          icon: normalizeTeamIconToken(input.icon, input.experience),
        })
        if (!parsed.success) {
          toast.error("Team details are invalid")
          return false
        }

        const stateBeforeUpdate = useAppStore.getState()
        const team = stateBeforeUpdate.teams.find(
          (entry) => entry.id === teamId
        )

        if (!team) {
          toast.error("Team not found")
          return false
        }

        const nextFeatures = normalizeTeamFeatureSettings(
          parsed.data.experience,
          parsed.data.features
        )
        const currentFeatures = getTeamFeatureSettings(team)
        const disableMessage = getTeamDetailsDisableMessage(
          stateBeforeUpdate,
          teamId,
          nextFeatures
        )

        if (disableMessage) {
          toast.error(disableMessage)
          return false
        }

        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  name: parsed.data.name,
                  icon: parsed.data.icon,
                  settings: {
                    ...team.settings,
                    summary: parsed.data.summary,
                    experience: parsed.data.experience,
                    features: nextFeatures,
                  },
                }
              : team
          ),
        }))

        try {
          await syncUpdateTeamDetails(teamId, parsed.data)
          if (
            (!currentFeatures.chat && nextFeatures.chat) ||
            (!currentFeatures.channels && nextFeatures.channels)
          ) {
            await refreshFromServer()
          }
          toast.success("Team updated")
          return true
        } catch (error) {
          console.error(error)

          const currentState = useAppStore.getState()
          const currentUserEmail = currentState.users.find(
            (user) => user.id === currentState.currentUserId
          )?.email
          const snapshot = await fetchSnapshot(currentUserEmail)

          if (snapshot) {
            useAppStore.getState().replaceDomainData(snapshot)
          } else {
            set((state) => ({
              teams: state.teams.map((entry) =>
                entry.id === teamId ? team : entry
              ),
            }))
          }

          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to update team details"
          )
          return false
        }
      },
      async regenerateTeamJoinCode(teamId) {
        const team = get().teams.find((entry) => entry.id === teamId)

        if (!team) {
          toast.error("Team not found")
          return false
        }

        try {
          const result = await syncRegenerateTeamJoinCode(teamId)

          if (!result) {
            throw new Error("Failed to regenerate join code")
          }

          set((state) => ({
            teams: state.teams.map((entry) =>
              entry.id === teamId
                ? {
                    ...entry,
                    settings: {
                      ...entry.settings,
                      joinCode: result.joinCode,
                    },
                  }
                : entry
            ),
          }))

          toast.success("Join code regenerated")
          return true
        } catch (error) {
          console.error(error)
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to regenerate join code"
          )
          return false
        }
      },
      updateCurrentUserProfile(input) {
        const parsed = profileSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Profile details are invalid")
          return
        }

        set((state) => ({
          users: state.users.map((user) =>
            user.id === state.currentUserId
              ? {
                  ...user,
                  ...parsed.data,
                  avatarImageUrl: parsed.data.clearAvatarImage
                    ? null
                    : user.avatarImageUrl,
                }
              : user
          ),
        }))

        syncInBackground(
          syncUpdateCurrentUserProfile(
            useAppStore.getState().currentUserId,
            parsed.data.name,
            parsed.data.title,
            parsed.data.avatarUrl,
            parsed.data.preferences,
            {
              avatarImageStorageId: parsed.data.avatarImageStorageId,
              clearAvatarImage: parsed.data.clearAvatarImage,
            }
          ),
          "Failed to update profile"
        )

        toast.success("Profile updated")
      },
      updateViewConfig(viewId, patch) {
        set((state) => ({
          views: state.views.map((view) =>
            view.id === viewId
              ? {
                  ...view,
                  ...patch,
                  filters:
                    patch.showCompleted === undefined
                      ? view.filters
                      : {
                          ...view.filters,
                          showCompleted: patch.showCompleted,
                        },
                  updatedAt: getNow(),
                }
              : view
          ),
        }))

        syncInBackground(
          syncUpdateViewConfig(viewId, patch),
          "Failed to update view"
        )
      },
      toggleViewDisplayProperty(viewId, property) {
        set((state) => ({
          views: state.views.map((view) => {
            if (view.id !== viewId) {
              return view
            }

            const nextDisplayProps = view.displayProps.includes(property)
              ? view.displayProps.filter((value) => value !== property)
              : [...view.displayProps, property]

            return {
              ...view,
              displayProps: nextDisplayProps,
              updatedAt: getNow(),
            }
          }),
        }))

        syncInBackground(
          syncToggleViewDisplayProperty(viewId, property),
          "Failed to update view"
        )
      },
      toggleViewHiddenValue(viewId, key, value) {
        set((state) => ({
          views: state.views.map((view) => {
            if (view.id !== viewId) {
              return view
            }

            const values = view.hiddenState[key]
            const nextValues = values.includes(value)
              ? values.filter((entry) => entry !== value)
              : [...values, value]

            return {
              ...view,
              hiddenState: {
                ...view.hiddenState,
                [key]: nextValues,
              },
              updatedAt: getNow(),
            }
          }),
        }))

        syncInBackground(
          syncToggleViewHiddenValue(viewId, key, value),
          "Failed to update view"
        )
      },
      toggleViewFilterValue(viewId, key, value) {
        set((state) => ({
          views: state.views.map((view) => {
            if (view.id !== viewId) {
              return view
            }

            const current = view.filters[key]
            const next = current.includes(value as never)
              ? current.filter((entry) => entry !== value)
              : [...current, value]

            return {
              ...view,
              filters: {
                ...view.filters,
                [key]: next,
              },
              updatedAt: getNow(),
            }
          }),
        }))

        syncInBackground(
          syncToggleViewFilterValue(viewId, key, value),
          "Failed to update filters"
        )
      },
      clearViewFilters(viewId) {
        set((state) => ({
          views: state.views.map((view) => {
            if (view.id !== viewId) {
              return view
            }

            return {
              ...view,
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
            }
          }),
        }))

        syncInBackground(
          syncClearViewFilters(viewId),
          "Failed to update filters"
        )
      },
      updateWorkItem(itemId, patch) {
        const state = get()
        const existing = state.workItems.find((item) => item.id === itemId)

        if (!existing) {
          return
        }

        const validationMessage = getWorkItemValidationMessage(state, {
          teamId: existing.teamId,
          type: existing.type,
          title: existing.title,
          priority: patch.priority ?? existing.priority,
          assigneeId:
            patch.assigneeId === undefined
              ? existing.assigneeId
              : patch.assigneeId,
          parentId:
            patch.parentId === undefined ? existing.parentId : patch.parentId,
          primaryProjectId:
            patch.primaryProjectId === undefined
              ? existing.primaryProjectId
              : patch.primaryProjectId,
          currentItemId: existing.id,
        })

        if (validationMessage) {
          toast.error(validationMessage)
          return
        }

        set((state) => {
          const existing = state.workItems.find((item) => item.id === itemId)
          if (!existing) {
            return state
          }

          const nextItems = state.workItems.map((item) =>
            item.id === itemId
              ? { ...item, ...patch, updatedAt: getNow() }
              : item
          )

          const notifications = [...state.notifications]
          const actor = state.users.find(
            (user) => user.id === state.currentUserId
          )

          if (
            patch.assigneeId !== undefined &&
            patch.assigneeId &&
            patch.assigneeId !== existing.assigneeId &&
            patch.assigneeId !== state.currentUserId
          ) {
            notifications.unshift(
              createNotification(
                patch.assigneeId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} assigned you ${existing.title}`,
                "workItem",
                existing.id,
                "assignment"
              )
            )
          }

          if (
            patch.status &&
            patch.status !== existing.status &&
            existing.creatorId !== state.currentUserId
          ) {
            notifications.unshift(
              createNotification(
                existing.creatorId,
                state.currentUserId,
                `${existing.title} moved to ${patch.status}`,
                "workItem",
                existing.id,
                "status-change"
              )
            )
          }

          return {
            ...state,
            workItems: nextItems,
            notifications,
          }
        })

        syncInBackground(
          syncUpdateWorkItem(
            useAppStore.getState().currentUserId,
            itemId,
            patch
          ),
          "Failed to update work item"
        )
      },
      async deleteWorkItem(itemId) {
        const state = get()
        const deletionPlan = getWorkItemCascadeDeletePlan(state, itemId)

        if (!deletionPlan) {
          return false
        }

        const role = effectiveRole(state, deletionPlan.item.teamId)

        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return false
        }

        const previousState = {
          workItems: state.workItems,
          documents: state.documents,
          comments: state.comments,
          attachments: state.attachments,
          notifications: state.notifications,
        }

        set((current) => {
          const nextPlan = getWorkItemCascadeDeletePlan(current, itemId)

          if (!nextPlan) {
            return current
          }

          return {
            ...current,
            workItems: nextPlan.nextWorkItems,
            documents: nextPlan.nextDocuments,
            comments: current.comments.filter(
              (entry) => !nextPlan.deletedCommentIds.has(entry.id)
            ),
            attachments: current.attachments.filter(
              (entry) => !nextPlan.deletedAttachmentIds.has(entry.id)
            ),
            notifications: current.notifications.filter(
              (entry) => !nextPlan.deletedNotificationIds.has(entry.id)
            ),
          }
        })

        try {
          await syncDeleteWorkItem(itemId)
          await refreshFromServer()
          toast.success(
            deletionPlan.deletedItemIds.size > 1
              ? `Deleted ${deletionPlan.deletedItemIds.size} items`
              : "Item deleted"
          )
          return true
        } catch (error) {
          console.error(error)
          set((current) => ({
            ...current,
            ...previousState,
          }))
          await refreshFromServer()
          toast.error("Failed to delete item")
          return false
        }
      },
      shiftTimelineItem(itemId, nextStartDate) {
        set((state) => {
          const item = state.workItems.find((entry) => entry.id === itemId)
          if (!item || !item.startDate) {
            return state
          }

          const delta = differenceInCalendarDays(
            new Date(nextStartDate),
            new Date(item.startDate)
          )

          return {
            ...state,
            workItems: state.workItems.map((entry) => {
              if (entry.id !== itemId) {
                return entry
              }

              return {
                ...entry,
                startDate: nextStartDate,
                dueDate: entry.dueDate
                  ? addDays(new Date(entry.dueDate), delta).toISOString()
                  : entry.dueDate,
                targetDate: entry.targetDate
                  ? addDays(new Date(entry.targetDate), delta).toISOString()
                  : entry.targetDate,
                updatedAt: getNow(),
              }
            }),
          }
        })

        syncInBackground(
          syncShiftTimelineItem(itemId, nextStartDate),
          "Failed to move timeline item"
        )
      },
      updateDocumentContent(documentId, content) {
        const updatedAt = getNow()
        const nextTitle = extractDocumentTitleFromContent(content)

        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  content,
                  title: nextTitle ?? document.title,
                  updatedAt,
                  updatedBy: state.currentUserId,
                }
              : document
          ),
        }))

        queueRichTextSync(
          `document:${documentId}`,
          () => {
            const state = useAppStore.getState()
            const document = state.documents.find(
              (entry) => entry.id === documentId
            )

            if (!document || document.kind === "item-description") {
              return null
            }

            return syncUpdateDocument(documentId, {
              title: document.title,
              content: document.content,
            })
          },
          "Failed to update document"
        )
      },
      renameDocument(documentId, title) {
        const updatedAt = getNow()

        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  title,
                  updatedAt,
                  updatedBy: state.currentUserId,
                }
              : document
          ),
        }))

        queueRichTextSync(
          `document:${documentId}`,
          () => {
            const state = useAppStore.getState()
            const document = state.documents.find(
              (entry) => entry.id === documentId
            )

            if (!document || document.kind === "item-description") {
              return null
            }

            return syncUpdateDocument(documentId, {
              title: document.title,
              content: document.content,
            })
          },
          "Failed to update document"
        )
      },
      updateItemDescription(itemId, content) {
        const updatedAt = getNow()

        set((state) => {
          const item = state.workItems.find((entry) => entry.id === itemId)
          if (!item) {
            return state
          }

          return {
            ...state,
            documents: state.documents.map((document) =>
              document.id === item.descriptionDocId
                ? {
                    ...document,
                    content,
                    updatedAt,
                    updatedBy: state.currentUserId,
                  }
                : document
            ),
            workItems: state.workItems.map((entry) =>
              entry.id === itemId ? { ...entry, updatedAt } : entry
            ),
          }
        })

        queueRichTextSync(
          `item-description:${itemId}`,
          () => {
            const state = useAppStore.getState()
            const item = state.workItems.find((entry) => entry.id === itemId)

            if (!item) {
              return null
            }

            const descriptionDocument = state.documents.find(
              (document) => document.id === item.descriptionDocId
            )

            if (!descriptionDocument) {
              return null
            }

            return syncUpdateItemDescription(
              state.currentUserId,
              itemId,
              descriptionDocument.content
            )
          },
          "Failed to update description"
        )
      },
      async uploadAttachment(targetType, targetId, file) {
        const state = useAppStore.getState()
        const maxSize = 25 * 1024 * 1024
        let teamId = ""

        if (targetType === "workItem") {
          teamId =
            state.workItems.find((item) => item.id === targetId)?.teamId ?? ""
        } else {
          teamId =
            state.documents.find((document) => document.id === targetId)
              ?.teamId ?? ""
        }

        const role = effectiveRole(state, teamId)

        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return null
        }

        if (!file || file.size <= 0) {
          toast.error("Choose a file to upload")
          return null
        }

        if (file.size > maxSize) {
          toast.error("Files must be 25 MB or smaller")
          return null
        }

        try {
          const upload = await syncGenerateAttachmentUploadUrl(
            targetType,
            targetId
          )

          if (!upload?.uploadUrl) {
            throw new Error("Upload URL was not returned")
          }

          const uploadResponse = await fetch(upload.uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          })
          const uploadPayload = (await uploadResponse.json()) as {
            storageId?: string
          }

          if (!uploadResponse.ok || !uploadPayload.storageId) {
            throw new Error("File upload failed")
          }

          const createdAttachment = await syncCreateAttachment({
            targetType,
            targetId,
            storageId: uploadPayload.storageId,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          })
          await refreshFromServer()
          toast.success(`${file.name} uploaded`)
          return {
            fileName: file.name,
            fileUrl: createdAttachment?.fileUrl ?? null,
          }
        } catch (error) {
          console.error(error)
          await refreshFromServer()
          toast.error("Failed to upload attachment")
          return null
        }
      },
      async deleteAttachment(attachmentId) {
        const state = useAppStore.getState()
        const attachment = state.attachments.find(
          (entry) => entry.id === attachmentId
        )

        if (!attachment) {
          return
        }

        const role = effectiveRole(state, attachment.teamId)

        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return
        }

        set((current) => ({
          attachments: current.attachments.filter(
            (entry) => entry.id !== attachmentId
          ),
        }))

        try {
          await syncDeleteAttachment(attachmentId)
          await refreshFromServer()
          toast.success("Attachment deleted")
        } catch (error) {
          console.error(error)
          await refreshFromServer()
          toast.error("Failed to delete attachment")
        }
      },
      addComment(input) {
        const parsed = commentSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Comment cannot be empty")
          return
        }

        set((state) => {
          let teamId = ""
          let followerIds: string[] = []
          let entityType: "workItem" | "document" = "workItem"
          let entityTitle = "item"
          const existingComments = state.comments.filter(
            (comment) =>
              comment.targetType === parsed.data.targetType &&
              comment.targetId === parsed.data.targetId
          )
          const parentComment = parsed.data.parentCommentId
            ? (existingComments.find(
                (comment) => comment.id === parsed.data.parentCommentId
              ) ?? null)
            : null

          if (parsed.data.parentCommentId && !parentComment) {
            toast.error("Reply target no longer exists")
            return state
          }

          if (parsed.data.targetType === "workItem") {
            const item = state.workItems.find(
              (entry) => entry.id === parsed.data.targetId
            )
            if (!item) {
              return state
            }

            teamId = item.teamId
            followerIds = [
              ...item.subscriberIds,
              item.creatorId,
              item.assigneeId ?? "",
              ...existingComments.map((comment) => comment.createdBy),
            ].filter(Boolean)
            entityType = "workItem"
            entityTitle = item.title
          } else {
            const document = state.documents.find(
              (entry) => entry.id === parsed.data.targetId
            )
            if (!document) {
              return state
            }

            teamId = document.teamId ?? ""
            followerIds = [
              document.createdBy,
              document.updatedBy,
              ...existingComments.map((comment) => comment.createdBy),
            ]
            entityType = "document"
            entityTitle = document.title
          }

          const role = effectiveRole(state, teamId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }

          const audienceUserIds = getTeamMemberIds(state, teamId)
          const mentionUserIds = createMentionIds(
            parsed.data.content,
            state.users,
            audienceUserIds
          )
          const comment = {
            id: createId("comment"),
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
            parentCommentId: parsed.data.parentCommentId ?? null,
            content: parsed.data.content.trim(),
            mentionUserIds,
            reactions: [],
            createdBy: state.currentUserId,
            createdAt: getNow(),
          }

          const notifications = [...state.notifications]
          const actor = state.users.find(
            (user) => user.id === state.currentUserId
          )
          const notifiedUserIds = new Set<string>()

          for (const mentionedUserId of mentionUserIds) {
            if (
              mentionedUserId === state.currentUserId ||
              notifiedUserIds.has(mentionedUserId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                mentionedUserId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
                entityType,
                parsed.data.targetId,
                "mention"
              )
            )
            notifiedUserIds.add(mentionedUserId)
          }

          const followerMessage = parsed.data.parentCommentId
            ? `${actor?.name ?? "Someone"} replied in ${entityTitle}`
            : `${actor?.name ?? "Someone"} commented on ${entityTitle}`

          for (const followerId of followerIds) {
            if (
              !followerId ||
              !audienceUserIds.includes(followerId) ||
              followerId === state.currentUserId ||
              notifiedUserIds.has(followerId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                followerId,
                state.currentUserId,
                followerMessage,
                entityType,
                parsed.data.targetId,
                "comment"
              )
            )
            notifiedUserIds.add(followerId)
          }

          return {
            ...state,
            comments: [...state.comments, comment],
            notifications,
            workItems: state.workItems.map((item) =>
              item.id === parsed.data.targetId
                ? { ...item, updatedAt: getNow() }
                : item
            ),
            documents: state.documents.map((document) =>
              document.id === parsed.data.targetId
                ? {
                    ...document,
                    updatedAt: getNow(),
                    updatedBy: state.currentUserId,
                  }
                : document
            ),
          }
        })

        syncInBackground(
          syncAddComment(
            useAppStore.getState().currentUserId,
            parsed.data.targetType,
            parsed.data.targetId,
            parsed.data.content,
            parsed.data.parentCommentId
          ),
          "Failed to post comment"
        )

        toast.success("Comment posted")
      },
      toggleCommentReaction(commentId, emoji) {
        set((state) => ({
          comments: state.comments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  reactions: toggleReactionUsers(
                    comment.reactions,
                    emoji,
                    state.currentUserId
                  ),
                }
              : comment
          ),
        }))

        syncInBackground(
          syncToggleCommentReaction(commentId, emoji),
          "Failed to update reaction"
        )
      },
      createWorkspaceChat(input) {
        const parsed = workspaceChatSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Chat details are invalid")
          return null
        }

        let conversationId: string | null = null
        let participantIdsForSync: string[] = []

        set((state) => {
          if (!canEditWorkspaceDocuments(state, parsed.data.workspaceId)) {
            toast.error("Your current role is read-only")
            return state
          }

          const workspaceMemberIds = new Set(
            getWorkspaceMemberIds(state, parsed.data.workspaceId)
          )
          const participantIds = [
            ...new Set([state.currentUserId, ...parsed.data.participantIds]),
          ].filter((userId) => workspaceMemberIds.has(userId))

          if (participantIds.length < 2) {
            toast.error("Select at least one other workspace member")
            return state
          }

          const now = getNow()
          conversationId = createId("conversation")
          participantIdsForSync = participantIds.filter(
            (userId) => userId !== state.currentUserId
          )

          return {
            ...state,
            conversations: [
              {
                id: conversationId,
                kind: "chat",
                scopeType: "workspace",
                scopeId: parsed.data.workspaceId,
                variant: participantIds.length === 2 ? "direct" : "group",
                title: buildWorkspaceChatTitle(
                  state,
                  state.currentUserId,
                  participantIds,
                  parsed.data.title
                ),
                description: parsed.data.description.trim(),
                participantIds,
                roomId: null,
                roomName: null,
                createdBy: state.currentUserId,
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
              },
              ...state.conversations,
            ],
          }
        })

        if (!conversationId) {
          return null
        }

        syncInBackground(
          syncCreateWorkspaceChat({
            workspaceId: parsed.data.workspaceId,
            participantIds: participantIdsForSync,
            title: parsed.data.title,
            description: parsed.data.description,
          }),
          "Failed to create chat"
        )

        toast.success("Chat created")
        return conversationId
      },
      ensureTeamChat(input) {
        const parsed = teamChatSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Team chat details are invalid")
          return null
        }

        let conversationId: string | null = null
        let shouldSync = false

        set((state) => {
          const team = state.teams.find(
            (entry) => entry.id === parsed.data.teamId
          )
          if (!team) {
            toast.error("Team not found")
            return state
          }

          if (!team.settings.features.chat) {
            toast.error("Chat is disabled for this team")
            return state
          }

          const existingConversation = state.conversations.find(
            (conversation) =>
              conversation.kind === "chat" &&
              conversation.scopeType === "team" &&
              conversation.scopeId === parsed.data.teamId &&
              conversation.variant === "team"
          )

          if (existingConversation) {
            conversationId = existingConversation.id
            return state
          }

          const role = effectiveRole(state, parsed.data.teamId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }

          const now = getNow()
          conversationId = createId("conversation")
          shouldSync = true

          return {
            ...state,
            conversations: [
              {
                id: conversationId,
                kind: "chat",
                scopeType: "team",
                scopeId: parsed.data.teamId,
                variant: "team",
                title: parsed.data.title.trim() || team.name,
                description:
                  parsed.data.description.trim() || team.settings.summary,
                participantIds: getTeamMemberIds(state, parsed.data.teamId),
                roomId: null,
                roomName: null,
                createdBy: state.currentUserId,
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
              },
              ...state.conversations,
            ],
          }
        })

        if (!conversationId) {
          return null
        }

        if (shouldSync) {
          syncInBackground(
            syncEnsureTeamChat(parsed.data),
            "Failed to create team chat"
          )
          toast.success("Team chat ready")
        }

        return conversationId
      },
      createChannel(input) {
        const silent = input.silent ?? false
        const parsed = channelSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Channel details are invalid")
          return null
        }

        let conversationId: string | null = null

        set((state) => {
          if (parsed.data.workspaceId) {
            const workspace = state.workspaces.find(
              (entry) => entry.id === parsed.data.workspaceId
            )
            if (!workspace) {
              toast.error("Workspace not found")
              return state
            }

            const existingConversation = state.conversations.find(
              (conversation) =>
                conversation.kind === "channel" &&
                conversation.scopeType === "workspace" &&
                conversation.scopeId === parsed.data.workspaceId
            )

            if (existingConversation) {
              conversationId = existingConversation.id
              return state
            }

            if (!canEditWorkspaceDocuments(state, parsed.data.workspaceId)) {
              toast.error("Your current role is read-only")
              return state
            }

            const now = getNow()
            conversationId = createId("conversation")

            return {
              ...state,
              conversations: [
                {
                  id: conversationId,
                  kind: "channel",
                  scopeType: "workspace",
                  scopeId: parsed.data.workspaceId,
                  variant: "team",
                  title: parsed.data.title.trim() || workspace.name,
                  description:
                    parsed.data.description.trim() ||
                    workspace.settings.description ||
                    "Shared updates and threaded decisions for the whole workspace.",
                  participantIds: getWorkspaceMemberIds(
                    state,
                    parsed.data.workspaceId
                  ),
                  roomId: null,
                  roomName: null,
                  createdBy: state.currentUserId,
                  createdAt: now,
                  updatedAt: now,
                  lastActivityAt: now,
                },
                ...state.conversations,
              ],
            }
          }

          const teamId = parsed.data.teamId
          if (!teamId) {
            return state
          }

          const team = state.teams.find((entry) => entry.id === teamId)
          if (!team) {
            toast.error("Team not found")
            return state
          }

          if (!team.settings.features.channels) {
            toast.error("Channel is disabled for this team")
            return state
          }

          const existingConversation = state.conversations.find(
            (conversation) =>
              conversation.kind === "channel" &&
              conversation.scopeType === "team" &&
              conversation.scopeId === teamId
          )

          if (existingConversation) {
            conversationId = existingConversation.id
            return state
          }

          const role = effectiveRole(state, teamId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }

          const now = getNow()
          conversationId = createId("conversation")

          return {
            ...state,
            conversations: [
              {
                id: conversationId,
                kind: "channel",
                scopeType: "team",
                scopeId: teamId,
                variant: "team",
                title: parsed.data.title.trim() || team.name,
                description:
                  parsed.data.description.trim() || team.settings.summary,
                participantIds: getTeamMemberIds(state, teamId),
                roomId: null,
                roomName: null,
                createdBy: state.currentUserId,
                createdAt: now,
                updatedAt: now,
                lastActivityAt: now,
              },
              ...state.conversations,
            ],
          }
        })

        if (!conversationId) {
          return null
        }

        syncInBackground(
          syncCreateChannel(parsed.data),
          "Failed to create channel"
        )

        if (!silent) {
          toast.success("Channel ready")
        }
        return conversationId
      },
      async startConversationCall(conversationId) {
        try {
          const result = await syncStartConversationCall(conversationId)

          if (!result?.call || !result.message || !result.joinHref) {
            throw new Error("Failed to start call")
          }

          const [message] = normalizeChatMessages([result.message])

          set((state) => {
            const conversation = state.conversations.find(
              (entry) => entry.id === conversationId
            )

            if (!conversation || conversation.kind !== "chat") {
              return state
            }

            return {
              ...state,
              calls: [
                ...state.calls.filter((entry) => entry.id !== result.call.id),
                result.call,
              ],
              chatMessages: [
                ...state.chatMessages.filter(
                  (entry) => entry.id !== message.id
                ),
                message,
              ],
              conversations: state.conversations.map((entry) =>
                entry.id === conversationId
                  ? {
                      ...entry,
                      updatedAt: message.createdAt,
                      lastActivityAt: message.createdAt,
                    }
                  : entry
              ),
            }
          })

          return result.joinHref
        } catch (error) {
          console.error(error)
          toast.error(
            error instanceof Error ? error.message : "Failed to start call"
          )
          return null
        }
      },
      sendChatMessage(input) {
        const parsed = chatMessageSchema.safeParse(input)
        if (!parsed.success) {
          return
        }

        set((state) => {
          const conversation = state.conversations.find(
            (entry) => entry.id === parsed.data.conversationId
          )

          if (!conversation || conversation.kind !== "chat") {
            return state
          }

          if (conversation.scopeType === "workspace") {
            if (!conversation.participantIds.includes(state.currentUserId)) {
              toast.error("You do not have access to this chat")
              return state
            }

            if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
              toast.error("Your current role is read-only")
              return state
            }
          } else {
            const role = effectiveRole(state, conversation.scopeId)
            if (role === "viewer" || role === "guest" || !role) {
              toast.error("Your current role is read-only")
              return state
            }
          }

          const now = getNow()
          const actor = state.users.find(
            (user) => user.id === state.currentUserId
          )
          const mentionUserIds = createMentionIds(
            parsed.data.content,
            state.users,
            getConversationAudienceUserIds(state, conversation)
          )
          const notifications = [...state.notifications]
          const notifiedUserIds = new Set<string>()

          for (const mentionedUserId of mentionUserIds) {
            if (
              mentionedUserId === state.currentUserId ||
              notifiedUserIds.has(mentionedUserId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                mentionedUserId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} mentioned you in ${conversation.title || "a chat"}`,
                "chat",
                conversation.id,
                "mention"
              )
            )

            notifiedUserIds.add(mentionedUserId)
          }

          return {
            ...state,
            notifications,
            chatMessages: [
              ...state.chatMessages,
              {
                id: createId("chat_message"),
                conversationId: conversation.id,
                kind: "text",
                content: parsed.data.content.trim(),
                callId: null,
                mentionUserIds,
                createdBy: state.currentUserId,
                createdAt: now,
              },
            ],
            conversations: state.conversations.map((entry) =>
              entry.id === conversation.id
                ? {
                    ...entry,
                    updatedAt: now,
                    lastActivityAt: now,
                  }
                : entry
            ),
          }
        })

        syncInBackground(
          syncSendChatMessage(parsed.data.conversationId, parsed.data.content),
          "Failed to send message"
        )
      },
      createChannelPost(input) {
        const parsed = channelPostSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Post details are invalid")
          return
        }

        set((state) => {
          const conversation = state.conversations.find(
            (entry) => entry.id === parsed.data.conversationId
          )

          if (!conversation || conversation.kind !== "channel") {
            return state
          }

          if (conversation.scopeType === "team") {
            const role = effectiveRole(state, conversation.scopeId)
            if (role === "viewer" || role === "guest" || !role) {
              toast.error("Your current role is read-only")
              return state
            }
          } else if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
            toast.error("Your current role is read-only")
            return state
          }

          const now = getNow()
          const postId = createId("channel_post")
          const actor = state.users.find(
            (user) => user.id === state.currentUserId
          )
          const mentionUserIds = createMentionIds(
            parsed.data.content,
            state.users,
            getConversationAudienceUserIds(state, conversation)
          )
          const notifications = [...state.notifications]
          const entityTitle = parsed.data.title.trim() || "a channel post"
          const notifiedUserIds = new Set<string>()

          for (const mentionedUserId of mentionUserIds) {
            if (
              mentionedUserId === state.currentUserId ||
              notifiedUserIds.has(mentionedUserId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                mentionedUserId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
                "channelPost",
                postId,
                "mention"
              )
            )

            notifiedUserIds.add(mentionedUserId)
          }

          return {
            ...state,
            channelPosts: [
              {
                id: postId,
                conversationId: conversation.id,
                title: parsed.data.title,
                content: parsed.data.content.trim(),
                reactions: [],
                createdBy: state.currentUserId,
                createdAt: now,
                updatedAt: now,
              },
              ...state.channelPosts,
            ],
            notifications,
            conversations: state.conversations.map((entry) =>
              entry.id === conversation.id
                ? {
                    ...entry,
                    updatedAt: now,
                    lastActivityAt: now,
                  }
                : entry
            ),
          }
        })

        syncInBackground(
          syncCreateChannelPost(parsed.data),
          "Failed to create post"
        )

        toast.success("Post published")
      },
      addChannelPostComment(input) {
        const parsed = channelPostCommentSchema.safeParse(input)
        if (!parsed.success) {
          return
        }

        set((state) => {
          const post = state.channelPosts.find(
            (entry) => entry.id === parsed.data.postId
          )
          if (!post) {
            return state
          }

          const conversation = state.conversations.find(
            (entry) => entry.id === post.conversationId
          )
          if (!conversation || conversation.kind !== "channel") {
            return state
          }

          if (conversation.scopeType === "team") {
            const role = effectiveRole(state, conversation.scopeId)
            if (role === "viewer" || role === "guest" || !role) {
              toast.error("Your current role is read-only")
              return state
            }
          } else if (!canEditWorkspaceDocuments(state, conversation.scopeId)) {
            toast.error("Your current role is read-only")
            return state
          }

          const now = getNow()
          const actor = state.users.find(
            (user) => user.id === state.currentUserId
          )
          const audienceUserIds = getConversationAudienceUserIds(
            state,
            conversation
          )
          const mentionUserIds = createMentionIds(
            parsed.data.content,
            state.users,
            audienceUserIds
          )
          const notifications = [...state.notifications]
          const notifiedUserIds = new Set<string>()
          const followerIds = [
            post.createdBy,
            ...state.channelPostComments
              .filter((entry) => entry.postId === post.id)
              .map((entry) => entry.createdBy),
          ]
          const entityTitle = post.title.trim() || "a channel post"

          for (const mentionedUserId of mentionUserIds) {
            if (
              mentionedUserId === state.currentUserId ||
              notifiedUserIds.has(mentionedUserId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                mentionedUserId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
                "channelPost",
                post.id,
                "mention"
              )
            )
            notifiedUserIds.add(mentionedUserId)
          }

          for (const followerId of followerIds) {
            if (
              !followerId ||
              !audienceUserIds.includes(followerId) ||
              followerId === state.currentUserId ||
              notifiedUserIds.has(followerId)
            ) {
              continue
            }

            notifications.unshift(
              createNotification(
                followerId,
                state.currentUserId,
                `${actor?.name ?? "Someone"} commented on ${entityTitle}`,
                "channelPost",
                post.id,
                "comment"
              )
            )
            notifiedUserIds.add(followerId)
          }

          return {
            ...state,
            channelPostComments: [
              ...state.channelPostComments,
              {
                id: createId("channel_comment"),
                postId: post.id,
                content: parsed.data.content.trim(),
                mentionUserIds,
                createdBy: state.currentUserId,
                createdAt: now,
              },
            ],
            notifications,
            channelPosts: state.channelPosts.map((entry) =>
              entry.id === post.id ? { ...entry, updatedAt: now } : entry
            ),
            conversations: state.conversations.map((entry) =>
              entry.id === conversation.id
                ? {
                    ...entry,
                    updatedAt: now,
                    lastActivityAt: now,
                  }
                : entry
            ),
          }
        })

        syncInBackground(
          syncAddChannelPostComment(parsed.data.postId, parsed.data.content),
          "Failed to post reply"
        )
      },
      deleteChannelPost(postId) {
        set((state) => {
          const post = state.channelPosts.find((entry) => entry.id === postId)

          if (!post) {
            return state
          }

          if (post.createdBy !== state.currentUserId) {
            toast.error("You can only delete your own posts")
            return state
          }

          const now = getNow()

          return {
            ...state,
            channelPosts: state.channelPosts.filter(
              (entry) => entry.id !== postId
            ),
            channelPostComments: state.channelPostComments.filter(
              (entry) => entry.postId !== postId
            ),
            notifications: state.notifications.filter(
              (entry) =>
                !(
                  entry.entityType === "channelPost" &&
                  entry.entityId === postId
                )
            ),
            conversations: state.conversations.map((entry) =>
              entry.id === post.conversationId
                ? {
                    ...entry,
                    updatedAt: now,
                    lastActivityAt: now,
                  }
                : entry
            ),
          }
        })

        syncInBackground(syncDeleteChannelPost(postId), "Failed to delete post")

        toast.success("Post deleted")
      },
      toggleChannelPostReaction(postId, emoji) {
        const nextEmoji = emoji.trim()

        if (!nextEmoji) {
          return
        }

        set((state) => {
          const post = state.channelPosts.find((entry) => entry.id === postId)

          if (!post) {
            return state
          }

          const conversation = state.conversations.find(
            (entry) => entry.id === post.conversationId
          )

          if (!conversation || conversation.kind !== "channel") {
            return state
          }

          if (conversation.scopeType === "team") {
            const role = effectiveRole(state, conversation.scopeId)
            if (role === "viewer" || role === "guest" || !role) {
              toast.error("Your current role is read-only")
              return state
            }
          }

          return {
            ...state,
            channelPosts: state.channelPosts.map((entry) =>
              entry.id === postId
                ? {
                    ...entry,
                    reactions: toggleReactionUsers(
                      entry.reactions,
                      nextEmoji,
                      state.currentUserId
                    ),
                  }
                : entry
            ),
          }
        })

        syncInBackground(
          syncToggleChannelPostReaction(postId, nextEmoji),
          "Failed to update reaction"
        )
      },
      createInvite(input) {
        const parsed = inviteSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Invite is invalid")
          return
        }

        set((state) => {
          const teams = state.teams.filter((entry) =>
            parsed.data.teamIds.includes(entry.id)
          )
          if (teams.length === 0) {
            return state
          }

          const canInviteAll = teams.every((team) => {
            const role = effectiveRole(state, team.id)
            return role === "admin" || role === "member"
          })

          if (!canInviteAll) {
            toast.error("Only admins and members can invite")
            return state
          }

          const invites = teams.map((team) => ({
            id: createId("invite"),
            workspaceId: team.workspaceId,
            teamId: team.id,
            email: parsed.data.email,
            role: parsed.data.role,
            token: createId("token"),
            joinCode: team.settings.joinCode,
            invitedBy: state.currentUserId,
            expiresAt: addDays(new Date(), 7).toISOString(),
            acceptedAt: null,
            declinedAt: null,
          }))

          return {
            ...state,
            invites: [...invites, ...state.invites],
          }
        })

        syncInBackground(
          syncCreateInvite(
            useAppStore.getState().currentUserId,
            parsed.data.teamIds,
            parsed.data.email,
            parsed.data.role
          ),
          "Failed to create invite"
        )

        toast.success(
          parsed.data.teamIds.length === 1
            ? "Invite created"
            : `Invites created for ${parsed.data.teamIds.length} teams`
        )
      },
      async joinTeamByCode(code) {
        const parsed = joinCodeSchema.safeParse({ code })
        if (!parsed.success) {
          toast.error("Join code is invalid")
          return false
        }

        try {
          await syncJoinTeamByCode(
            useAppStore.getState().currentUserId,
            parsed.data.code
          )
          await refreshFromServer()
          toast.success("Joined team")
          return true
        } catch (error) {
          console.error(error)
          toast.error(
            error instanceof Error ? error.message : "Failed to join team"
          )
          return false
        }
      },
      createProject(input) {
        const parsed = projectSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Project input is invalid")
          return
        }

        const validationMessage = getProjectCreationValidationMessage(
          get(),
          parsed.data
        )

        if (validationMessage) {
          toast.error(validationMessage)
          return
        }

        set((state) => {
          const settingsTeamId =
            parsed.data.settingsTeamId ??
            (parsed.data.scopeType === "team" ? parsed.data.scopeId : null)
          const workflowSettings = getTeamWorkflowSettings(
            state,
            settingsTeamId
          )
          const templateDefaults =
            workflowSettings.templateDefaults[parsed.data.templateType]
          const project = {
            id: createId("project"),
            scopeType: parsed.data.scopeType,
            scopeId: parsed.data.scopeId,
            templateType: parsed.data.templateType,
            name: parsed.data.name,
            summary: parsed.data.summary,
            description: `${parsed.data.name} was created from the ${parsed.data.templateType} template with a ${templateMeta[parsed.data.templateType].label.toLowerCase()} setup.`,
            leadId: state.currentUserId,
            memberIds: [state.currentUserId],
            health: "no-update" as const,
            priority: parsed.data.priority,
            status: "planning" as const,
            startDate: getNow(),
            targetDate: addDays(
              new Date(),
              templateDefaults.targetWindowDays
            ).toISOString(),
            createdAt: getNow(),
            updatedAt: getNow(),
          }

          return {
            ...state,
            projects: [project, ...state.projects],
          }
        })

        syncInBackground(
          syncCreateProject(
            useAppStore.getState().currentUserId,
            parsed.data.scopeType,
            parsed.data.scopeId,
            parsed.data.templateType,
            parsed.data.name,
            parsed.data.summary,
            parsed.data.priority,
            parsed.data.settingsTeamId
          ),
          "Failed to create project"
        )

        toast.success("Project created")
      },
      updateTeamWorkflowSettings(teamId, workflow) {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  settings: {
                    ...team.settings,
                    workflow,
                  },
                }
              : team
          ),
        }))

        syncInBackground(
          syncUpdateTeamWorkflowSettings(teamId, workflow),
          "Failed to update team workflow settings"
        )

        toast.success("Team workflow updated")
      },
      createDocument(input) {
        const parsed = documentSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Document input is invalid")
          return
        }
        const documentInput = parsed.data
        const validationMessage = getDocumentCreationValidationMessage(
          get(),
          documentInput
        )

        if (validationMessage) {
          toast.error(validationMessage)
          return
        }

        set((state) => {
          if (documentInput.kind === "team-document") {
            const workspaceId =
              state.teams.find((team) => team.id === documentInput.teamId)
                ?.workspaceId ?? ""
            const role = effectiveRole(state, documentInput.teamId)
            if (role === "viewer" || role === "guest" || !role) {
              toast.error("Your current role is read-only")
              return state
            }
            const document = {
              id: createId("document"),
              kind: documentInput.kind,
              workspaceId,
              teamId: documentInput.teamId,
              title: documentInput.title,
              content: `<h1>${documentInput.title}</h1><p>New team document.</p>`,
              linkedProjectIds: [],
              linkedWorkItemIds: [],
              createdBy: state.currentUserId,
              updatedBy: state.currentUserId,
              createdAt: getNow(),
              updatedAt: getNow(),
            }

            return {
              ...state,
              documents: [document, ...state.documents],
            }
          }

          if (!canEditWorkspaceDocuments(state, documentInput.workspaceId)) {
            toast.error("Your current role is read-only")
            return state
          }

          const contentTemplate =
            documentInput.kind === "private-document"
              ? "New private document."
              : "New workspace document."

          const document = {
            id: createId("document"),
            kind: documentInput.kind,
            workspaceId: documentInput.workspaceId,
            teamId: null,
            title: documentInput.title,
            content: `<h1>${documentInput.title}</h1><p>${contentTemplate}</p>`,
            linkedProjectIds: [],
            linkedWorkItemIds: [],
            createdBy: state.currentUserId,
            updatedBy: state.currentUserId,
            createdAt: getNow(),
            updatedAt: getNow(),
          }

          return {
            ...state,
            documents: [document, ...state.documents],
          }
        })

        syncInBackground(
          syncCreateDocument(
            useAppStore.getState().currentUserId,
            documentInput
          ),
          "Failed to create document"
        )

        toast.success("Document created")
      },
      createWorkItem(input) {
        const parsed = workItemSchema.safeParse(input)
        if (!parsed.success) {
          toast.error("Work item input is invalid")
          return null
        }

        const validationMessage = getWorkItemValidationMessage(
          get(),
          parsed.data
        )

        if (validationMessage) {
          toast.error(validationMessage)
          return null
        }

        let createdItemId: string | null = null

        set((state) => {
          const role = effectiveRole(state, parsed.data.teamId)
          if (role === "viewer" || role === "guest" || !role) {
            toast.error("Your current role is read-only")
            return state
          }

          const parent = parsed.data.parentId
            ? (state.workItems.find(
                (item) => item.id === parsed.data.parentId
              ) ?? null)
            : null
          const teamItems = state.workItems.filter(
            (item) => item.teamId === parsed.data.teamId
          )
          const prefix = toKeyPrefix(parsed.data.teamId)
          const nextNumber = 1 + teamItems.length + 100
          const descriptionDocId = createId("doc")
          const resolvedPrimaryProjectId =
            parsed.data.primaryProjectId ?? parent?.primaryProjectId ?? null

          const descriptionDoc = {
            id: descriptionDocId,
            kind: "item-description" as const,
            workspaceId:
              state.teams.find((team) => team.id === parsed.data.teamId)
                ?.workspaceId ?? "",
            teamId: parsed.data.teamId,
            title: `${parsed.data.title} description`,
            content: `<p>Add a fuller description for ${parsed.data.title}.</p>`,
            linkedProjectIds: resolvedPrimaryProjectId
              ? [resolvedPrimaryProjectId]
              : [],
            linkedWorkItemIds: [],
            createdBy: state.currentUserId,
            updatedBy: state.currentUserId,
            createdAt: getNow(),
            updatedAt: getNow(),
          }

          const workItem = {
            id: createId("item"),
            key: `${prefix}-${nextNumber}`,
            teamId: parsed.data.teamId,
            type: parsed.data.type,
            title: parsed.data.title,
            descriptionDocId,
            status: "backlog" as const,
            priority: parsed.data.priority,
            assigneeId: parsed.data.assigneeId,
            creatorId: state.currentUserId,
            parentId: parent?.id ?? null,
            primaryProjectId: resolvedPrimaryProjectId,
            linkedProjectIds: [],
            linkedDocumentIds: [],
            labelIds: [],
            milestoneId: null,
            startDate: getNow(),
            dueDate: addDays(new Date(), 7).toISOString(),
            targetDate: addDays(new Date(), 10).toISOString(),
            subscriberIds: [state.currentUserId],
            createdAt: getNow(),
            updatedAt: getNow(),
          }

          createdItemId = workItem.id

          return {
            ...state,
            documents: [descriptionDoc, ...state.documents],
            workItems: [workItem, ...state.workItems],
          }
        })

        if (!createdItemId) {
          return null
        }

        syncInBackground(
          syncCreateWorkItem(
            useAppStore.getState().currentUserId,
            parsed.data.teamId,
            parsed.data.type,
            parsed.data.title,
            parsed.data.parentId ?? null,
            parsed.data.primaryProjectId,
            parsed.data.assigneeId,
            parsed.data.priority
          ),
          "Failed to create work item"
        )

        toast.success("Work item created")
        return createdItemId
      },
    }),
    {
      name: "linear-multi-work-store",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage
      ),
      version: 3,
      partialize: (state) => ({
        ui: state.ui,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          ...((persistedState as Partial<AppStore> | undefined)?.ui ?? {}),
        },
      }),
    }
  )
)
