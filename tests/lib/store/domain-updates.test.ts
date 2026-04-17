import { createEmptyState } from "@/lib/domain/empty-state"
import { createDefaultTeamFeatureSettings } from "@/lib/domain/types"
import {
  buildLocalTeamCreateState,
  getNextStateAfterTeamRemoval,
  getNextStateAfterWorkspaceRemoval,
} from "@/lib/store/app-store-internal/domain-updates"

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
            status: "active",
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
        },
      },
      "team_1"
    )

    expect(nextState.teams.map((team) => team.id)).toEqual(["team_2"])
    expect(nextState.teamMemberships.map((membership) => membership.teamId)).toEqual([
      "team_2",
    ])
    expect(nextState.projects).toHaveLength(0)
    expect(nextState.workItems).toHaveLength(0)
    expect(nextState.documents).toHaveLength(0)
    expect(nextState.conversations).toHaveLength(0)
    expect(nextState.notifications).toHaveLength(0)
    expect(nextState.ui.activeTeamId).toBe("team_2")
    expect(nextState.ui.activeInboxNotificationId).toBeNull()
    expect(nextState.ui.selectedViewByRoute).toEqual({})
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
        },
      },
      "workspace_1"
    )

    expect(nextState.currentWorkspaceId).toBe("workspace_2")
    expect(nextState.workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace_2",
    ])
    expect(nextState.teams.map((team) => team.id)).toEqual(["team_2"])
    expect(nextState.teamMemberships.map((membership) => membership.teamId)).toEqual([
      "team_2",
    ])
    expect(nextState.labels).toHaveLength(0)
    expect(nextState.ui.activeTeamId).toBe("team_2")
  })
})
