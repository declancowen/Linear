import { describe, expect, it } from "vitest"

import { getWorkspacePersonActivity } from "@/lib/domain/selectors"
import type { AppData, Comment } from "@/lib/domain/types"
import {
  createTestAppData,
  createTestDocument,
  createTestTeamMembership,
  createTestWorkItem,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

function createComment(overrides: Partial<Comment>): Comment {
  return {
    id: "comment_1",
    targetType: "workItem",
    targetId: "item_1",
    parentCommentId: null,
    content: "Comment",
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_1",
    createdAt: "2026-04-20T10:00:00.000Z",
    ...overrides,
  }
}

function createPrivateProfileActivityData(currentUserId: string): AppData {
  const privateItem = createTestWorkItem("private_item", {
    creatorId: "user_2",
    teamId: null,
    workspaceId: "workspace_1",
    title: "Hidden private task",
    visibility: "private",
    createdAt: "2026-04-20T09:00:00.000Z",
  })
  const privateDocument = createTestDocument({
    id: "private_doc",
    kind: "private-document",
    teamId: null,
    title: "Hidden private document",
    createdBy: "user_2",
    updatedBy: "user_2",
    createdAt: "2026-04-20T09:05:00.000Z",
    updatedAt: "2026-04-20T09:05:00.000Z",
  })

  return createTestAppData({
    currentUserId,
    workspaceMemberships: [
      createTestWorkspaceMembership({
        userId: "user_1",
        role: "admin",
      }),
      createTestWorkspaceMembership({
        userId: "user_2",
        role: "member",
      }),
    ],
    teamMemberships: [],
    workItems: [privateItem],
    documents: [privateDocument],
    comments: [
      createComment({
        id: "private_work_comment",
        targetType: "workItem",
        targetId: privateItem.id,
        createdBy: "user_2",
        createdAt: "2026-04-20T10:05:00.000Z",
      }),
      createComment({
        id: "private_document_comment",
        targetType: "document",
        targetId: privateDocument.id,
        createdBy: "user_2",
        createdAt: "2026-04-20T10:10:00.000Z",
      }),
    ],
    workItemActivities: [
      {
        id: "activity_private_status",
        itemId: privateItem.id,
        actorId: "user_2",
        type: "status-change",
        fromStatus: "todo",
        toStatus: "done",
        createdAt: "2026-04-20T10:15:00.000Z",
      },
      {
        id: "activity_private_labels",
        itemId: privateItem.id,
        actorId: "user_2",
        type: "label-change",
        fromLabelIds: [],
        toLabelIds: ["label_1"],
        createdAt: "2026-04-20T10:20:00.000Z",
      },
    ],
  })
}

describe("people activity selectors", () => {
  it("includes visible work item status and label changes in actor profiles", () => {
    const item = createTestWorkItem("item_1", {
      title: "Plan launch",
    })
    const data = createTestAppData({
      currentUserId: "user_1",
      workspaceMemberships: [createTestWorkspaceMembership()],
      teamMemberships: [createTestTeamMembership()],
      workItems: [item],
      workItemActivities: [
        {
          id: "activity_status",
          itemId: item.id,
          actorId: "user_1",
          type: "status-change",
          fromStatus: "todo",
          toStatus: "done",
          createdAt: "2026-04-20T10:00:00.000Z",
        },
        {
          id: "activity_labels",
          itemId: item.id,
          actorId: "user_1",
          type: "label-change",
          fromLabelIds: [],
          toLabelIds: ["label_1"],
          createdAt: "2026-04-20T11:00:00.000Z",
        },
      ],
    })

    expect(
      getWorkspacePersonActivity(data, "workspace_1", "user_1")
    ).toMatchObject([
      {
        type: "workItemLabelsChanged",
        activityId: "activity_labels",
        itemId: item.id,
        title: "Plan launch",
      },
      {
        type: "workItemStatusChanged",
        activityId: "activity_status",
        itemId: item.id,
        title: "Plan launch",
      },
      {
        type: "workItemCreated",
        itemId: item.id,
        title: "Plan launch",
      },
    ])
  })

  it("hides private work item change activity from other viewers", () => {
    const privateItem = createTestWorkItem("private_item", {
      creatorId: "user_2",
      teamId: null,
      workspaceId: "workspace_1",
      title: "Hidden private task",
      visibility: "private",
    })
    const data = createTestAppData({
      currentUserId: "user_1",
      workspaceMemberships: [
        createTestWorkspaceMembership(),
        createTestWorkspaceMembership({
          userId: "user_2",
          role: "member",
        }),
      ],
      teamMemberships: [],
      workItems: [privateItem],
      workItemActivities: [
        {
          id: "activity_private",
          itemId: privateItem.id,
          actorId: "user_2",
          type: "status-change",
          fromStatus: "todo",
          toStatus: "done",
          createdAt: "2026-04-20T10:00:00.000Z",
        },
      ],
    })

    expect(getWorkspacePersonActivity(data, "workspace_1", "user_2")).toEqual(
      []
    )
  })

  it("hides private work item and document activity from other viewers", () => {
    const data = createPrivateProfileActivityData("user_1")

    expect(getWorkspacePersonActivity(data, "workspace_1", "user_2")).toEqual(
      []
    )
  })

  it("shows owned private work item and document activity on the current user's profile", () => {
    const data = createPrivateProfileActivityData("user_2")

    expect(
      getWorkspacePersonActivity(data, "workspace_1", "user_2")
    ).toMatchObject([
      {
        type: "workItemLabelsChanged",
        activityId: "activity_private_labels",
        itemId: "private_item",
        title: "Hidden private task",
      },
      {
        type: "workItemStatusChanged",
        activityId: "activity_private_status",
        itemId: "private_item",
        title: "Hidden private task",
      },
      {
        type: "documentCommented",
        documentId: "private_doc",
        commentId: "private_document_comment",
        title: "Hidden private document",
      },
      {
        type: "workItemCommented",
        itemId: "private_item",
        commentId: "private_work_comment",
        title: "Hidden private task",
      },
      {
        type: "workItemCreated",
        itemId: "private_item",
        title: "Hidden private task",
      },
    ])
  })
})
