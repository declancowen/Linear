import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

function getConvexServerClient() {
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  return new ConvexHttpClient(convexUrl)
}

export async function ensureConvexUserFromAuth(user: AuthenticatedAppUser) {
  return getConvexServerClient().mutation(api.app.ensureUserFromAuth, {
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    workosUserId: user.workosUserId,
  })
}

export async function getAuthContextServer(email: string) {
  return getConvexServerClient().query(api.app.getAuthContext, { email })
}

export async function getSnapshotServer(email?: string) {
  return getConvexServerClient().query(api.app.getSnapshot, {
    email,
  })
}

export async function getInviteByTokenServer(token: string) {
  return getConvexServerClient().query(api.app.getInviteByToken, { token })
}

export async function createWorkspaceServer(input: {
  currentUserId: string
  name: string
  logoUrl: string
  accent: string
  description: string
}) {
  return getConvexServerClient().mutation(api.app.createWorkspace, input)
}

export async function lookupTeamByJoinCodeServer(code: string) {
  return getConvexServerClient().query(api.app.lookupTeamByJoinCode, { code })
}

export async function listWorkspacesForSyncServer() {
  return getConvexServerClient().query(api.app.listWorkspacesForSync, {})
}

export async function listPendingNotificationDigestsServer() {
  return getConvexServerClient().query(
    api.app.listPendingNotificationDigests,
    {}
  )
}

export async function createInviteServer(input: {
  currentUserId: string
  teamId: string
  email: string
  role: "admin" | "member" | "viewer" | "guest"
}) {
  return getConvexServerClient().mutation(api.app.createInvite, input)
}

export async function acceptInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(api.app.acceptInvite, input)
}

export async function declineInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(api.app.declineInvite, input)
}

export async function markNotificationsEmailedServer(
  notificationIds: string[]
) {
  return getConvexServerClient().mutation(api.app.markNotificationsEmailed, {
    notificationIds,
  })
}

export async function markNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return getConvexServerClient().mutation(api.app.markNotificationRead, input)
}

export async function toggleNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return getConvexServerClient().mutation(api.app.toggleNotificationRead, input)
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
  return getConvexServerClient().mutation(api.app.updateWorkspaceBranding, {
    ...input,
    logoImageStorageId: input.logoImageStorageId as Id<"_storage"> | undefined,
  })
}

export async function setWorkspaceWorkosOrganizationServer(input: {
  workspaceId: string
  workosOrganizationId: string
}) {
  return getConvexServerClient().mutation(
    api.app.setWorkspaceWorkosOrganization,
    input
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
  }
}) {
  return getConvexServerClient().mutation(api.app.updateCurrentUserProfile, {
    ...input,
    avatarImageStorageId: input.avatarImageStorageId as
      | Id<"_storage">
      | undefined,
  })
}

export async function ensureWorkspaceScaffoldingServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.ensureWorkspaceScaffolding,
      input
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
    input
  )
}

export async function joinTeamByCodeServer(input: {
  currentUserId: string
  code: string
}) {
  return getConvexServerClient().mutation(api.app.joinTeamByCode, input)
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
  return getConvexServerClient().mutation(api.app.updateWorkItem, input)
}

export async function deleteWorkItemServer(input: {
  currentUserId: string
  itemId: string
}) {
  return getConvexServerClient().mutation(api.app.deleteWorkItem, input)
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
  return getConvexServerClient().mutation(api.app.updateViewConfig, input)
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
    input
  )
}

export async function toggleViewHiddenValueServer(input: {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}) {
  return getConvexServerClient().mutation(api.app.toggleViewHiddenValue, input)
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
  return getConvexServerClient().mutation(api.app.toggleViewFilterValue, input)
}

export async function clearViewFiltersServer(input: {
  currentUserId: string
  viewId: string
}) {
  return getConvexServerClient().mutation(api.app.clearViewFilters, input)
}

export async function shiftTimelineItemServer(input: {
  currentUserId: string
  itemId: string
  nextStartDate: string
}) {
  return getConvexServerClient().mutation(api.app.shiftTimelineItem, input)
}

export async function updateDocumentContentServer(input: {
  currentUserId: string
  documentId: string
  content: string
}) {
  return getConvexServerClient().mutation(api.app.updateDocumentContent, input)
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
  return getConvexServerClient().mutation(api.app.renameDocument, input)
}

