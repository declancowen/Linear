import { beforeEach, describe, expect, it } from "vitest"

import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamWorkflowSettings,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

const currentUser = {
  id: "user_current",
  name: "Current User",
  handle: "current",
  email: "current@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const projectLead = {
  ...currentUser,
  id: "user_lead",
  name: "Project Lead",
  handle: "lead",
  email: "lead@example.com",
}

function createChatConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "chat_1",
    kind: "chat" as const,
    scopeType: "workspace" as const,
    scopeId: "workspace_1",
    variant: "direct" as const,
    title: "Direct",
    description: "",
    participantIds: [currentUser.id],
    roomId: null,
    roomName: null,
    createdBy: currentUser.id,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
    lastActivityAt: "2026-04-22T00:00:00.000Z",
    ...overrides,
  }
}

function createChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "message_1",
    conversationId: "chat_1",
    kind: "text" as const,
    content: "<p>First</p>",
    callId: null,
    mentionUserIds: [],
    reactions: [],
    createdBy: currentUser.id,
    createdAt: "2026-04-22T00:01:00.000Z",
    ...overrides,
  }
}

function createThreadHistoryFixture() {
  return {
    conversation: createChatConversation({
      updatedAt: "2026-04-22T00:03:00.000Z",
      lastActivityAt: "2026-04-22T00:03:00.000Z",
    }),
    messages: [
      createChatMessage(),
      createChatMessage({
        id: "message_2",
        content: "<p>Second</p>",
        createdAt: "2026-04-22T00:02:00.000Z",
      }),
      createChatMessage({
        id: "message_3",
        content: "<p>Latest</p>",
        createdAt: "2026-04-22T00:03:00.000Z",
      }),
    ],
  }
}

function seedThreadHistory({
  conversation,
  messages,
}: ReturnType<typeof createThreadHistoryFixture>) {
  useAppStore.setState((state) => ({
    ...state,
    conversations: [conversation],
    chatMessages: messages,
  }))
}

function mergeLatestThreadMessage(
  { conversation, messages }: ReturnType<typeof createThreadHistoryFixture>,
  replaceScope: Record<string, unknown>
) {
  useAppStore.getState().mergeReadModelData(
    {
      conversations: [conversation],
      chatMessages: [messages[2]],
    },
    {
      replace: [replaceScope as never],
    }
  )
}

function createWorkspaceDocumentRecord({
  content,
  title,
  updatedAt,
}: {
  content: string
  title: string
  updatedAt: string
}) {
  return {
    id: "doc_workspace",
    kind: "workspace-document" as const,
    workspaceId: "workspace_1",
    teamId: null,
    title,
    content,
    linkedProjectIds: [],
    linkedWorkItemIds: [],
    createdBy: currentUser.id,
    updatedBy: currentUser.id,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt,
  }
}

function getWorkspaceDocument() {
  return useAppStore
    .getState()
    .documents.find((document) => document.id === "doc_workspace")
}

function replaceDomainDataWithDocuments(
  documents: Array<ReturnType<typeof createWorkspaceDocumentRecord>>
) {
  const currentState = useAppStore.getState()

  useAppStore.getState().replaceDomainData({
    ...createEmptyState(),
    currentUserId: currentState.currentUserId,
    currentWorkspaceId: currentState.currentWorkspaceId,
    workspaces: currentState.workspaces,
    workspaceMemberships: currentState.workspaceMemberships,
    teams: currentState.teams,
    teamMemberships: currentState.teamMemberships,
    users: currentState.users,
    labels: currentState.labels,
    projects: currentState.projects,
    milestones: currentState.milestones,
    workItems: currentState.workItems,
    documents,
    views: currentState.views,
    comments: currentState.comments,
    attachments: currentState.attachments,
    notifications: currentState.notifications,
    invites: currentState.invites,
    projectUpdates: currentState.projectUpdates,
    conversations: currentState.conversations,
    calls: currentState.calls,
    chatMessages: currentState.chatMessages,
    channelPosts: currentState.channelPosts,
    channelPostComments: currentState.channelPostComments,
  })
}

