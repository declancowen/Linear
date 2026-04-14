import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  Priority,
  TeamExperienceType,
  TeamWorkflowSettings,
  TemplateType,
  WorkItemType,
} from "@/lib/domain/types"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
let convexServerClient: ConvexHttpClient | null = null

function getServerToken() {
  const serverToken = process.env.CONVEX_SERVER_TOKEN?.trim()

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  return serverToken
}

function withServerToken<T extends Record<string, unknown>>(input: T) {
  return {
    ...input,
    serverToken: getServerToken(),
  }
}

function getConvexServerClient() {
  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  if (!convexServerClient) {
    convexServerClient = new ConvexHttpClient(convexUrl)
  }

  return convexServerClient
}

export async function ensureConvexUserFromAuth(user: AuthenticatedAppUser) {
  return getConvexServerClient().mutation(api.app.ensureUserFromAuth, {
    serverToken: getServerToken(),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    workosUserId: user.workosUserId,
  })
}

export async function ensureConvexUserReadyServer(
  user: AuthenticatedAppUser
) {
  const authContext = await getAuthContextServer({
    workosUserId: user.workosUserId,
    email: user.email,
  })

  if (authContext?.currentUser) {
    return authContext
  }

  await ensureConvexUserFromAuth(user)

  return getAuthContextServer({
    workosUserId: user.workosUserId,
    email: user.email,
  })
}

export async function getAuthContextServer(input: {
  workosUserId: string
  email?: string
}) {
  return getConvexServerClient().query(
    api.app.getAuthContext,
    withServerToken(input)
  )
}

export async function getSnapshotServer(input?: {
  workosUserId?: string
  email?: string
}) {
  return getConvexServerClient().query(
    api.app.getSnapshot,
    withServerToken(input ?? {})
  )
}

export async function getSnapshotVersionServer(input?: {
  workosUserId?: string
  email?: string
}) {
  return getConvexServerClient().query(
    api.app.getSnapshotVersion,
    withServerToken(input ?? {})
  )
}

export async function getInviteByTokenServer(token: string) {
  return getConvexServerClient().query(
    api.app.getInviteByToken,
    withServerToken({ token })
  )
}

export async function createWorkspaceServer(input: {
  currentUserId: string
  name: string
  logoUrl: string
  accent: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkspace,
    withServerToken(input)
  )
}

export async function lookupTeamByJoinCodeServer(code: string) {
  return getConvexServerClient().query(
    api.app.lookupTeamByJoinCode,
    withServerToken({ code })
  )
}

export async function listWorkspacesForSyncServer() {
  return getConvexServerClient().query(
    api.app.listWorkspacesForSync,
    withServerToken({})
  )
}

export async function listPendingNotificationDigestsServer() {
  return getConvexServerClient().query(
    api.app.listPendingNotificationDigests,
    withServerToken({})
  )
}

export async function createInviteServer(input: {
  currentUserId: string
  teamId: string
  email: string
  role: "admin" | "member" | "viewer" | "guest"
}) {
  return getConvexServerClient().mutation(
    api.app.createInvite,
    withServerToken(input)
  )
}

export async function acceptInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(
    api.app.acceptInvite,
    withServerToken(input)
  )
}

export async function declineInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(
    api.app.declineInvite,
    withServerToken(input)
  )
}

export async function markNotificationsEmailedServer(
  notificationIds: string[]
) {
  return getConvexServerClient().mutation(
    api.app.markNotificationsEmailed,
    withServerToken({
      notificationIds,
    })
  )
}

export async function markNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return getConvexServerClient().mutation(
    api.app.markNotificationRead,
    withServerToken(input)
  )
}

export async function toggleNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleNotificationRead,
    withServerToken(input)
  )
}

export async function updateWorkspaceBrandingServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  logoUrl: string
  logoImageStorageId?: string
  clearLogoImage?: boolean
  accent: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateWorkspaceBranding,
    withServerToken({
      ...input,
      logoImageStorageId: input.logoImageStorageId as
        | Id<"_storage">
        | undefined,
    })
  )
}

export async function setWorkspaceWorkosOrganizationServer(input: {
  workspaceId: string
  workosOrganizationId: string
}) {
  return getConvexServerClient().mutation(
    api.app.setWorkspaceWorkosOrganization,
    withServerToken(input)
  )
}

