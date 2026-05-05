import { createEmptyState } from "@/lib/domain/empty-state"
import { createDefaultTeamFeatureSettings } from "@/lib/domain/types"
import {
  buildLocalTeamCreateState,
  getNextStateAfterProjectRemoval,
  getNextStateAfterTeamRemoval,
  getNextStateAfterWorkspaceRemoval,
} from "@/lib/store/app-store-internal/domain-updates"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestTeamMembership,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

function expectOnlyTeam2Access(nextState: {
  teams: Array<{ id: string }>
  teamMemberships: Array<{ teamId: string }>
}) {
  expect(nextState.teams.map((team) => team.id)).toEqual(["team_2"])
  expect(nextState.teamMemberships.map((membership) => membership.teamId)).toEqual([
    "team_2",
  ])
}

describe("store domain updates", () => {
  it("builds a complete local team record from the create-team command result", () => {
    const result = buildLocalTeamCreateState({
      currentUserId: "user_1",
      workspaceId: "workspace_1",
      teamId: "team_2",
      teamSlug: "platform",
      joinCode: "JOIN1234",
      name: "Platform",
      icon: "robot",
      summary: "Platform summary",
      experience: "software-development",
      features: createDefaultTeamFeatureSettings("software-development"),
    })

    expect(result.membership).toEqual({
      teamId: "team_2",
      userId: "user_1",
      role: "admin",
    })
    expect(result.team).toMatchObject({
      id: "team_2",
      workspaceId: "workspace_1",
      slug: "platform",
      name: "Platform",
      icon: "robot",
      settings: {
        joinCode: "JOIN1234",
        summary: "Platform summary",
        features: createDefaultTeamFeatureSettings("software-development"),
      },
    })
    expect(result.team.settings.workflow.statusOrder).toEqual([
      "backlog",
      "todo",
      "in-progress",
      "done",
      "cancelled",
      "duplicate",
    ])
  })

  it("removes team-scoped entities without waiting for a full snapshot reload", () => {
    const baseState = createEmptyState()
    const nextState = getNextStateAfterTeamRemoval(
      {
        ...baseState,
        currentUserId: "user_1",
        currentWorkspaceId: "workspace_1",
        workspaces: [
          {
            id: "workspace_1",
            slug: "alpha",
            name: "Alpha",
            logoUrl: "",
            logoImageUrl: null,
            createdBy: "user_1",
            workosOrganizationId: "org_1",
            settings: {
              accent: "emerald",
              description: "Alpha workspace",
            },
          },
        ],
        teams: [
          {
            id: "team_1",
            workspaceId: "workspace_1",
            slug: "platform",
            name: "Platform",
            icon: "robot",
            settings: {
              joinCode: "JOIN1234",
              summary: "Platform",
              guestProjectIds: [],
              guestDocumentIds: [],
              guestWorkItemIds: [],
              experience: "software-development",
              features: createDefaultTeamFeatureSettings("software-development"),
              workflow: buildLocalTeamCreateState({
                currentUserId: "user_1",
                workspaceId: "workspace_1",
                teamId: "team_1",
                teamSlug: "platform",
                joinCode: "JOIN1234",
                name: "Platform",
                icon: "robot",
                summary: "Platform",
                experience: "software-development",
                features: createDefaultTeamFeatureSettings("software-development"),
              }).team.settings.workflow,
            },
          },
          {
            id: "team_2",
            workspaceId: "workspace_1",
            slug: "design",
            name: "Design",
            icon: "users",
            settings: {
              joinCode: "JOIN5678",
              summary: "Design",
              guestProjectIds: [],
              guestDocumentIds: [],
              guestWorkItemIds: [],
              experience: "project-management",
              features: createDefaultTeamFeatureSettings("project-management"),
              workflow: buildLocalTeamCreateState({
                currentUserId: "user_1",
                workspaceId: "workspace_1",
                teamId: "team_2",
                teamSlug: "design",
                joinCode: "JOIN5678",
                name: "Design",
                icon: "users",
                summary: "Design",
                experience: "project-management",
                features: createDefaultTeamFeatureSettings("project-management"),
              }).team.settings.workflow,
            },
          },
        ],
        teamMemberships: [
          {
            teamId: "team_1",
            userId: "user_1",
            role: "admin",
          },
          {
            teamId: "team_2",
            userId: "user_1",
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
            leadId: "user_1",
            memberIds: ["user_1"],
            health: "on-track",
            priority: "high",
            status: "in-progress",
            startDate: null,
            targetDate: null,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        milestones: [
          {
            id: "milestone_1",
            projectId: "project_1",
            name: "Milestone",
            targetDate: null,
            status: "todo",
          },
        ],
        workItems: [
          {
            id: "item_1",
            key: "PLA-1",
            teamId: "team_1",
            type: "task",
            title: "Ship it",
            descriptionDocId: "document_desc_1",
            status: "todo",
            priority: "medium",
            assigneeId: "user_1",
            creatorId: "user_1",
            parentId: null,
            primaryProjectId: "project_1",
            linkedProjectIds: ["project_1"],
            linkedDocumentIds: ["document_desc_1"],
            labelIds: [],
            milestoneId: "milestone_1",
            startDate: null,
            dueDate: null,
            targetDate: null,
            subscriberIds: ["user_1"],
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        documents: [
          {
            id: "document_desc_1",
            kind: "item-description",
            workspaceId: "workspace_1",
            teamId: "team_1",
            title: "Description",
            content: "<p>Desc</p>",
            linkedProjectIds: ["project_1"],
            linkedWorkItemIds: ["item_1"],
            createdBy: "user_1",
            updatedBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        views: [
          {
            id: "view_1",
            name: "Platform board",
            description: "",
            scopeType: "team",
            scopeId: "team_1",
            entityKind: "items",
            layout: "board",
            filters: {
              status: [],
              priority: [],
              assigneeIds: [],
              creatorIds: [],
              leadIds: [],
              health: [],
              milestoneIds: [],
              relationTypes: [],
              projectIds: ["project_1"],
              itemTypes: [],
              labelIds: [],
              teamIds: ["team_1"],
              showCompleted: false,
            },
            grouping: "status",
            subGrouping: null,
            ordering: "updatedAt",
            displayProps: ["status"],
            hiddenState: {
              groups: [],
              subgroups: [],
            },
            isShared: true,
            route: "/workspace/items",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        comments: [
          {
            id: "comment_1",
            targetType: "workItem",
            targetId: "item_1",
            parentCommentId: null,
            content: "<p>Comment</p>",
            mentionUserIds: [],
            reactions: [],
            createdBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        attachments: [
          {
            id: "attachment_1",
            targetType: "workItem",
            targetId: "item_1",
            teamId: "team_1",
            storageId: "storage_1",
            fileName: "spec.pdf",
            contentType: "application/pdf",
            size: 12,
            uploadedBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
            fileUrl: null,
          },
        ],
        notifications: [
          {
            id: "notification_1",
            userId: "user_1",
            type: "comment",
            entityType: "workItem",
            entityId: "item_1",
            actorId: "user_1",
            message: "Updated",
            readAt: null,
            archivedAt: null,
            emailedAt: null,
            createdAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        invites: [
          {
            id: "invite_1",
            workspaceId: "workspace_1",
            teamId: "team_1",
            email: "pat@example.com",
            role: "member",
            token: "invite_1",
            joinCode: "JOIN1234",
            invitedBy: "user_1",
            expiresAt: "2026-05-01T00:00:00.000Z",
            acceptedAt: null,
          },
        ],
        projectUpdates: [
          {
            id: "update_1",
            projectId: "project_1",
            content: "<p>Update</p>",
            createdBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        conversations: [
          {
            id: "conversation_1",
            kind: "chat",
            scopeType: "team",
            scopeId: "team_1",
            variant: "team",
            title: "Platform",
            description: "",
            participantIds: ["user_1"],
            roomId: null,
            roomName: null,
            createdBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            lastActivityAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        calls: [],
        chatMessages: [
          {
            id: "message_1",
            conversationId: "conversation_1",
            kind: "text",
            content: "<p>Hello</p>",
            mentionUserIds: [],
            reactions: [],
            createdBy: "user_1",
            createdAt: "2026-04-01T00:00:00.000Z",
            callId: null,
          },
        ],
        channelPosts: [],
        channelPostComments: [],
        ui: {
          activeTeamId: "team_1",
          activeInboxNotificationId: "notification_1",
          selectedViewByRoute: {
            "/workspace/items": "view_1",
          },
          viewerViewConfigByRoute: {},
          viewerDirectoryConfigByRoute: {},
          activeCreateDialog: null,
        },
      },
      "team_1"
    )

    expectOnlyTeam2Access(nextState)
    expect(nextState.projects).toHaveLength(0)
    expect(nextState.workItems).toHaveLength(0)
    expect(nextState.documents).toHaveLength(0)
    expect(nextState.conversations).toHaveLength(0)
    expect(nextState.notifications).toHaveLength(0)
    expect(nextState.ui.activeTeamId).toBe("team_2")
    expect(nextState.ui.activeInboxNotificationId).toBeNull()
    expect(nextState.ui.selectedViewByRoute).toEqual({})
  })

  it("cleans retained cross-links and all deleted notification entity types after team removal", () => {
    const state = createTestAppData({
      teams: [
        createTestTeam(),
        createTestTeam({
          id: "team_2",
          slug: "design",
          name: "Design",
        }),
      ],
      teamMemberships: [
        createTestTeamMembership(),
        createTestTeamMembership({
          teamId: "team_2",
        }),
      ],
      projects: [
        createTestProject({
          id: "project_1",
          scopeId: "team_1",
        }),
        createTestProject({
          id: "project_2",
          scopeId: "team_2",
        }),
      ],
      milestones: [
        {
          id: "milestone_1",
          projectId: "project_1",
          name: "Milestone",
          targetDate: null,
          status: "todo",
        },
      ],
      workItems: [
        createTestWorkItem("deleted", {
          teamId: "team_1",
          descriptionDocId: "document_1",
        }),
        createTestWorkItem("kept", {
          teamId: "team_2",
          primaryProjectId: "project_1",
          linkedProjectIds: ["project_1", "project_2"],
          linkedDocumentIds: ["document_1"],
          milestoneId: "milestone_1",
        }),
      ],
      documents: [
        createTestDocument({
          id: "document_1",
          teamId: "team_1",
          linkedProjectIds: ["project_1"],
        }),
        createTestDocument({
          id: "document_2",
          teamId: "team_2",
          linkedProjectIds: ["project_1", "project_2"],
        }),
      ],
      invites: [
        {
          id: "invite_1",
          workspaceId: "workspace_1",
          teamId: "team_1",
          email: "pat@example.com",
          role: "member",
          token: "invite_1",
          joinCode: "JOIN1234",
          invitedBy: "user_1",
          expiresAt: "2026-05-01T00:00:00.000Z",
          acceptedAt: null,
        },
      ],
      conversations: [
        {
          id: "conversation_1",
          kind: "channel",
          scopeType: "team",
          scopeId: "team_1",
          variant: "team",
          title: "Platform",
          description: "",
          participantIds: ["user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          lastActivityAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      channelPosts: [
        {
          id: "post_1",
          conversationId: "conversation_1",
          title: "Post",
          content: "<p>Post</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      notifications: [
        ["notification_team", "team", "team_1"],
        ["notification_project", "project", "project_1"],
        ["notification_work_item", "workItem", "deleted"],
        ["notification_document", "document", "document_1"],
        ["notification_invite", "invite", "invite_1"],
        ["notification_chat", "chat", "conversation_1"],
        ["notification_channel_post", "channelPost", "post_1"],
        ["notification_kept", "project", "project_2"],
      ].map(([id, entityType, entityId]) => ({
        id,
        userId: "user_1",
        type: "message" as const,
        entityType: entityType as never,
        entityId,
        actorId: "user_1",
        message: "Updated",
        readAt: null,
        archivedAt: null,
        emailedAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
      })),
      ui: {
        ...createTestAppData().ui,
        activeTeamId: "team_1",
        activeInboxNotificationId: "notification_channel_post",
      },
    })

    const nextState = getNextStateAfterTeamRemoval(state, "team_1")
    const keptItem = nextState.workItems.find((item) => item.id === "kept")
    const keptDocument = nextState.documents.find(
      (document) => document.id === "document_2"
    )

    expect(keptItem).toMatchObject({
      primaryProjectId: null,
      linkedProjectIds: ["project_2"],
      linkedDocumentIds: [],
      milestoneId: null,
    })
    expect(keptDocument?.linkedProjectIds).toEqual(["project_2"])
    expect(nextState.notifications.map((notification) => notification.id)).toEqual([
      "notification_kept",
    ])
    expect(nextState.ui.activeInboxNotificationId).toBeNull()
  })

  it("recomputes affected workspace memberships after team removal", () => {
    const baseState = createEmptyState()
    const nextState = getNextStateAfterTeamRemoval(
      {
        ...baseState,
        currentUserId: "user_owner",
        currentWorkspaceId: "workspace_1",
        workspaces: [
          {
            id: "workspace_1",
            slug: "alpha",
            name: "Alpha",
            logoUrl: "",
            logoImageUrl: null,
            createdBy: "user_owner",
            workosOrganizationId: "org_1",
            settings: {
              accent: "emerald",
              description: "Alpha workspace",
            },
          },
        ],
        teams: [
          buildLocalTeamCreateState({
            currentUserId: "user_owner",
            workspaceId: "workspace_1",
            teamId: "team_1",
            teamSlug: "platform",
            joinCode: "JOIN1234",
            name: "Platform",
            icon: "robot",
            summary: "Platform",
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
          }).team,
          buildLocalTeamCreateState({
            currentUserId: "user_owner",
            workspaceId: "workspace_1",
            teamId: "team_2",
            teamSlug: "design",
            joinCode: "JOIN5678",
            name: "Design",
            icon: "users",
            summary: "Design",
            experience: "project-management",
            features: createDefaultTeamFeatureSettings("project-management"),
          }).team,
        ],
        teamMemberships: [
          {
            teamId: "team_1",
            userId: "user_2",
            role: "admin",
          },
          {
            teamId: "team_2",
            userId: "user_2",
            role: "member",
          },
          {
            teamId: "team_1",
            userId: "user_3",
            role: "member",
          },
        ],
        workspaceMemberships: [
          {
            workspaceId: "workspace_1",
            userId: "user_2",
            role: "admin",
          },
        ],
      },
      "team_1"
    )

    expect(nextState.workspaceMemberships).toEqual(
      expect.arrayContaining([
        {
          workspaceId: "workspace_1",
          userId: "user_2",
          role: "member",
        },
        {
          workspaceId: "workspace_1",
          userId: "user_3",
          role: "viewer",
        },
      ])
    )
  })

  it("removes workspace-scoped entities and falls back to the next workspace", () => {
    const baseState = createEmptyState()
    const nextState = getNextStateAfterWorkspaceRemoval(
      {
        ...baseState,
        currentUserId: "user_1",
        currentWorkspaceId: "workspace_1",
        workspaces: [
          {
            id: "workspace_1",
            slug: "alpha",
            name: "Alpha",
            logoUrl: "",
            logoImageUrl: null,
            createdBy: "user_1",
            workosOrganizationId: "org_1",
            settings: {
              accent: "emerald",
              description: "Alpha",
            },
          },
          {
            id: "workspace_2",
            slug: "beta",
            name: "Beta",
            logoUrl: "",
            logoImageUrl: null,
            createdBy: "user_1",
            workosOrganizationId: "org_2",
            settings: {
              accent: "blue",
              description: "Beta",
            },
          },
        ],
        teams: [
          buildLocalTeamCreateState({
            currentUserId: "user_1",
            workspaceId: "workspace_1",
            teamId: "team_1",
            teamSlug: "platform",
            joinCode: "JOIN1234",
            name: "Platform",
            icon: "robot",
            summary: "Platform",
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
          }).team,
          buildLocalTeamCreateState({
            currentUserId: "user_1",
            workspaceId: "workspace_2",
            teamId: "team_2",
            teamSlug: "ops",
            joinCode: "JOIN5678",
            name: "Ops",
            icon: "briefcase",
            summary: "Ops",
            experience: "project-management",
            features: createDefaultTeamFeatureSettings("project-management"),
          }).team,
        ],
        teamMemberships: [
          {
            teamId: "team_1",
            userId: "user_1",
            role: "admin",
          },
          {
            teamId: "team_2",
            userId: "user_1",
            role: "admin",
          },
        ],
        labels: [
          {
            id: "label_1",
            workspaceId: "workspace_1",
            name: "Bug",
            color: "red",
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
      },
      "workspace_1"
    )

    expect(nextState.currentWorkspaceId).toBe("workspace_2")
    expect(nextState.workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace_2",
    ])
    expectOnlyTeam2Access(nextState)
    expect(nextState.labels).toHaveLength(0)
    expect(nextState.ui.activeTeamId).toBe("team_2")
  })

  it("removes a project and clears dependent local references", () => {
    const baseState = createEmptyState()
    const state = {
      ...baseState,
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      teams: [
        buildLocalTeamCreateState({
          currentUserId: "user_1",
          workspaceId: "workspace_1",
          teamId: "team_1",
          teamSlug: "platform",
          joinCode: "JOIN1234",
          name: "Platform",
          icon: "robot",
          summary: "Platform",
          experience: "software-development",
          features: createDefaultTeamFeatureSettings("software-development"),
        }).team,
      ],
      projects: [
        {
          id: "project_1",
          scopeType: "team" as const,
          scopeId: "team_1",
          templateType: "software-delivery" as const,
          name: "Launch",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track" as const,
          priority: "high" as const,
          status: "in-progress" as const,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "project_2",
          scopeType: "workspace" as const,
          scopeId: "workspace_1",
          templateType: "project-management" as const,
          name: "Keep",
          summary: "",
          description: "",
          leadId: "user_1",
          memberIds: ["user_1"],
          health: "on-track" as const,
          priority: "medium" as const,
          status: "planned" as const,
          startDate: null,
          targetDate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      milestones: [
        {
          id: "milestone_1",
          projectId: "project_1",
          name: "Remove milestone",
          targetDate: null,
          status: "todo" as const,
        },
        {
          id: "milestone_2",
          projectId: "project_2",
          name: "Keep milestone",
          targetDate: null,
          status: "todo" as const,
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "PLA-1",
          teamId: "team_1",
          type: "task" as const,
          title: "Affected",
          descriptionDocId: "doc_1",
          status: "todo" as const,
          priority: "medium" as const,
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_1",
          linkedProjectIds: ["project_1", "project_2"],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: "milestone_1",
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "item_2",
          key: "PLA-2",
          teamId: "team_1",
          type: "task" as const,
          title: "Unrelated",
          descriptionDocId: "doc_2",
          status: "todo" as const,
          priority: "medium" as const,
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: "project_2",
          linkedProjectIds: ["project_2"],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: "milestone_2",
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      documents: [
        {
          id: "doc_1",
          kind: "team-document" as const,
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Affected doc",
          content: "<p>Doc</p>",
          linkedProjectIds: ["project_1", "project_2"],
          linkedWorkItemIds: ["item_1"],
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      views: [
        {
          id: "project_items_view",
          name: "Project board",
          description: "",
          scopeType: "team" as const,
          scopeId: "team_1",
          entityKind: "items" as const,
          layout: "board" as const,
          containerType: "project-items" as const,
          containerId: "project_1",
          filters: {
            status: [],
            priority: [],
            assigneeIds: [],
            creatorIds: [],
            leadIds: [],
            health: [],
            milestoneIds: ["milestone_1"],
            relationTypes: [],
            projectIds: ["project_1"],
            itemTypes: [],
            labelIds: [],
            teamIds: ["team_1"],
            showCompleted: false,
          },
          grouping: "status" as const,
          subGrouping: null,
          ordering: "updatedAt" as const,
          displayProps: ["status"],
          hiddenState: { groups: [], subgroups: [] },
          isShared: true,
          route: "/team/platform/projects/project_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "team_detail_view",
          name: "Project detail",
          description: "",
          scopeType: "team" as const,
          scopeId: "team_1",
          entityKind: "items" as const,
          layout: "list" as const,
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
            itemTypes: [],
            labelIds: [],
            teamIds: [],
            showCompleted: false,
          },
          grouping: null,
          subGrouping: null,
          ordering: "updatedAt" as const,
          displayProps: [],
          hiddenState: { groups: [], subgroups: [] },
          isShared: true,
          route: "/team/platform/projects/project_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "kept_view",
          name: "Kept view",
          description: "",
          scopeType: "team" as const,
          scopeId: "team_1",
          entityKind: "items" as const,
          layout: "list" as const,
          filters: {
            status: [],
            priority: [],
            assigneeIds: [],
            creatorIds: [],
            leadIds: [],
            health: [],
            milestoneIds: ["milestone_1", "milestone_2"],
            relationTypes: [],
            projectIds: ["project_1", "project_2"],
            itemTypes: [],
            labelIds: [],
            teamIds: ["team_1"],
            showCompleted: false,
          },
          grouping: null,
          subGrouping: null,
          ordering: "updatedAt" as const,
          displayProps: [],
          hiddenState: { groups: [], subgroups: [] },
          isShared: true,
          route: "/team/platform/work",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      notifications: [
        {
          id: "project_notification",
          userId: "user_1",
          type: "project-update" as const,
          entityType: "project" as const,
          entityId: "project_1",
          actorId: "user_1",
          message: "Project updated",
          readAt: null,
          archivedAt: null,
          emailedAt: null,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "kept_notification",
          userId: "user_1",
          type: "project-update" as const,
          entityType: "project" as const,
          entityId: "project_2",
          actorId: "user_1",
          message: "Other project updated",
          readAt: null,
          archivedAt: null,
          emailedAt: null,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      projectUpdates: [
        {
          id: "update_1",
          projectId: "project_1",
          content: "<p>Remove</p>",
          createdBy: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "update_2",
          projectId: "project_2",
          content: "<p>Keep</p>",
          createdBy: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      ui: {
        ...baseState.ui,
        selectedViewByRoute: {
          "/team/platform/projects/project_1": "team_detail_view",
          "/team/platform/work": "kept_view",
        },
      },
    }

    const nextState = getNextStateAfterProjectRemoval(state as never, "project_1")

    expect(nextState.projects.map((project) => project.id)).toEqual(["project_2"])
    expect(nextState.milestones.map((milestone) => milestone.id)).toEqual([
      "milestone_2",
    ])
    expect(nextState.workItems).toEqual([
      expect.objectContaining({
        id: "item_1",
        primaryProjectId: null,
        linkedProjectIds: ["project_2"],
        milestoneId: null,
      }),
      expect.objectContaining({
        id: "item_2",
        primaryProjectId: "project_2",
        linkedProjectIds: ["project_2"],
        milestoneId: "milestone_2",
      }),
    ])
    expect(nextState.documents[0]).toMatchObject({
      id: "doc_1",
      linkedProjectIds: ["project_2"],
    })
    expect(nextState.views.map((view) => view.id)).toEqual(["kept_view"])
    expect(nextState.views[0]?.filters.projectIds).toEqual(["project_2"])
    expect(nextState.views[0]?.filters.milestoneIds).toEqual(["milestone_2"])
    expect(nextState.notifications.map((notification) => notification.id)).toEqual([
      "kept_notification",
    ])
    expect(nextState.projectUpdates.map((update) => update.id)).toEqual([
      "update_2",
    ])
    expect(nextState.ui.selectedViewByRoute).toEqual({
      "/team/platform/work": "kept_view",
    })
  })

  it("leaves local state unchanged when removing an unknown project", () => {
    const state = createEmptyState()

    expect(getNextStateAfterProjectRemoval(state, "missing_project")).toBe(state)
  })
})