function createPendingConfigBaseView(): ViewDefinition {
  return {
    id: "view_1",
    name: "All work",
    description: "",
    scopeType: "team",
    scopeId: "team_1",
    entityKind: "items",
    containerType: null,
    containerId: null,
    itemLevel: null,
    showChildItems: true,
    layout: "list",
    grouping: "status",
    subGrouping: null,
    ordering: "priority",
    filters: {
      status: [],
      priority: [],
      assigneeIds: [],
      creatorIds: [],
      leadIds: [],
      health: [],
      milestoneIds: [],
      relationTypes: [],
      projectIds: [],
      parentIds: [],
      itemTypes: [],
      labelIds: [],
      teamIds: [],
      showCompleted: true,
    },
    displayProps: ["id", "status", "assignee"],
    hiddenState: {
      groups: [],
      subgroups: [],
    },
    isShared: true,
    route: "/team/eng/work",
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  }
}

describe("app store read model merge", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: currentUser.id,
      currentWorkspaceId: "workspace_1",
      workspaces: [
        {
          id: "workspace_1",
          slug: "acme",
          name: "Acme",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: currentUser.id,
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: currentUser.id,
          role: "admin",
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "eng",
          name: "Engineering",
          icon: "rocket",
          settings: {
            joinCode: "ENG123",
            summary: "",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: {
              issues: true,
              projects: true,
              docs: true,
              chat: true,
              channels: true,
              views: true,
            },
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: currentUser.id,
          role: "admin",
        },
      ],
      users: [currentUser],
      documents: [
        {
          id: "doc_workspace",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Workspace Doc",
          content: "<p>Workspace</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "doc_private",
          kind: "private-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Private Doc",
          content: "<p>Private</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "doc_team",
          kind: "team-document",
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Team Doc",
          content: "<p>Team</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "ENG-1",
          teamId: "team_1",
          title: "Current item",
          descriptionDocId: "doc_team",
          status: "todo",
          priority: "medium",
          type: "task",
          assigneeId: null,
          parentId: null,
          creatorId: currentUser.id,
          subscriberIds: [],
          labelIds: [],
          linkedProjectIds: [],
          linkedDocumentIds: [],
          primaryProjectId: null,
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      pendingWorkItemSyncsById: {},
      pendingCommentSyncsById: {},
      pendingChatMessageSyncsById: {},
      pendingChannelPostCommentSyncsById: {},
      ui: {
        activeTeamId: "team_1",
        activeInboxNotificationId: null,
        selectedViewByRoute: {},
        viewerViewConfigByRoute: {},
        viewerDirectoryConfigByRoute: {},
        viewerDirectoryPresetsByRoute: {},
        selectedDirectoryPresetByRoute: {},
        collaborationSidebarOpenBySurface: {},
        activeCreateDialog: null,
      },
    })
  })

  it("preserves current user and workspace data when merging a narrower scoped patch", () => {
    useAppStore.getState().mergeReadModelData({
      projects: [
        {
          id: "project_1",
          scopeType: "workspace",
          scopeId: "workspace_1",
          templateType: "software-delivery",
          name: "Launch",
          summary: "",
          description: "",
          leadId: projectLead.id,
          memberIds: [],
          health: "on-track",
          priority: "medium",
          status: "planned",
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      users: [projectLead],
    })

    const state = useAppStore.getState()

    expect(state.currentUserId).toBe(currentUser.id)
    expect(state.currentWorkspaceId).toBe("workspace_1")
    expect(state.users.map((user) => user.id).sort()).toEqual([
      currentUser.id,
      projectLead.id,
    ])
    expect(state.workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace_1",
    ])
    expect(state.workspaceMemberships).toHaveLength(1)
  })

  it("preserves chat message receipt maps when a list read model omits them", () => {
    useAppStore.setState((state) => ({
      ...state,
      conversations: [createChatConversation()],
      chatReadStates: [
        {
          id: "chat_read_state_user_current_chat_1",
          userId: currentUser.id,
          conversationId: "chat_1",
          readAt: "2026-04-22T00:01:00.000Z",
          unreadAt: null,
          messageReadAtById: {
            message_1: "2026-04-22T00:01:00.000Z",
          },
          createdAt: "2026-04-22T00:01:00.000Z",
          updatedAt: "2026-04-22T00:01:00.000Z",
        },
      ],
    }))

    useAppStore.getState().mergeReadModelData({
      chatReadStates: [
        {
          id: "chat_read_state_user_current_chat_1",
          userId: currentUser.id,
          conversationId: "chat_1",
          readAt: "2026-04-22T00:02:00.000Z",
          unreadAt: null,
          createdAt: "2026-04-22T00:01:00.000Z",
          updatedAt: "2026-04-22T00:02:00.000Z",
        },
      ],
    })

    expect(useAppStore.getState().chatReadStates[0]?.messageReadAtById).toEqual(
      {
        message_1: "2026-04-22T00:01:00.000Z",
      }
    )
  })

  it("keeps pending work item updates during scoped replacement pruning", () => {
    useAppStore.setState((state) => ({
      ...state,
      pendingWorkItemSyncsById: {
        item_1: "sync_1",
      },
    }))

    useAppStore.getState().mergeReadModelData(
      {
        workItems: [],
      },
      {
        replace: [
          {
            kind: "work-index",
            scopeType: "team",
            scopeId: "team_1",
          },
        ],
      }
    )

    expect(useAppStore.getState().workItems.map((item) => item.id)).toEqual([
      "item_1",
    ])
  })

  it("keeps pending chat messages during scoped replacement pruning", () => {
    useAppStore.setState((state) => ({
      ...state,
      conversations: [createChatConversation()],
      chatMessages: [
        createChatMessage({
          id: "message_pending",
          content: "<p>Sending</p>",
        }),
      ],
      pendingChatMessageSyncsById: {
        message_pending: "chat_message_sync_1",
      },
    }))

    useAppStore.getState().mergeReadModelData(
      {
        chatMessages: [],
      },
      {
        replace: [
          {
            kind: "conversation-thread",
            conversationId: "chat_1",
          },
        ],
      }
    )

    expect(
      useAppStore.getState().chatMessages.map((message) => message.id)
    ).toEqual(["message_pending"])
  })

  it("keeps pending work item comments during scoped replacement pruning", () => {
    const pendingComment = {
      id: "comment_pending",
      targetType: "workItem" as const,
      targetId: "item_1",
      parentCommentId: null,
      content: "<p>Uploading file</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: currentUser.id,
      createdAt: "2026-04-22T00:01:00.000Z",
    }
    const staleComment = {
      ...pendingComment,
      id: "comment_stale",
      content: "<p>Stale</p>",
    }

    useAppStore.setState((state) => ({
      ...state,
      comments: [pendingComment, staleComment],
      pendingCommentSyncsById: {
        comment_pending: "comment_sync_1",
      },
    }))

    useAppStore.getState().mergeReadModelData(
      {
        comments: [],
      },
      {
        replace: [
          {
            kind: "work-item-detail",
            itemId: "item_1",
          },
        ],
      }
    )

    expect(
      useAppStore.getState().comments.map((comment) => comment.id)
    ).toEqual(["comment_pending"])
  })

  it("keeps pending channel post comments during scoped replacement pruning", () => {
    const conversation = {
      id: "channel_1",
      kind: "channel" as const,
      scopeType: "team" as const,
      scopeId: "team_1",
      variant: "team" as const,
      title: "Platform",
      description: "",
      participantIds: [currentUser.id],
      roomId: null,
      roomName: null,
      createdBy: currentUser.id,
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
      lastActivityAt: "2026-04-22T00:00:00.000Z",
    }
    const post = {
      id: "post_1",
      conversationId: "channel_1",
      title: "Roadmap",
      content: "<p>Post</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: currentUser.id,
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
    }
    const pendingComment = {
      id: "channel_comment_pending",
      postId: "post_1",
      content: "<p>Uploading file</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: currentUser.id,
      createdAt: "2026-04-22T00:01:00.000Z",
    }
    const staleComment = {
      ...pendingComment,
      id: "channel_comment_stale",
      content: "<p>Stale</p>",
    }

    useAppStore.setState((state) => ({
      ...state,
      conversations: [conversation],
      channelPosts: [post],
      channelPostComments: [pendingComment, staleComment],
      pendingChannelPostCommentSyncsById: {
        channel_comment_pending: "channel_comment_sync_1",
      },
    }))

    useAppStore.getState().mergeReadModelData(
      {
        channelPostComments: [],
      },
      {
        replace: [
          {
            kind: "channel-feed",
            conversationId: "channel_1",
          },
        ],
      }
    )

    expect(
      useAppStore.getState().channelPostComments.map((comment) => comment.id)
    ).toEqual(["channel_comment_pending"])
  })

  it("does not prune loaded thread history from latest-message conversation list previews", () => {
    const threadHistory = createThreadHistoryFixture()

    seedThreadHistory(threadHistory)
    mergeLatestThreadMessage(threadHistory, {
      kind: "conversation-list",
      userId: currentUser.id,
    })

    expect(
      useAppStore.getState().chatMessages.map((message) => message.id)
    ).toEqual(["message_1", "message_2", "message_3"])
  })

  it("keeps conversation thread replacements authoritative for non-pending messages", () => {
    const threadHistory = createThreadHistoryFixture()

    seedThreadHistory(threadHistory)
    mergeLatestThreadMessage(threadHistory, {
      kind: "conversation-thread",
      conversationId: "chat_1",
    })

    expect(
      useAppStore.getState().chatMessages.map((message) => message.id)
    ).toEqual(["message_3"])
  })

  it("ignores incidental current workspace ids from non-membership read models", () => {
    useAppStore.setState((state) => ({
      ...state,
      currentWorkspaceId: "workspace_2",
      workspaces: [
        ...state.workspaces,
        {
          id: "workspace_2",
          slug: "beta",
          name: "Beta",
          logoUrl: "BE",
          logoImageUrl: null,
          createdBy: currentUser.id,
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
    }))

    useAppStore.getState().mergeReadModelData(
      {
        currentUserId: currentUser.id,
        currentWorkspaceId: "workspace_1",
        notifications: [],
      },
      {
        replace: [
          {
            kind: "notification-inbox",
            userId: currentUser.id,
          },
        ],
      }
    )

    expect(useAppStore.getState().currentWorkspaceId).toBe("workspace_2")
  })

  it("applies current workspace ids from workspace membership read models", () => {
    useAppStore.getState().mergeReadModelData(
      {
        currentUserId: currentUser.id,
        currentWorkspaceId: "workspace_2",
        workspaces: [
          {
            id: "workspace_2",
            slug: "beta",
            name: "Beta",
            logoUrl: "BE",
            logoImageUrl: null,
            createdBy: currentUser.id,
            workosOrganizationId: null,
            settings: {
              accent: "#000000",
              description: "",
            },
          },
        ],
        workspaceMemberships: [
          {
            workspaceId: "workspace_2",
            userId: currentUser.id,
            role: "admin",
          },
        ],
        teams: [],
        teamMemberships: [],
      },
      {
        replace: [
          {
            kind: "workspace-membership",
            workspaceId: "workspace_2",
          },
        ],
      }
    )

    expect(useAppStore.getState().currentWorkspaceId).toBe("workspace_2")
  })

  it("updates existing entities by identity instead of duplicating them", () => {
    useAppStore.getState().mergeReadModelData({
      users: [
        {
          ...currentUser,
          name: "Updated Current User",
        },
      ],
    })

    const users = useAppStore.getState().users

    expect(users).toHaveLength(1)
    expect(users[0]?.name).toBe("Updated Current User")
  })

  it("preserves pending optimistic view config until the server catches up", () => {
    const baseView = createPendingConfigBaseView()

    useAppStore.setState((state) => ({
      ...state,
      views: [baseView],
      pendingViewConfigById: {
        view_1: {
          token: "pending_1",
          patch: {
            layout: "timeline",
          },
        },
      },
    }))

    useAppStore.getState().mergeReadModelData({
      views: [
        {
          ...baseView,
          updatedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
    })

    let state = useAppStore.getState()
    expect(state.views[0]?.layout).toBe("timeline")
    expect(state.pendingViewConfigById.view_1).toEqual({
      token: "pending_1",
      patch: {
        layout: "timeline",
      },
    })

    useAppStore.getState().mergeReadModelData({
      views: [
        {
          ...baseView,
          layout: "timeline",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
    })

    state = useAppStore.getState()
    expect(state.views[0]?.layout).toBe("timeline")
    expect(state.pendingViewConfigById).toEqual({})
  })

  it("preserves pending optimistic filter and display-prop edits until the server catches up", () => {
    const baseView = createPendingConfigBaseView()

    useAppStore.setState((state) => ({
      ...state,
      views: [
        {
          ...baseView,
          filters: { ...baseView.filters, status: ["on-hold"] },
          displayProps: ["id", "status"],
        },
      ],
      pendingViewConfigById: {
        view_1: {
          token: "pending_1",
          patch: {
            filters: { status: ["on-hold"] },
            displayProps: ["id", "status"],
          },
        },
      },
    }))

    // A racing read-model refresh that lacks the optimistic edits must not clobber them.
    useAppStore.getState().mergeReadModelData({
      views: [{ ...baseView, updatedAt: "2026-04-23T00:00:00.000Z" }],
    })

    let state = useAppStore.getState()
    expect(state.views[0]?.filters.status).toEqual(["on-hold"])
    expect(state.views[0]?.displayProps).toEqual(["id", "status"])
    expect(state.pendingViewConfigById.view_1?.token).toBe("pending_1")

    // Once the server reflects the edits, the pending entry clears.
    useAppStore.getState().mergeReadModelData({
      views: [
        {
          ...baseView,
          filters: { ...baseView.filters, status: ["on-hold"] },
          displayProps: ["id", "status"],
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
    })

    state = useAppStore.getState()
    expect(state.views[0]?.filters.status).toEqual(["on-hold"])
    expect(state.views[0]?.displayProps).toEqual(["id", "status"])
    expect(state.pendingViewConfigById).toEqual({})
  })

  it("prunes stale documents when a document index scope is refreshed", () => {
    useAppStore.getState().mergeReadModelData(
      {
        currentUserId: currentUser.id,
        currentWorkspaceId: "workspace_1",
        documents: [],
      },
      {
        replace: [
          {
            kind: "document-index",
            scopeType: "workspace",
            scopeId: "workspace_1",
          },
        ],
      }
    )

    const documentIds = useAppStore
      .getState()
      .documents.map((document) => document.id)
      .sort()

    expect(documentIds).toEqual(["doc_team"])
  })

  it("preserves existing document bodies during metadata-only document index merges", () => {
    useAppStore.getState().mergeReadModelData(
      {
        currentUserId: currentUser.id,
        currentWorkspaceId: "workspace_1",
        documents: [
          {
            id: "doc_team",
            kind: "team-document",
            workspaceId: "workspace_1",
            teamId: "team_1",
            title: "Team Doc Updated",
            content: "",
            previewText: "Incoming stale body",
            linkedProjectIds: [],
            linkedWorkItemIds: [],
            createdBy: currentUser.id,
            updatedBy: projectLead.id,
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
      },
      {
        replace: [
          {
            kind: "document-index",
            scopeType: "workspace",
            scopeId: "workspace_1",
          },
        ],
      }
    )

    expect(
      useAppStore
        .getState()
        .documents.find((document) => document.id === "doc_team")
    ).toMatchObject({
      title: "Team Doc Updated",
      content: "<p>Team</p>",
      previewText: "Incoming stale body",
      updatedAt: "2026-04-23T00:00:00.000Z",
      updatedBy: projectLead.id,
    })
  })

  it("prunes stale work items when a work index scope is refreshed", () => {
    useAppStore.getState().mergeReadModelData(
      {
        currentUserId: currentUser.id,
        currentWorkspaceId: "workspace_1",
        teams: useAppStore.getState().teams,
        teamMemberships: useAppStore.getState().teamMemberships,
        workspaces: useAppStore.getState().workspaces,
        workspaceMemberships: useAppStore.getState().workspaceMemberships,
        workItems: [],
      },
      {
        replace: [
          {
            kind: "work-index",
            scopeType: "team",
            scopeId: "team_1",
          },
        ],
      }
    )

    expect(useAppStore.getState().workItems).toHaveLength(0)
  })

  it("preserves protected document bodies across read model merges and snapshot replacement", () => {
    useAppStore.getState().setDocumentBodyProtection("doc_workspace", true)

    useAppStore.getState().mergeReadModelData({
      documents: [
        createWorkspaceDocumentRecord({
          title: "Stale Workspace Doc",
          content: "<p>Stale body</p>",
          updatedAt: "2026-04-23T00:00:00.000Z",
        }),
      ],
    })

    let protectedDocument = getWorkspaceDocument()

    expect(protectedDocument?.title).toBe("Stale Workspace Doc")
    expect(protectedDocument?.content).toBe("<p>Workspace</p>")

    replaceDomainDataWithDocuments([
      createWorkspaceDocumentRecord({
        title: "Snapshot Workspace Doc",
        content: "<p>Snapshot body</p>",
        updatedAt: "2026-04-24T00:00:00.000Z",
      }),
    ])

    protectedDocument = getWorkspaceDocument()

    expect(protectedDocument?.title).toBe("Snapshot Workspace Doc")
    expect(protectedDocument?.content).toBe("<p>Workspace</p>")
  })

  it("preserves pending local document body syncs across stale read model merges and snapshot replacement", () => {
    useAppStore.setState((state) => ({
      ...state,
      documents: state.documents.map((document) =>
        document.id === "doc_workspace"
          ? {
              ...document,
              content: "<p>Unsaved local draft</p>",
            }
          : document
      ),
      pendingDocumentContentSyncs: {
        ...state.pendingDocumentContentSyncs,
        doc_workspace: "pending-token-1",
      },
    }))

    useAppStore.getState().mergeReadModelData({
      documents: [
        createWorkspaceDocumentRecord({
          title: "Stale Workspace Doc",
          content: "",
          updatedAt: "2026-04-23T00:00:00.000Z",
        }),
      ],
    })

    let pendingDocument = getWorkspaceDocument()

    expect(pendingDocument?.title).toBe("Stale Workspace Doc")
    expect(pendingDocument?.content).toBe("<p>Unsaved local draft</p>")
    expect(
      useAppStore.getState().pendingDocumentContentSyncs.doc_workspace
    ).toBe("pending-token-1")

    replaceDomainDataWithDocuments([
      createWorkspaceDocumentRecord({
        title: "Snapshot Workspace Doc",
        content: "<p>Snapshot stale body</p>",
        updatedAt: "2026-04-24T00:00:00.000Z",
      }),
    ])

    pendingDocument = getWorkspaceDocument()

    expect(pendingDocument?.title).toBe("Snapshot Workspace Doc")
    expect(pendingDocument?.content).toBe("<p>Unsaved local draft</p>")
    expect(
      useAppStore.getState().pendingDocumentContentSyncs.doc_workspace
    ).toBe("pending-token-1")
  })

  it("evicts only the missing work item when a detail refresh returns not found", () => {
    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, projectLead],
      teamMemberships: [
        ...state.teamMemberships,
        {
          teamId: "team_1",
          userId: projectLead.id,
          role: "member",
        },
      ],
      projects: [
        {
          id: "project_1",
          scopeType: "team",
          scopeId: "team_1",
          templateType: "software-delivery",
          name: "Launch",
          summary: "",
          description: "",
          leadId: projectLead.id,
          memberIds: [currentUser.id],
          health: "on-track",
          priority: "medium",
          status: "planned",
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      labels: [
        {
          id: "label_1",
          workspaceId: "workspace_1",
          name: "Bug",
          color: "#ef4444",
        },
      ],
      workItems: [
        ...state.workItems,
        {
          id: "item_2",
          key: "ENG-2",
          teamId: "team_1",
          title: "Sibling item",
          descriptionDocId: "doc_workspace",
          status: "todo",
          priority: "low",
          type: "task",
          assigneeId: projectLead.id,
          parentId: null,
          creatorId: projectLead.id,
          subscriberIds: [currentUser.id],
          labelIds: ["label_1"],
          linkedProjectIds: ["project_1"],
          linkedDocumentIds: [],
          primaryProjectId: "project_1",
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    }))

    const missingResult = createMissingScopedReadModelResult([
      {
        kind: "work-item-detail",
        itemId: "item_1",
      },
    ])

    useAppStore.getState().mergeReadModelData(missingResult.data, {
      replace: missingResult.replace,
    })

    const state = useAppStore.getState()

    expect(state.workItems.map((item) => item.id)).toEqual(["item_2"])
    expect(state.projects.map((project) => project.id)).toEqual(["project_1"])
    expect(state.labels.map((label) => label.id)).toEqual(["label_1"])
    expect(
      state.teamMemberships.map((membership) => membership.userId).sort()
    ).toEqual([currentUser.id, projectLead.id])
    expect(state.users.map((user) => user.id).sort()).toEqual([
      currentUser.id,
      projectLead.id,
    ])
  })
})
