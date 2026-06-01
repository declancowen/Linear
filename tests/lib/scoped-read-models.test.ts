import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"
import { isWorkspaceMembershipInvite } from "@/lib/scoped-sync/invite-selection"
import {
  getCustomPropertyDefinitionScopeKeys,
  getDocumentDetailScopeKeys,
  getConversationRelatedScopeKeys,
  getProjectDetailScopeKeys,
  getProjectRelatedScopeKeys,
  getWorkItemDetailScopeKeys,
  getWorkspacePeopleScopeKeys,
  selectDocumentDetailReadModel,
  selectDocumentIndexReadModel,
  selectProjectDetailReadModel,
  selectProjectIndexReadModel,
  selectViewCatalogReadModel,
  selectWorkspacePeopleReadModel,
  selectWorkItemDetailReadModel,
  selectWorkIndexReadModel,
} from "@/lib/scoped-sync/read-models"
import {
  createScopedReadModelProject,
  createScopedReadModelTeam,
  createScopedReadModelUser,
  createScopedReadModelView,
} from "@/tests/lib/fixtures/scoped-read-models"

function createSnapshotFixture(): AppSnapshot {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    workspaces: [
      {
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace 1",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_1",
        workosOrganizationId: null,
        settings: {
          accent: "indigo",
          description: "",
        },
      },
    ],
    teams: [createScopedReadModelTeam()],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
      {
        teamId: "team_1",
        userId: "user_2",
        role: "member",
      },
    ],
    users: [
      createScopedReadModelUser(),
      createScopedReadModelUser({
        id: "user_2",
        handle: "sam",
        email: "sam@example.com",
        name: "Sam",
      }),
    ],
    labels: [
      {
        id: "label_1",
        workspaceId: "workspace_1",
        name: "Bug",
        color: "red",
      },
    ],
    projects: [
      createScopedReadModelProject({
        memberIds: ["user_2"],
      }),
    ],
    milestones: [
      {
        id: "milestone_1",
        projectId: "project_1",
        name: "M1",
        status: "todo",
        targetDate: null,
      },
    ],
    workItems: [
      {
        id: "item_1",
        key: "TEAM-1",
        teamId: "team_1",
        type: "story",
        title: "Investigate",
        descriptionDocId: "doc_description",
        status: "todo",
        priority: "medium",
        assigneeId: "user_2",
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: "project_1",
        linkedProjectIds: [],
        linkedDocumentIds: ["doc_linked"],
        labelIds: ["label_1"],
        milestoneId: "milestone_1",
        startDate: null,
        dueDate: null,
        targetDate: null,
        subscriberIds: [],
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    documents: [
      {
        id: "doc_1",
        kind: "team-document",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Spec",
        content: "<p>Hello</p>",
        linkedProjectIds: ["project_1"],
        linkedWorkItemIds: [],
        createdBy: "user_1",
        updatedBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "doc_description",
        kind: "item-description",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Item Description",
        content: "<p>Desc</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: ["item_1"],
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "doc_linked",
        kind: "team-document",
        workspaceId: "workspace_1",
        teamId: "team_1",
        title: "Linked",
        content: "<p>Linked</p>",
        linkedProjectIds: [],
        linkedWorkItemIds: ["item_1"],
        createdBy: "user_2",
        updatedBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    views: [
      createScopedReadModelView({
        containerType: "project-items",
        containerId: "project_1",
      }),
    ],
    comments: [
      {
        id: "comment_1",
        targetType: "document",
        targetId: "doc_1",
        parentCommentId: null,
        content: "<p>Comment</p>",
        createdBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        mentionUserIds: [],
        reactions: [],
      },
      {
        id: "comment_2",
        targetType: "workItem",
        targetId: "item_1",
        parentCommentId: null,
        content: "<p>Comment</p>",
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        mentionUserIds: [],
        reactions: [],
      },
    ],
    attachments: [
      {
        id: "attachment_1",
        targetType: "document",
        targetId: "doc_1",
        teamId: "team_1",
        storageId: "storage_1",
        uploadedBy: "user_1",
        fileName: "doc.txt",
        fileUrl: "https://example.com/doc.txt",
        contentType: "text/plain",
        size: 10,
        createdAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "attachment_2",
        targetType: "workItem",
        targetId: "item_1",
        teamId: "team_1",
        storageId: "storage_2",
        uploadedBy: "user_2",
        fileName: "item.txt",
        fileUrl: "https://example.com/item.txt",
        contentType: "text/plain",
        size: 10,
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    projectUpdates: [
      {
        id: "update_1",
        projectId: "project_1",
        content: "<p>Done</p>",
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ],
  } as unknown as AppSnapshot
}

function addCrossWorkspaceTeamFixture(snapshot: AppSnapshot) {
  snapshot.workspaces.push({
    id: "workspace_2",
    slug: "workspace-2",
    name: "Workspace 2",
    logoUrl: "",
    logoImageUrl: null,
    createdBy: "user_1",
    workosOrganizationId: null,
    settings: {
      accent: "green",
      description: "",
    },
  })
  snapshot.teams.push(
    createScopedReadModelTeam({
      id: "team_2",
      slug: "team-2",
      name: "Team 2",
    }),
    createScopedReadModelTeam({
      id: "team_3",
      workspaceId: "workspace_2",
      slug: "team-3",
      name: "Team 3",
    })
  )
  snapshot.teamMemberships.push(
    {
      teamId: "team_2",
      userId: "user_2",
      role: "member",
    },
    {
      teamId: "team_3",
      userId: "user_1",
      role: "member",
    }
  )
}

describe("scoped read model selectors", () => {
  it("selects the document detail subset", () => {
    const snapshot = createSnapshotFixture()
    const patch = selectDocumentDetailReadModel(snapshot, "doc_1")

    expect(patch).toMatchObject({
      documents: [{ id: "doc_1" }],
      comments: [{ id: "comment_1" }],
      attachments: [{ id: "attachment_1" }],
    })
    expect(patch?.users?.map((user) => user.id).sort()).toEqual([
      "user_1",
      "user_2",
    ])
    expect(getDocumentDetailScopeKeys("doc_1")).toEqual([
      "document-detail:doc_1",
    ])
  })

  it("selects the document index subset with linked entity label dependencies", () => {
    const snapshot = createSnapshotFixture()
    const patch = selectDocumentIndexReadModel(snapshot, "team", "team_1")

    expect(patch).toMatchObject({
      documents: [{ id: "doc_1" }, { id: "doc_linked" }],
      projects: [{ id: "project_1" }],
      workItems: [{ id: "item_1" }],
      teams: [{ id: "team_1" }],
    })
  })

  it("limits workspace project indexes to teams the current user can access", () => {
    const snapshot = createSnapshotFixture()
    addCrossWorkspaceTeamFixture(snapshot)
    snapshot.projects.push(
      createScopedReadModelProject({
        id: "project_2",
        scopeId: "team_2",
        name: "Inaccessible Team Project",
      }),
      createScopedReadModelProject({
        id: "project_3",
        scopeType: "workspace",
        scopeId: "workspace_1",
        name: "Workspace Project",
      })
    )
    snapshot.workItems.push(
      {
        ...snapshot.workItems[0],
        id: "item_2",
        key: "TEAM-2",
        teamId: "team_2",
        primaryProjectId: "project_2",
        linkedProjectIds: [],
      },
      {
        ...snapshot.workItems[0],
        id: "item_3",
        key: "TEAM-3",
        teamId: "team_2",
        primaryProjectId: "project_3",
        linkedProjectIds: [],
      },
      {
        ...snapshot.workItems[0],
        id: "item_4",
        key: "TEAM-4",
        primaryProjectId: "project_3",
        linkedProjectIds: [],
      },
      {
        ...snapshot.workItems[0],
        id: "item_5",
        key: "TEAM-5",
        teamId: "team_3",
        primaryProjectId: "project_3",
        linkedProjectIds: [],
      }
    )

    const patch = selectProjectIndexReadModel(
      snapshot,
      "workspace",
      "workspace_1"
    )

    expect(patch.projects?.map((project) => project.id).sort()).toEqual([
      "project_1",
      "project_3",
    ])
    expect(patch.teams?.map((team) => team.id)).toEqual(["team_1"])
    expect(patch.workItems?.map((item) => item.id).sort()).toEqual([
      "item_1",
      "item_4",
    ])
  })

  it("limits workspace view catalogs to teamspace views the current user can access", () => {
    const snapshot = createSnapshotFixture()
    addCrossWorkspaceTeamFixture(snapshot)
    snapshot.views = [
      createScopedReadModelView({
        id: "workspace_view",
        scopeType: "workspace",
        scopeId: "workspace_1",
      }),
      createScopedReadModelView({
        id: "accessible_team_view",
        scopeType: "team",
        scopeId: "team_1",
      }),
      createScopedReadModelView({
        id: "inaccessible_team_view",
        scopeType: "team",
        scopeId: "team_2",
      }),
      createScopedReadModelView({
        id: "other_workspace_team_view",
        scopeType: "team",
        scopeId: "team_3",
      }),
    ]

    const patch = selectViewCatalogReadModel(
      snapshot,
      "workspace",
      "workspace_1"
    )

    expect(patch.views?.map((view) => view.id).sort()).toEqual([
      "accessible_team_view",
      "workspace_view",
    ])
    expect(patch.teams?.map((team) => team.id)).toEqual(["team_1"])
  })

  it("selects the work item detail subset and related project scopes", () => {
    const snapshot = createSnapshotFixture()
    snapshot.workItemActivities.push({
      id: "activity_1",
      itemId: "item_1",
      actorId: "user_2",
      type: "status-change",
      fromStatus: "todo",
      toStatus: "done",
      createdAt: "2026-04-22T01:00:00.000Z",
    })
    const patch = selectWorkItemDetailReadModel(snapshot, "item_1")

    expect(patch).toMatchObject({
      workItems: [{ id: "item_1" }],
      workItemActivities: [{ id: "activity_1" }],
      documents: [{ id: "doc_description" }, { id: "doc_linked" }],
      comments: [{ id: "comment_2" }],
      attachments: [{ id: "attachment_2" }],
      projects: [{ id: "project_1" }],
      milestones: [{ id: "milestone_1" }],
      labels: [{ id: "label_1" }],
    })
    expect(getWorkItemDetailScopeKeys(snapshot, "item_1").sort()).toEqual([
      "document-index:team_team_1",
      "project-detail:project_1",
      "project-index:team_team_1",
      "search-seed:workspace_1",
      "work-index:personal_user_1",
      "work-index:personal_user_2",
      "work-index:team_team_1",
      "work-item-detail:item_1",
      "workspace-people:workspace_1",
    ])
  })

  it("filters custom property values to definitions visible in the read model", () => {
    const snapshot = createSnapshotFixture()

    snapshot.customPropertyDefinitions = [
      {
        id: "property_team",
        workspaceId: "workspace_1",
        teamId: "team_1",
        scopeType: "team",
        targetType: "workItem",
        name: "Team field",
        icon: "Tag",
        type: "text",
        options: [],
        isArchived: false,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "property_private_own",
        workspaceId: "workspace_1",
        teamId: "team_1",
        scopeType: "private",
        ownerId: "user_1",
        targetType: "workItem",
        name: "My field",
        icon: "Lock",
        type: "text",
        options: [],
        isArchived: false,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "property_private_other",
        workspaceId: "workspace_1",
        teamId: "team_1",
        scopeType: "private",
        ownerId: "user_2",
        targetType: "workItem",
        name: "Other field",
        icon: "Lock",
        type: "text",
        options: [],
        isArchived: false,
        createdBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ] as never
    snapshot.customPropertyValues = [
      {
        id: "value_team",
        workspaceId: "workspace_1",
        teamId: "team_1",
        workItemId: "item_1",
        propertyId: "property_team",
        value: "team",
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "value_private_own",
        workspaceId: "workspace_1",
        teamId: "team_1",
        workItemId: "item_1",
        propertyId: "property_private_own",
        value: "mine",
        createdBy: "user_1",
        updatedBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "value_private_other",
        workspaceId: "workspace_1",
        teamId: "team_1",
        workItemId: "item_1",
        propertyId: "property_private_other",
        value: "hidden",
        createdBy: "user_2",
        updatedBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ] as never

    const personalWorkIndex = selectWorkIndexReadModel(
      snapshot,
      "personal",
      "user_1"
    )
    const workItemDetail = selectWorkItemDetailReadModel(snapshot, "item_1")

    expect(
      personalWorkIndex.customPropertyDefinitions?.map((entry) => entry.id)
    ).toEqual(["property_team"])
    expect(
      personalWorkIndex.customPropertyValues?.map((entry) => entry.id)
    ).toEqual(["value_team"])
    expect(
      workItemDetail?.customPropertyValues?.map((entry) => entry.id)
    ).toEqual(["value_team"])
  })

  it("scopes private work indexes and invalidations to the creator", () => {
    const snapshot = createSnapshotFixture()

    snapshot.workItems.push(
      {
        ...snapshot.workItems[0],
        id: "item_private_own",
        key: "PRV-1",
        title: "Owned private task",
        descriptionDocId: "doc_private_own",
        assigneeId: null,
        creatorId: "user_1",
        visibility: "private",
      },
      {
        ...snapshot.workItems[0],
        id: "item_private_assigned_by_other",
        key: "PRV-2",
        title: "Assigned private task",
        descriptionDocId: "doc_private_assigned_by_other",
        assigneeId: "user_1",
        creatorId: "user_2",
        visibility: "private",
      }
    )

    expect(
      selectWorkIndexReadModel(snapshot, "personal", "user_1").workItems?.map(
        (entry) => entry.id
      )
    ).toEqual(["item_1", "item_private_own"])
    expect(getWorkItemDetailScopeKeys(snapshot, "item_private_own")).toEqual([
      "work-item-detail:item_private_own",
      "work-index:personal_user_1",
    ])
  })

  it("fails closed for invalid private detail rows without a workspace", () => {
    const snapshot = createSnapshotFixture()
    snapshot.workItems = [
      {
        ...snapshot.workItems[0],
        id: "private_parent",
        key: "PVT-001",
        title: "Private parent",
        descriptionDocId: "doc_private_parent",
        teamId: "team_1",
        workspaceId: null,
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: null,
        linkedProjectIds: [],
        linkedDocumentIds: [],
        visibility: "private",
      },
      {
        ...snapshot.workItems[0],
        id: "private_child",
        key: "PVT-002",
        title: "Private child",
        descriptionDocId: "doc_private_child",
        teamId: "team_1",
        workspaceId: null,
        assigneeId: null,
        creatorId: "user_1",
        parentId: "private_parent",
        primaryProjectId: null,
        linkedProjectIds: [],
        linkedDocumentIds: [],
        visibility: "private",
      },
      {
        ...snapshot.workItems[0],
        id: "private_other_workspace",
        key: "PVT-003",
        title: "Private other workspace",
        descriptionDocId: "doc_private_other_workspace",
        teamId: null,
        workspaceId: "workspace_2",
        assigneeId: null,
        creatorId: "user_1",
        parentId: null,
        primaryProjectId: null,
        linkedProjectIds: [],
        linkedDocumentIds: [],
        visibility: "private",
      },
    ]

    const patch = selectWorkItemDetailReadModel(snapshot, "private_parent")

    expect(patch?.workItems?.map((item) => item.id)).toEqual(["private_parent"])
  })

  it("invalidates document indexes for linked project and work item labels", () => {
    const snapshot = createSnapshotFixture()

    expect(getProjectRelatedScopeKeys(snapshot, "project_1").sort()).toEqual([
      "document-index:team_team_1",
      "project-detail:project_1",
      "project-index:team_team_1",
      "search-seed:workspace_1",
      "workspace-people:workspace_1",
    ])
    expect(getWorkItemDetailScopeKeys(snapshot, "item_1")).toContain(
      "document-index:team_team_1"
    )
  })

  it("selects a workspace people read model without direct chat messages", () => {
    const snapshot = createSnapshotFixture()
    snapshot.conversations = [
      {
        id: "channel_1",
        kind: "channel",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "team",
        title: "General",
        description: "",
        participantIds: [],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        lastActivityAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "chat_1",
        kind: "chat",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "direct",
        title: "Direct",
        description: "",
        participantIds: ["user_1", "user_2"],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        lastActivityAt: "2026-04-22T00:00:00.000Z",
      },
    ]
    snapshot.channelPosts = [
      {
        id: "post_1",
        conversationId: "channel_1",
        title: "Launch",
        content: "We shipped",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ]
    snapshot.channelPostComments = [
      {
        id: "post_comment_1",
        postId: "post_1",
        content: "Nice",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ]
    snapshot.chatMessages = [
      {
        id: "message_1",
        conversationId: "chat_1",
        kind: "text",
        content: "Private chat",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-22T00:00:00.000Z",
      },
    ]

    const patch = selectWorkspacePeopleReadModel(snapshot, "workspace_1")

    expect(patch).toMatchObject({
      workspaces: [{ id: "workspace_1" }],
      teams: [{ id: "team_1" }],
      users: [{ id: "user_1" }, { id: "user_2" }],
      workItems: [{ id: "item_1" }],
      documents: [{ id: "doc_1" }, { id: "doc_linked" }],
      comments: [{ id: "comment_1" }, { id: "comment_2" }],
      projects: [{ id: "project_1" }],
      projectUpdates: [{ id: "update_1" }],
      conversations: [{ id: "channel_1" }],
      channelPosts: [{ id: "post_1" }],
      channelPostComments: [{ id: "post_comment_1" }],
    })
    expect(patch?.chatMessages).toBeUndefined()
    expect(getWorkspacePeopleScopeKeys("workspace_1")).toEqual([
      "workspace-people:workspace_1",
    ])
  })

  it("resolves custom property definition invalidations for indexes, details, and view catalogs", () => {
    const snapshot = createSnapshotFixture()

    expect(
      getCustomPropertyDefinitionScopeKeys(snapshot, "team_1").sort()
    ).toEqual([
      "project-detail:project_1",
      "project-index:team_team_1",
      "project-index:workspace_workspace_1",
      "view-catalog:team_team_1",
      "view-catalog:workspace_workspace_1",
      "work-index:personal_user_1",
      "work-index:personal_user_2",
      "work-index:team_team_1",
      "work-index:workspace_workspace_1",
      "work-item-detail:item_1",
    ])
  })

  it("selects the project detail subset", () => {
    const snapshot = createSnapshotFixture()
    const patch = selectProjectDetailReadModel(snapshot, "project_1")

    expect(patch).toMatchObject({
      projects: [{ id: "project_1" }],
      teams: [{ id: "team_1" }],
      workspaces: [{ id: "workspace_1" }],
      workItems: [{ id: "item_1" }],
      milestones: [{ id: "milestone_1" }],
      projectUpdates: [{ id: "update_1" }],
      documents: [{ id: "doc_1" }],
      views: [{ id: "view_1" }],
      teamMemberships: [
        { teamId: "team_1", userId: "user_1" },
        { teamId: "team_1", userId: "user_2" },
      ],
    })
    expect(getProjectDetailScopeKeys("project_1")).toEqual([
      "project-detail:project_1",
    ])
  })

  it("includes item team context for workspace project detail subsets", () => {
    const snapshot = createSnapshotFixture()
    snapshot.teams.push(
      createScopedReadModelTeam({
        id: "team_2",
        slug: "team-2",
        name: "Team 2",
      })
    )
    snapshot.teamMemberships.push({
      teamId: "team_2",
      userId: "user_1",
      role: "member",
    })
    snapshot.projects.push(
      createScopedReadModelProject({
        id: "project_2",
        scopeType: "workspace",
        scopeId: "workspace_1",
        name: "Workspace Project",
      })
    )
    snapshot.workItems.push({
      ...snapshot.workItems[0],
      id: "item_2",
      key: "TEAM-2",
      teamId: "team_2",
      primaryProjectId: "project_2",
      linkedProjectIds: [],
    })

    const patch = selectProjectDetailReadModel(snapshot, "project_2")

    expect(patch).toMatchObject({
      projects: [{ id: "project_2" }],
      teams: [{ id: "team_2" }],
      workspaces: [{ id: "workspace_1" }],
      workItems: [{ id: "item_2" }],
    })
  })

  it("selects workspace membership invites by workspace or pending user email", () => {
    const snapshot = createSnapshotFixture()
    const [workspaceInvite, pendingInvite, declinedInvite] = [
      {
        workspaceId: "workspace_1",
        email: "other@example.com",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        workspaceId: "workspace_2",
        email: "alex@example.com",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        workspaceId: "workspace_2",
        email: "alex@example.com",
        acceptedAt: null,
        declinedAt: "2026-04-22T00:00:00.000Z",
      },
    ] as AppSnapshot["invites"]

    expect(
      isWorkspaceMembershipInvite(
        workspaceInvite,
        "workspace_1",
        "alex@example.com"
      )
    ).toBe(true)
    expect(
      isWorkspaceMembershipInvite(
        pendingInvite,
        "workspace_1",
        "alex@example.com"
      )
    ).toBe(true)
    expect(
      isWorkspaceMembershipInvite(
        declinedInvite,
        "workspace_1",
        "alex@example.com"
      )
    ).toBe(false)
    expect(snapshot.currentWorkspaceId).toBe("workspace_1")
  })

  it("resolves conversation-related scope keys for team and workspace conversations", () => {
    const snapshot = createSnapshotFixture()

    snapshot.conversations = [
      {
        id: "conversation_team",
        kind: "chat",
        scopeType: "team",
        scopeId: "team_1",
        variant: "team",
        title: "Platform",
        description: "",
        participantIds: ["user_2"],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        lastActivityAt: "2026-04-22T00:00:00.000Z",
      },
      {
        id: "conversation_workspace",
        kind: "channel",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "team",
        title: "General",
        description: "",
        participantIds: [],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        lastActivityAt: "2026-04-22T00:00:00.000Z",
      },
    ]
    snapshot.workspaces = [
      {
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_3",
        workosOrganizationId: null,
        settings: {
          accent: "emerald",
          description: "",
        },
      },
    ]

    expect(
      getConversationRelatedScopeKeys(snapshot, "conversation_team").sort()
    ).toContain("conversation-thread:conversation_team")
    expect(
      getConversationRelatedScopeKeys(snapshot, "conversation_workspace").sort()
    ).toContain("conversation-list:user_3")
    expect(
      getConversationRelatedScopeKeys(snapshot, "conversation_workspace").sort()
    ).toContain("workspace-people:workspace_1")
    expect(getConversationRelatedScopeKeys(snapshot, "missing")).toEqual([])
  })
})
