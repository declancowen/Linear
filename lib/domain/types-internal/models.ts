import type {
  AttachmentTargetType,
  ChatMessageKind,
  CommentTargetType,
  ConversationKind,
  ConversationScopeType,
  ConversationVariant,
  DisplayProperty,
  DocumentKind,
  EntityKind,
  GroupField,
  HiddenState,
  NotificationEntityType,
  NotificationType,
  OrderingField,
  Priority,
  ProjectHealth,
  ProjectPresentationConfig,
  ProjectStatus,
  Role,
  ScopeType,
  TeamExperienceType,
  TeamFeatureSettings,
  TeamWorkflowSettings,
  TemplateType,
  ThemePreference,
  UserStatus,
  ViewContainerType,
  ViewFilters,
  ViewLayout,
  ViewScopeType,
  WorkItemType,
  WorkStatus,
} from "./primitives"

export interface Workspace {
  id: string
  slug: string
  name: string
  logoUrl: string
  logoImageUrl?: string | null
  createdBy?: string | null
  workosOrganizationId: string | null
  settings: {
    accent: string
    description: string
  }
}

export interface Team {
  id: string
  workspaceId: string
  slug: string
  name: string
  icon: string
  settings: {
    joinCode: string
    summary: string
    guestProjectIds: string[]
    guestDocumentIds: string[]
    guestWorkItemIds: string[]
    experience: TeamExperienceType
    features: TeamFeatureSettings
    workflow: TeamWorkflowSettings
  }
}

export interface TeamMembership {
  teamId: string
  userId: string
  role: Role
}

export interface WorkspaceMembership {
  workspaceId: string
  userId: string
  role: Role
}

export interface UserProfile {
  id: string
  name: string
  handle: string
  email: string
  avatarUrl: string
  avatarImageUrl?: string | null
  workosUserId: string | null
  title: string
  status: UserStatus
  statusMessage: string
  hasExplicitStatus?: boolean
  accountDeletionPendingAt?: string | null
  accountDeletedAt?: string | null
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: ThemePreference
  }
}

export interface Label {
  id: string
  workspaceId: string
  name: string
  color: string
}

export interface Project {
  id: string
  scopeType: ScopeType
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  description: string
  leadId: string
  memberIds: string[]
  health: ProjectHealth
  priority: Priority
  status: ProjectStatus
  blockingProjectIds?: string[]
  blockedByProjectIds?: string[]
  presentation?: ProjectPresentationConfig
  startDate: string | null
  targetDate: string | null
  labelIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  targetDate: string | null
  status: WorkStatus
}