export async function updateItemDescriptionServer(input: {
  currentUserId: string
  itemId: string
  content: string
}) {
  return getConvexServerClient().mutation(api.app.updateItemDescription, input)
}

export async function addCommentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  parentCommentId?: string | null
  content: string
}) {
  return getConvexServerClient().mutation(api.app.addComment, input)
}

export async function toggleCommentReactionServer(input: {
  currentUserId: string
  commentId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(api.app.toggleCommentReaction, input)
}

export async function generateAttachmentUploadUrlServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
}) {
  return getConvexServerClient().mutation(
    api.app.generateAttachmentUploadUrl,
    input
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
  return getConvexServerClient().mutation(api.app.createAttachment, {
    ...input,
    storageId: input.storageId as Id<"_storage">,
  })
}

export async function deleteAttachmentServer(input: {
  currentUserId: string
  attachmentId: string
}) {
  return getConvexServerClient().mutation(api.app.deleteAttachment, input)
}

export async function createProjectServer(input: {
  currentUserId: string
  scopeType: "team" | "workspace"
  scopeId: string
  templateType: "software-delivery" | "bug-tracking" | "project-management"
  name: string
  summary: string
  priority: "none" | "low" | "medium" | "high" | "urgent"
  settingsTeamId?: string | null
}) {
  return getConvexServerClient().mutation(api.app.createProject, input)
}

export async function updateTeamWorkflowSettingsServer(input: {
  currentUserId: string
  teamId: string
  workflow: {
    statusOrder: Array<
      "backlog" | "todo" | "in-progress" | "done" | "cancelled" | "duplicate"
    >
    templateDefaults: {
      "software-delivery": {
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
      "bug-tracking": {
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
      "project-management": {
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
    }
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateTeamWorkflowSettings,
    input
  )
}

export async function updateTeamDetailsServer(input: {
  currentUserId: string
  teamId: string
  name: string
  icon: string
  summary: string
  joinCode?: string
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  return getConvexServerClient().mutation(api.app.updateTeamDetails, input)
}

export async function createTeamServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  icon: string
  summary: string
  joinCode: string
  experience:
    | "software-development"
    | "issue-analysis"
    | "project-management"
    | "community"
  features: {
    issues: boolean
    projects: boolean
    views: boolean
    docs: boolean
    chat: boolean
    channels: boolean
  }
}) {
  return getConvexServerClient().mutation(api.app.createTeam, input)
}

export async function regenerateTeamJoinCodeServer(input: {
  currentUserId: string
  teamId: string
  joinCode: string
}) {
  return getConvexServerClient().mutation(api.app.regenerateTeamJoinCode, input)
}

export async function createWorkspaceChatServer(input: {
  currentUserId: string
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(api.app.createWorkspaceChat, input)
}

export async function ensureTeamChatServer(input: {
  currentUserId: string
  teamId: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(api.app.ensureTeamChat, input)
}

export async function createChannelServer(input: {
  currentUserId: string
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(api.app.createChannel, input)
}

export async function sendChatMessageServer(input: {
  currentUserId: string
  conversationId: string
  content: string
}) {
  return getConvexServerClient().mutation(api.app.sendChatMessage, input)
}

export async function createChannelPostServer(input: {
  currentUserId: string
  conversationId: string
  title: string
  content: string
}) {
  return getConvexServerClient().mutation(api.app.createChannelPost, input)
}

export async function addChannelPostCommentServer(input: {
  currentUserId: string
  postId: string
  content: string
}) {
  return getConvexServerClient().mutation(api.app.addChannelPostComment, input)
}

export async function deleteChannelPostServer(input: {
  currentUserId: string
  postId: string
}) {
  return getConvexServerClient().mutation(api.app.deleteChannelPost, input)
}

export async function toggleChannelPostReactionServer(input: {
  currentUserId: string
  postId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleChannelPostReaction,
    input
  )
}

export async function createDocumentServer(input: {
  currentUserId: string
  kind: "team-document" | "workspace-document" | "private-document"
  teamId?: string
  workspaceId?: string
  title: string
}) {
  return getConvexServerClient().mutation(api.app.createDocument, input)
}

export async function createWorkItemServer(input: {
  currentUserId: string
  teamId: string
  type:
    | "epic"
    | "feature"
    | "requirement"
    | "task"
    | "bug"
    | "sub-task"
    | "qa-task"
    | "test-case"
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  priority: "none" | "low" | "medium" | "high" | "urgent"
}) {
  return getConvexServerClient().mutation(api.app.createWorkItem, input)
}
