import { describe, expect, it } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"
import { isWorkspaceMembershipInvite } from "@/lib/scoped-sync/invite-selection"
import {
  getDocumentDetailScopeKeys,
  getConversationRelatedScopeKeys,
  getProjectDetailScopeKeys,
  getWorkItemDetailScopeKeys,
  selectDocumentDetailReadModel,
  selectProjectDetailReadModel,
  selectWorkItemDetailReadModel,
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

  it("selects the work item detail subset and related project scopes", () => {
    const snapshot = createSnapshotFixture()
    const patch = selectWorkItemDetailReadModel(snapshot, "item_1")

    expect(patch).toMatchObject({
      workItems: [{ id: "item_1" }],
      documents: [{ id: "doc_description" }, { id: "doc_linked" }],
      comments: [{ id: "comment_2" }],
      attachments: [{ id: "attachment_2" }],
      projects: [{ id: "project_1" }],
      milestones: [{ id: "milestone_1" }],
      labels: [{ id: "label_1" }],
    })
    expect(getWorkItemDetailScopeKeys(snapshot, "item_1").sort()).toEqual([
      "project-detail:project_1",
      "project-index:team_team_1",
      "search-seed:workspace_1",
      "work-index:personal_user_1",
      "work-index:personal_user_2",
      "work-index:team_team_1",
      "work-item-detail:item_1",
    ])
  })

  it("selects the project detail subset", () => {
    const snapshot = createSnapshotFixture()
    const patch = selectProjectDetailReadModel(snapshot, "project_1")

    expect(patch).toMatchObject({
      projects: [{ id: "project_1" }],
      workItems: [{ id: "item_1" }],
      milestones: [{ id: "milestone_1" }],
      projectUpdates: [{ id: "update_1" }],
      documents: [{ id: "doc_1" }],
      views: [{ id: "view_1" }],
    })
    expect(getProjectDetailScopeKeys("project_1")).toEqual([
      "project-detail:project_1",
    ])
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
    expect(getConversationRelatedScopeKeys(snapshot, "missing")).toEqual([])
  })
})
