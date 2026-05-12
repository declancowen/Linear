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
      ui: {
        activeTeamId: "team_1",
        activeInboxNotificationId: null,
        selectedViewByRoute: {},
        viewerViewConfigByRoute: {},
        viewerDirectoryConfigByRoute: {},
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
    const baseView: ViewDefinition = {
      id: "view_1",
      name: "All work",
      description: "",
      scopeType: "team" as const,
      scopeId: "team_1",
      entityKind: "items" as const,
      containerType: null,
      containerId: null,
      itemLevel: null,
      showChildItems: true,
      layout: "list" as const,
      grouping: "status" as const,
      subGrouping: null,
      ordering: "priority" as const,
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
        {
          id: "doc_workspace",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Stale Workspace Doc",
          content: "<p>Stale body</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
    })

    let protectedDocument = useAppStore
      .getState()
      .documents.find((document) => document.id === "doc_workspace")

    expect(protectedDocument?.title).toBe("Stale Workspace Doc")
    expect(protectedDocument?.content).toBe("<p>Workspace</p>")

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
      documents: [
        {
          id: "doc_workspace",
          kind: "workspace-document",
          workspaceId: "workspace_1",
          teamId: null,
          title: "Snapshot Workspace Doc",
          content: "<p>Snapshot body</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
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

    protectedDocument = useAppStore
      .getState()
      .documents.find((document) => document.id === "doc_workspace")

    expect(protectedDocument?.title).toBe("Snapshot Workspace Doc")
    expect(protectedDocument?.content).toBe("<p>Workspace</p>")
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
