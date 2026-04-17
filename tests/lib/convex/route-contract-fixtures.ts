import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppSnapshot,
  type Call,
  type ChatMessage,
  type Label,
} from "@/lib/domain/types"

export const snapshotFixture: AppSnapshot = {
  currentUserId: "user_1",
  currentWorkspaceId: "workspace_1",
  workspaces: [
    {
      id: "workspace_1",
      slug: "alpha",
      name: "Alpha",
      logoUrl: "A",
      logoImageUrl: null,
      createdBy: "user_1",
      workosOrganizationId: "org_1",
      settings: {
        accent: "emerald",
        description: "Primary workspace",
      },
    },
  ],
  teams: [
    {
      id: "team_1",
      workspaceId: "workspace_1",
      slug: "core",
      name: "Core",
      icon: "spark",
      settings: {
        joinCode: "ABC123DEF456",
        summary: "Core team",
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
        workflow: createDefaultTeamWorkflowSettings("software-development"),
      },
    },
  ],
  teamMemberships: [
    {
      teamId: "team_1",
      userId: "user_1",
      role: "admin",
    },
  ],
  users: [
    {
      id: "user_1",
      name: "Alex Example",
      handle: "alex",
      email: "alex@example.com",
      avatarUrl: "AE",
      avatarImageUrl: null,
      workosUserId: "workos_1",
      title: "Engineer",
      status: "active",
      statusMessage: "",
      hasExplicitStatus: false,
      accountDeletionPendingAt: null,
      accountDeletedAt: null,
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    },
  ],
  labels: [],
  projects: [],
  milestones: [],
  workItems: [],
  documents: [],
  views: [],
  comments: [],
  attachments: [],
  notifications: [],
  invites: [],
  projectUpdates: [],
  conversations: [],
  calls: [],
  chatMessages: [],
  channelPosts: [],
  channelPostComments: [],
}

export const currentCallInviteMessageFixture: ChatMessage = {
  id: "message_1",
  conversationId: "conversation_1",
  kind: "text",
  content: "Started a call\nJoin call: /api/calls/join?conversationId=conversation_1",
  callId: null,
  mentionUserIds: [],
  createdBy: "user_1",
  createdAt: "2026-04-16T20:45:00.000Z",
}

export const structuredCallFixture: Call = {
  id: "call_1",
  conversationId: "conversation_1",
  scopeType: "workspace",
  scopeId: "workspace_1",
  roomId: "room_1",
  roomName: "Room One",
  roomKey: "chat-conversation_1",
  roomDescription: "Persistent room",
  startedBy: "user_1",
  startedAt: "2026-04-16T20:45:00.000Z",
  updatedAt: "2026-04-16T20:45:00.000Z",
  endedAt: null,
  participantUserIds: ["user_1"],
  lastJoinedAt: "2026-04-16T20:45:00.000Z",
  lastJoinedBy: "user_1",
  joinCount: 1,
}

export const startConversationCallLegacyFixture = {
  ok: true,
  call: null,
  message: currentCallInviteMessageFixture,
  joinHref: "/api/calls/join?conversationId=conversation_1",
}

export const startConversationCallStructuredFixture = {
  call: structuredCallFixture,
  message: {
    ...currentCallInviteMessageFixture,
    kind: "call",
    content: "Started a call",
    callId: structuredCallFixture.id,
  },
  joinHref: "/api/calls/join?callId=call_1",
}

export const deleteCurrentAccountResultFixture = {
  ok: true as const,
  logoutRequired: true as const,
  notice: "Your account has been deleted.",
}

export const leaveWorkspaceResultFixture = {
  workspaceId: "workspace_1",
  removedTeamIds: ["team_1"],
}

export const createLabelResultFixture = {
  ok: true as const,
  label: {
    id: "label_1",
    workspaceId: "workspace_1",
    name: "Bug",
    color: "red",
  } satisfies Label,
}

export const attachmentUploadUrlResultFixture = {
  uploadUrl: "https://upload.example.com/storage/attachment_1",
}

export const createAttachmentResultFixture = {
  attachmentId: "attachment_1",
  fileUrl: "https://cdn.example.com/attachment_1.png",
}

export const createTeamResultFixture = {
  ok: true as const,
  teamId: "team_2",
  teamSlug: "platform",
  features: createDefaultTeamFeatureSettings("software-development"),
}

export const joinTeamByCodeResultFixture = {
  ok: true as const,
  role: "member",
  teamSlug: "platform",
  workspaceId: "workspace_1",
}

export const deleteTeamResultFixture = {
  ok: true as const,
  teamId: "team_1",
  workspaceId: "workspace_1",
  deletedUserIds: ["user_2"],
}

export const leaveTeamResultFixture = {
  ok: true as const,
  teamId: "team_1",
  workspaceId: "workspace_1",
}

export const regenerateTeamJoinCodeResultFixture = {
  ok: true as const,
  joinCode: "XYZ789QWE123",
}
