"use client"

import type { StoreApi } from "zustand"

import type {
  AttachmentTargetType,
  AppData,
  AppSnapshot,
  CommentTargetType,
  Conversation,
  DisplayProperty,
  GroupField,
  Label,
  OrderingField,
  Priority,
  ProjectPresentationConfig,
  ProjectStatus,
  Role,
  ScopeType,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  UserStatus,
  WorkItem,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"

export type WorkItemPatch = {
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

export type CreateProjectInput = {
  scopeType: ScopeType
  scopeId: string
  templateType: "software-delivery" | "bug-tracking" | "project-management"
  name: string
  summary: string
  priority: Priority
  settingsTeamId?: string | null
  presentation?: ProjectPresentationConfig
}

export type ProjectPatch = {
  status?: ProjectStatus
  priority?: Priority
}

export type CreateWorkItemInput = {
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  status?: WorkStatus
  priority: Priority
  labelIds?: string[]
}

export type CreateDocumentInput =
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

export type CreateInviteInput = {
  teamIds: string[]
  email: string
  role: Role
}

export type UpdateWorkspaceBrandingInput = {
  name: string
  logoUrl: string
  logoImageStorageId?: string
  clearLogoImage?: boolean
  accent: string
  description: string
}

export type TeamDetailsInput = {
  name: string
  icon: string
  summary: string
  experience: AppData["teams"][number]["settings"]["experience"]
  features: AppData["teams"][number]["settings"]["features"]
}

export type CreateTeamInput = TeamDetailsInput
export type UpdateTeamDetailsInput = TeamDetailsInput

export type TeamMembershipRoleInput = {
  role: Role
}

export type UpdateProfileInput = {
  name: string
  title: string
  avatarUrl: string
  avatarImageStorageId?: string
  clearAvatarImage?: boolean
  clearStatus?: boolean
  status?: UserStatus
  statusMessage?: string
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: "light" | "dark" | "system"
  }
}

export type UpdateUserStatusInput = {
  status: UserStatus
  statusMessage: string
}

export type AddCommentInput = {
  targetType: CommentTargetType
  targetId: string
  parentCommentId?: string | null
  content: string
}

export type CreateWorkspaceChatInput = {
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}

export type EnsureTeamChatInput = {
  teamId: string
  title: string
  description: string
}

export type CreateChannelInput =
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

export type SendChatMessageInput = {
  conversationId: string
  content: string
}

export type CreateChannelPostInput = {
  conversationId: string
  title: string
  content: string
}

export type AddChannelPostCommentInput = {
  postId: string
  content: string
}

export type AppStore = AppData & {
  replaceDomainData: (data: AppSnapshot) => void
  setActiveTeam: (teamId: string) => void
  setSelectedView: (route: string, viewId: string) => void
  setActiveInboxNotification: (notificationId: string | null) => void
  markNotificationRead: (notificationId: string) => void
  toggleNotificationRead: (notificationId: string) => void
  archiveNotification: (notificationId: string) => void
  archiveNotifications: (notificationIds: string[]) => void
  unarchiveNotification: (notificationId: string) => void
  unarchiveNotifications: (notificationIds: string[]) => void
  deleteNotification: (notificationId: string) => Promise<void>
  updateWorkspaceBranding: (input: UpdateWorkspaceBrandingInput) => void
  deleteCurrentWorkspace: () => Promise<boolean>
  leaveWorkspace: () => Promise<boolean>
  removeWorkspaceUser: (userId: string) => Promise<boolean>
  createTeam: (input: CreateTeamInput) => Promise<{
    teamId: string
    teamSlug: string
    features: TeamFeatureSettings
  } | null>
  deleteTeam: (teamId: string) => Promise<boolean>
  leaveTeam: (teamId: string) => Promise<boolean>
  updateTeamDetails: (
    teamId: string,
    input: UpdateTeamDetailsInput
  ) => Promise<boolean>
  updateTeamMemberRole: (
    teamId: string,
    userId: string,
    input: TeamMembershipRoleInput
  ) => Promise<boolean>
  removeTeamMember: (teamId: string, userId: string) => Promise<boolean>
  regenerateTeamJoinCode: (teamId: string) => Promise<boolean>
  updateCurrentUserProfile: (input: UpdateProfileInput) => void
  updateCurrentUserStatus: (input: UpdateUserStatusInput) => void
  clearCurrentUserStatus: () => void
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
  createLabel: (name: string) => Promise<Label | null>
  updateWorkItem: (itemId: string, patch: WorkItemPatch) => void
  deleteWorkItem: (itemId: string) => Promise<boolean>
  shiftTimelineItem: (itemId: string, nextStartDate: string) => void
  updateDocumentContent: (documentId: string, content: string) => void
  flushDocumentSync: (documentId: string) => Promise<void>
  renameDocument: (documentId: string, title: string) => void
  deleteDocument: (documentId: string) => Promise<void>
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
  updateProject: (projectId: string, patch: ProjectPatch) => void
  createDocument: (input: CreateDocumentInput) => void
  createWorkItem: (input: CreateWorkItemInput) => string | null
  updateTeamWorkflowSettings: (
    teamId: string,
    workflow: TeamWorkflowSettings
  ) => void
}

export type AppStoreSet = StoreApi<AppStore>["setState"]
export type AppStoreGet = StoreApi<AppStore>["getState"]

export type AppStoreSlice<T> = (set: AppStoreSet, get: AppStoreGet) => T

export type RichTextSyncTask = () => Promise<unknown> | null

export type ConversationAudienceState = Pick<
  AppData,
  | "currentUserId"
  | "workspaces"
  | "workspaceMemberships"
  | "teams"
  | "teamMemberships"
  | "conversations"
  | "users"
>

export type WorkItemValidationInput = CreateWorkItemInput & {
  currentItemId?: string | null
  labelIds?: string[]
}

export type WorkItemProjectLinkResolution = {
  cascadeItemIds: Set<string>
  resolvedPrimaryProjectId: string | null
  shouldCascadeProjectLink: boolean
}

export type WorkItemCascadeDeletePlan = {
  item: WorkItem
  deletedItemIds: Set<string>
  deletedCommentIds: Set<string>
  deletedAttachmentIds: Set<string>
  deletedNotificationIds: Set<string>
  nextWorkItems: WorkItem[]
  nextDocuments: AppData["documents"]
}

export type WorkspaceStateAccess = Pick<
  AppData,
  | "currentUserId"
  | "currentWorkspaceId"
  | "workspaces"
  | "workspaceMemberships"
  | "teams"
  | "teamMemberships"
  | "users"
  | "labels"
  | "projects"
  | "milestones"
  | "workItems"
  | "documents"
  | "views"
  | "comments"
  | "attachments"
  | "notifications"
  | "invites"
  | "projectUpdates"
  | "conversations"
  | "calls"
  | "chatMessages"
  | "channelPosts"
  | "channelPostComments"
  | "ui"
>

export type TeamScopedConversation = Conversation & {
  scopeType: "team" | "workspace"
}
