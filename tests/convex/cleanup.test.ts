import { describe, expect, it, vi } from "vitest"

import { cascadeDeleteTeamData } from "@/convex/app/cleanup"
import { createMutableConvexTestCtx } from "@/tests/lib/convex/test-db"

function createCascadeDeleteTeamCtx() {
  const ctx = createMutableConvexTestCtx({
    attachments: [],
    calls: [],
    channelPostComments: [],
    channelPosts: [],
    chatMessages: [],
    comments: [],
    conversations: [],
    documentPresence: [],
    documents: [
      {
        _id: "team_description_doc",
        id: "team_description",
        kind: "item-description",
        teamId: "team_1",
        workspaceId: "workspace_1",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
      },
      {
        _id: "private_description_doc",
        id: "private_description",
        kind: "item-description",
        teamId: "team_1",
        workspaceId: "workspace_1",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
      },
      {
        _id: "team_document_doc",
        id: "team_document",
        kind: "team-document",
        teamId: "team_1",
        workspaceId: "workspace_1",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
      },
    ],
    invites: [],
    labels: [
      {
        _id: "private_label_doc",
        id: "private_label",
        workspaceId: "workspace_1",
        scopeType: "private",
        ownerId: "user_1",
        name: "Private",
      },
      {
        _id: "unused_label_doc",
        id: "unused_label",
        workspaceId: "workspace_1",
        scopeType: "private",
        ownerId: "user_1",
        name: "Unused",
      },
    ],
    milestones: [],
    notifications: [],
    projectUpdates: [],
    projects: [],
    teamMemberships: [],
    teams: [
      {
        _id: "team_doc",
        id: "team_1",
        workspaceId: "workspace_1",
      },
    ],
    views: [],
    workItemActivities: [
      {
        _id: "team_activity_doc",
        id: "team_activity",
        itemId: "team_item",
        actorId: "user_1",
      },
      {
        _id: "private_activity_doc",
        id: "private_activity",
        itemId: "private_item",
        actorId: "user_1",
      },
    ],
    workItems: [
      {
        _id: "team_item_doc",
        id: "team_item",
        teamId: "team_1",
        descriptionDocId: "team_description",
        visibility: "team",
        linkedDocumentIds: [],
        linkedProjectIds: [],
        labelIds: [],
        primaryProjectId: null,
        milestoneId: null,
      },
      {
        _id: "private_item_doc",
        id: "private_item",
        teamId: "team_1",
        descriptionDocId: "private_description",
        visibility: "private",
        linkedDocumentIds: [],
        linkedProjectIds: [],
        labelIds: ["private_label"],
        primaryProjectId: null,
        milestoneId: null,
      },
    ],
    workspaces: [
      {
        _id: "workspace_doc",
        id: "workspace_1",
      },
    ],
    workspaceMemberships: [],
  })

  return {
    ...ctx,
    storage: {
      delete: vi.fn(),
    },
  }
}

describe("cleanup handlers", () => {
  it("keeps private work items when deleting a team", async () => {
    const ctx = createCascadeDeleteTeamCtx()

    await cascadeDeleteTeamData(ctx as never, {
      currentUserId: "user_1",
      teamId: "team_1",
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })

    expect(ctx.tables.workItems).toEqual([
      expect.objectContaining({
        id: "private_item",
        workspaceId: "workspace_1",
      }),
    ])
    expect(ctx.tables.documents).toEqual([
      expect.objectContaining({
        id: "private_description",
        teamId: null,
        workspaceId: "workspace_1",
      }),
    ])
    expect(ctx.tables.workItemActivities).toEqual([
      expect.objectContaining({
        id: "private_activity",
      }),
    ])
  })

  it("keeps labels referenced by preserved private work items", async () => {
    const ctx = createCascadeDeleteTeamCtx()

    await cascadeDeleteTeamData(ctx as never, {
      currentUserId: "user_1",
      teamId: "team_1",
      syncWorkspaceChannel: false,
    })

    expect(ctx.tables.labels).toEqual([
      expect.objectContaining({
        id: "private_label",
      }),
    ])
  })
})