export async function updateCurrentUserProfileServer(input: {
  currentUserId: string
  userId: string
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
}) {
  return getConvexServerClient().mutation(
    api.app.updateCurrentUserProfile,
    withServerToken({
      ...input,
      avatarImageStorageId: input.avatarImageStorageId as
        | Id<"_storage">
        | undefined,
    })
  )
}

export async function ensureWorkspaceScaffoldingServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.ensureWorkspaceScaffolding,
      withServerToken(input)
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(
        "Could not find public function for 'app:ensureWorkspaceScaffolding'"
      )
    ) {
      return null
    }

    throw error
  }
}

export async function generateSettingsImageUploadUrlServer(input: {
  currentUserId: string
  kind: "user-avatar" | "workspace-logo"
  workspaceId?: string
}) {
  return getConvexServerClient().mutation(
    api.app.generateSettingsImageUploadUrl,
    withServerToken(input)
  )
}

export async function joinTeamByCodeServer(input: {
  currentUserId: string
  code: string
}) {
  return getConvexServerClient().mutation(
    api.app.joinTeamByCode,
    withServerToken(input)
  )
}

export async function updateWorkItemServer(input: {
  currentUserId: string
  itemId: string
  patch: {
    status?:
      | "backlog"
      | "todo"
      | "in-progress"
      | "done"
      | "cancelled"
      | "duplicate"
    priority?: "none" | "low" | "medium" | "high" | "urgent"
    assigneeId?: string | null
    parentId?: string | null
    primaryProjectId?: string | null
    startDate?: string | null
    dueDate?: string | null
    targetDate?: string | null
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateWorkItem,
    withServerToken(input)
  )
}

export async function deleteWorkItemServer(input: {
  currentUserId: string
  itemId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteWorkItem,
    withServerToken(input)
  )
}

export async function updateViewConfigServer(input: {
  currentUserId: string
  viewId: string
  layout?: "list" | "board" | "timeline"
  grouping?: "project" | "status" | "assignee" | "priority" | "team" | "type"
  subGrouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "team"
    | "type"
    | null
  ordering?:
    | "priority"
    | "updatedAt"
    | "createdAt"
    | "dueDate"
    | "targetDate"
    | "title"
  showCompleted?: boolean
}) {
  return getConvexServerClient().mutation(
    api.app.updateViewConfig,
    withServerToken(input)
  )
}

export async function toggleViewDisplayPropertyServer(input: {
  currentUserId: string
  viewId: string
  property:
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewDisplayProperty,
    withServerToken(input)
  )
}

export async function toggleViewHiddenValueServer(input: {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewHiddenValue,
    withServerToken(input)
  )
}

export async function toggleViewFilterValueServer(input: {
  currentUserId: string
  viewId: string
  key:
    | "status"
    | "priority"
    | "assigneeIds"
    | "projectIds"
    | "itemTypes"
    | "labelIds"
  value: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewFilterValue,
    withServerToken(input)
  )
}

export async function clearViewFiltersServer(input: {
  currentUserId: string
  viewId: string
}) {
  return getConvexServerClient().mutation(
    api.app.clearViewFilters,
    withServerToken(input)
  )
}

export async function shiftTimelineItemServer(input: {
  currentUserId: string
  itemId: string
  nextStartDate: string
}) {
  return getConvexServerClient().mutation(
    api.app.shiftTimelineItem,
    withServerToken(input)
  )
}

export async function updateDocumentContentServer(input: {
  currentUserId: string
  documentId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateDocumentContent,
    withServerToken(input)
  )
}

export async function updateDocumentServer(input: {
  currentUserId: string
  documentId: string
  title?: string
  content?: string
}) {
  if (input.title !== undefined) {
    await renameDocumentServer({
      currentUserId: input.currentUserId,
      documentId: input.documentId,
      title: input.title,
    })
  }

  if (input.content !== undefined) {
    await updateDocumentContentServer({
      currentUserId: input.currentUserId,
      documentId: input.documentId,
      content: input.content,
    })
  }

  return null
}

export async function renameDocumentServer(input: {
  currentUserId: string
  documentId: string
  title: string
}) {
  return getConvexServerClient().mutation(
    api.app.renameDocument,
    withServerToken(input)
  )
}

export async function updateItemDescriptionServer(input: {
  currentUserId: string
  itemId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateItemDescription,
    withServerToken(input)
  )
}

export async function addCommentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  parentCommentId?: string | null
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.addComment,
    withServerToken(input)
  )
}

export async function toggleCommentReactionServer(input: {
  currentUserId: string
  commentId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleCommentReaction,
    withServerToken(input)
  )
}

export async function generateAttachmentUploadUrlServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
}) {
  return getConvexServerClient().mutation(
    api.app.generateAttachmentUploadUrl,
    withServerToken(input)
  )
}

export async function createAttachmentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
}) {
  return getConvexServerClient().mutation(
    api.app.createAttachment,
    withServerToken({
      ...input,
      storageId: input.storageId as Id<"_storage">,
    })
  )
}

export async function deleteAttachmentServer(input: {
  currentUserId: string
  attachmentId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteAttachment,
    withServerToken(input)
  )
}

export async function createProjectServer(input: {
  currentUserId: string
  scopeType: "team" | "workspace"
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  priority: Priority
  settingsTeamId?: string | null
}) {
  return getConvexServerClient().mutation(
    api.app.createProject,
    withServerToken(input)
  )
}

export async function updateTeamWorkflowSettingsServer(input: {
  currentUserId: string
  teamId: string
  workflow: TeamWorkflowSettings
}) {
  return getConvexServerClient().mutation(
    api.app.updateTeamWorkflowSettings,
    withServerToken(input)
  )
}

export async function updateTeamDetailsServer(input: {
  currentUserId: string
  teamId: string
  name: string
  icon: string
  summary: string
  joinCode?: string
  experience: TeamExperienceType
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateTeamDetails,
    withServerToken(input)
  )
}

export async function createTeamServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  icon: string
  summary: string
  joinCode: string
  experience: TeamExperienceType
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  return getConvexServerClient().mutation(
    api.app.createTeam,
    withServerToken(input)
  )
}

export async function regenerateTeamJoinCodeServer(input: {
  currentUserId: string
  teamId: string
  joinCode: string
}) {
  return getConvexServerClient().mutation(
    api.app.regenerateTeamJoinCode,
    withServerToken(input)
  )
}

export async function createWorkspaceChatServer(input: {
  currentUserId: string
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkspaceChat,
    withServerToken(input)
  )
}

export async function ensureTeamChatServer(input: {
  currentUserId: string
  teamId: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.ensureTeamChat,
    withServerToken(input)
  )
}

export async function createChannelServer(input: {
  currentUserId: string
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createChannel,
    withServerToken(input)
  )
}

export async function sendChatMessageServer(input: {
  currentUserId: string
  conversationId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.sendChatMessage,
    withServerToken(input)
  )
}

export async function createChannelPostServer(input: {
  currentUserId: string
  conversationId: string
  title: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.createChannelPost,
    withServerToken(input)
  )
}

export async function addChannelPostCommentServer(input: {
  currentUserId: string
  postId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.addChannelPostComment,
    withServerToken(input)
  )
}

export async function deleteChannelPostServer(input: {
  currentUserId: string
  postId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteChannelPost,
    withServerToken(input)
  )
}

export async function toggleChannelPostReactionServer(input: {
  currentUserId: string
  postId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleChannelPostReaction,
    withServerToken(input)
  )
}

export async function createDocumentServer(input: {
  currentUserId: string
  kind: "team-document" | "workspace-document" | "private-document"
  teamId?: string
  workspaceId?: string
  title: string
}) {
  return getConvexServerClient().mutation(
    api.app.createDocument,
    withServerToken(input)
  )
}

export async function createWorkItemServer(input: {
  currentUserId: string
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  priority: Priority
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkItem,
    withServerToken(input)
  )
}

export async function startChatCallServer(input: {
  currentUserId: string
  conversationId: string
  roomKey: string
  roomDescription: string
}) {
  return getConvexServerClient().mutation(
    api.app.startChatCall,
    withServerToken(input)
  )
}

export async function markCallJoinedServer(input: {
  currentUserId: string
  callId: string
}) {
  return getConvexServerClient().mutation(
    api.app.markCallJoined,
    withServerToken(input)
  )
}

export async function setCallRoomServer(input: {
  currentUserId: string
  callId: string
  roomId: string
  roomName: string
}) {
  return getConvexServerClient().mutation(
    api.app.setCallRoom,
    withServerToken(input)
  )
}

export async function backfillWorkItemModelServer() {
  return getConvexServerClient().mutation(
    api.app.backfillWorkItemModel,
    withServerToken({})
  )
}

export async function setConversationRoomServer(input: {
  currentUserId: string
  conversationId: string
  roomId: string
  roomName: string
}) {
  return getConvexServerClient().mutation(
    api.app.setConversationRoom,
    withServerToken(input)
  )
}