export interface WorkItem {
  id: string
  key: string
  teamId: string
  type: WorkItemType
  title: string
  descriptionDocId: string
  status: WorkStatus
  priority: Priority
  assigneeId: string | null
  creatorId: string
  parentId: string | null
  primaryProjectId: string | null
  linkedProjectIds: string[]
  linkedDocumentIds: string[]
  labelIds: string[]
  milestoneId: string | null
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
  subscriberIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  kind: DocumentKind
  workspaceId: string
  teamId: string | null
  title: string
  content: string
  notifiedMentionCounts?: Record<string, number>
  linkedProjectIds: string[]
  linkedWorkItemIds: string[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface DocumentPresenceViewer {
  userId: string
  name: string
  avatarUrl: string
  avatarImageUrl?: string | null
  lastSeenAt: string
}

export interface ViewDefinition {
  id: string
  name: string
  description: string
  scopeType: ViewScopeType
  scopeId: string
  entityKind: EntityKind
  containerType?: ViewContainerType | null
  containerId?: string | null
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  layout: ViewLayout
  filters: ViewFilters
  grouping: GroupField
  subGrouping: GroupField | null
  ordering: OrderingField
  displayProps: DisplayProperty[]
  hiddenState: HiddenState
  isShared: boolean
  route: string
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  targetType: CommentTargetType
  targetId: string
  parentCommentId: string | null
  content: string
  mentionUserIds: string[]
  reactions: CommentReaction[]
  createdBy: string
  createdAt: string
}

export interface Attachment {
  id: string
  targetType: AttachmentTargetType
  targetId: string
  teamId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
  uploadedBy: string
  createdAt: string
  fileUrl: string | null
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  entityType: NotificationEntityType
  entityId: string
  actorId: string
  message: string
  readAt: string | null
  archivedAt: string | null
  emailedAt: string | null
  createdAt: string
}

export interface Invite {
  id: string
  workspaceId: string
  teamId: string
  email: string
  role: Role
  token: string
  joinCode: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  declinedAt?: string | null
}

export interface ProjectUpdate {
  id: string
  projectId: string
  content: string
  createdBy: string
  createdAt: string
}

export interface Conversation {
  id: string
  kind: ConversationKind
  scopeType: ConversationScopeType
  scopeId: string
  variant: ConversationVariant
  title: string
  description: string
  participantIds: string[]
  roomId?: string | null
  roomName?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  kind: ChatMessageKind
  content: string
  callId?: string | null
  mentionUserIds: string[]
  reactions: CommentReaction[]
  createdBy: string
  createdAt: string
}

export interface Call {
  id: string
  conversationId: string
  scopeType: ConversationScopeType
  scopeId: string
  roomId: string | null
  roomName: string | null
  roomKey: string
  roomDescription: string
  startedBy: string
  startedAt: string
  updatedAt: string
  endedAt: string | null
  participantUserIds: string[]
  lastJoinedAt: string | null
  lastJoinedBy: string | null
  joinCount: number
}

export interface CommentReaction {
  emoji: string
  userIds: string[]
}

export type ChannelPostReaction = CommentReaction

export interface ChannelPost {
  id: string
  conversationId: string
  title: string
  content: string
  reactions: ChannelPostReaction[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ChannelPostComment {
  id: string
  postId: string
  content: string
  mentionUserIds: string[]
  createdBy: string
  createdAt: string
}

export type CreateDialogState =
  | {
      kind: "workItem"
      defaultTeamId?: string | null
      defaultProjectId?: string | null
      initialType?: WorkItemType | null
    }
  | {
      kind: "project"
      defaultTeamId?: string | null
    }
  | {
      kind: "view"
      defaultScopeType?: "team" | "workspace" | null
      defaultScopeId?: string | null
      defaultProjectId?: string | null
      defaultEntityKind?: EntityKind | null
      defaultRoute?: string | null
      lockScope?: boolean
      lockProject?: boolean
      lockEntityKind?: boolean
      initialConfig?: Partial<{
        layout: ViewLayout
        filters: ViewFilters
        grouping: GroupField
        subGrouping: GroupField | null
        ordering: OrderingField
        itemLevel: WorkItemType | null
        showChildItems: boolean
        displayProps: DisplayProperty[]
        hiddenState: HiddenState
      }>
    }

export interface UiState {
  activeTeamId: string
  activeInboxNotificationId: string | null
  selectedViewByRoute: Record<string, string>
  activeCreateDialog: CreateDialogState | null
}

export interface AppData {
  currentUserId: string
  currentWorkspaceId: string
  workspaces: Workspace[]
  workspaceMemberships: WorkspaceMembership[]
  teams: Team[]
  teamMemberships: TeamMembership[]
  users: UserProfile[]
  labels: Label[]
  projects: Project[]
  milestones: Milestone[]
  workItems: WorkItem[]
  documents: Document[]
  views: ViewDefinition[]
  comments: Comment[]
  attachments: Attachment[]
  notifications: Notification[]
  invites: Invite[]
  projectUpdates: ProjectUpdate[]
  conversations: Conversation[]
  calls: Call[]
  chatMessages: ChatMessage[]
  channelPosts: ChannelPost[]
  channelPostComments: ChannelPostComment[]
  ui: UiState
}

export type AppSnapshot = Omit<AppData, "ui">
