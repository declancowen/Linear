import { describe, expect, it, vi } from "vitest"

import {
  cascadeDeleteTeamData,
  cleanupRemainingLinksAfterDelete,
  deleteContentReferencedAttachments,
} from "@/convex/app/cleanup"
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
        teamId: null,
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
        teamId: null,
        workspaceId: "workspace_1",
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

function createViewFilters() {
  return {
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
    labelIds: [],
    teamIds: [],
    visibility: [],
    showCompleted: false,
  }
}

const REFERENCED_IMAGE_CONTENT =
  '<p><img src="https://assets.example.com/image.png"></p>'

function createReferencedImageComment(overrides: Record<string, unknown> = {}) {
  return {
    _id: "comment_2_doc",
    id: "comment_2",
    targetType: "workItem" as const,
    targetId: "item_1",
    parentCommentId: null,
    content: REFERENCED_IMAGE_CONTENT,
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_2",
    createdAt: "2026-04-17T10:05:00.000Z",
    ...overrides,
  }
}

function createImageAttachmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: "attachment_2_doc",
    id: "attachment_2",
    targetType: "document" as const,
    targetId: "document_2",
    teamId: "team_1",
    storageId: "storage_1",
    fileName: "image.png",
    contentType: "image/png",
    size: 42,
    uploadedBy: "user_1",
    createdAt: "2026-04-17T10:06:00.000Z",
    ...overrides,
  }
}

function createAttachmentCleanupCtx() {
  const comments: Array<{
    _id: string
    id: string
    targetType: "workItem"
    targetId: string
    parentCommentId: string | null
    content: string
    mentionUserIds: string[]
    reactions: unknown[]
    createdBy: string
    createdAt: string
  }> = []

  const ctx = createMutableConvexTestCtx({
    attachments: [
      {
        _id: "attachment_1_doc",
        id: "attachment_1",
        targetType: "workItem",
        targetId: "item_1",
        teamId: "team_1",
        storageId: "storage_1",
        fileName: "image.png",
        contentType: "image/png",
        size: 42,
        uploadedBy: "user_1",
        createdAt: "2026-04-17T10:00:00.000Z",
      },
    ],
    comments,
    documents: [
      {
        _id: "description_doc",
        id: "description_1",
        kind: "item-description",
        teamId: "team_1",
        workspaceId: "workspace_1",
        title: "Task description",
        content: "<p></p>",
        linkedProjectIds: [],
        linkedWorkItemIds: [],
      },
    ],
    workItems: [
      {
        _id: "item_1_doc",
        id: "item_1",
        teamId: "team_1",
        descriptionDocId: "description_1",
      },
    ],
  })

  return {
    ...ctx,
    storage: {
      delete: vi.fn(),
      getUrl: vi.fn(async (storageId: string) =>
        storageId === "storage_1" ? "https://assets.example.com/image.png" : null
      ),
    },
  }
}

function getPrivateCleanupRecords(ctx: ReturnType<typeof createCascadeDeleteTeamCtx>) {
  return {
    privateDescription: ctx.tables.documents.find(
      (document) => document.id === "private_description"
    ),
    privateWorkItem: ctx.tables.workItems.find(
      (workItem) => workItem.id === "private_item"
    ),
  }
}

function addPrivateWorkItemComment(
  ctx: ReturnType<typeof createCascadeDeleteTeamCtx>,
  references: Record<string, unknown>
) {
  ;(ctx.tables.comments as unknown[]).push({
    _id: "comment_doc",
    id: "comment_1",
    targetType: "workItem",
    targetId: "private_item",
    parentCommentId: null,
    content: "<p>References</p>",
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_1",
    createdAt: "2026-04-17T10:00:00.000Z",
    ...references,
  })
}

async function deleteReferencedImageAttachments(
  ctx: ReturnType<typeof createAttachmentCleanupCtx>
) {
  await deleteContentReferencedAttachments(ctx as never, {
    targetType: "workItem",
    targetId: "item_1",
    contents: [REFERENCED_IMAGE_CONTENT],
  })
}

function expectRemainingAttachmentIds(
  ctx: ReturnType<typeof createAttachmentCleanupCtx>,
  attachmentIds: string[]
) {
  expect(ctx.tables.attachments.map((attachment) => attachment.id)).toEqual(
    attachmentIds
  )
}

describe("cleanup handlers", () => {
  it("keeps content attachments while another live target content reference remains", async () => {
    const ctx = createAttachmentCleanupCtx()
    ctx.tables.comments.push(createReferencedImageComment())

    await deleteReferencedImageAttachments(ctx)

    expect(ctx.storage.delete).not.toHaveBeenCalled()
    expectRemainingAttachmentIds(ctx, ["attachment_1"])
  })

  it("keeps storage while another attachment record references it", async () => {
    const ctx = createAttachmentCleanupCtx()
    ctx.tables.attachments.push(createImageAttachmentRecord())

    await deleteReferencedImageAttachments(ctx)

    expect(ctx.storage.delete).not.toHaveBeenCalled()
    expectRemainingAttachmentIds(ctx, ["attachment_2"])
  })

  it("deletes storage after the last referenced attachment record is removed", async () => {
    const ctx = createAttachmentCleanupCtx()

    await deleteReferencedImageAttachments(ctx)

    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_1")
    expect(ctx.tables.attachments).toEqual([])
  })

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

  it("clears deleted team view references when preserving private work items", async () => {
    const ctx = createCascadeDeleteTeamCtx()
    const { privateDescription, privateWorkItem } = getPrivateCleanupRecords(ctx)

    Object.assign(privateDescription ?? {}, {
      linkedViewIds: ["team_view", "kept_view"],
    })
    Object.assign(privateWorkItem ?? {}, {
      referencedViewIds: ["team_view", "kept_view"],
    })
    addPrivateWorkItemComment(ctx, {
      referencedViewIds: ["team_view", "kept_view"],
    })
    ;(ctx.tables.views as unknown[]).push({
      _id: "team_view_doc",
      id: "team_view",
      scopeType: "team",
      scopeId: "team_1",
      filters: createViewFilters(),
    })

    await cascadeDeleteTeamData(ctx as never, {
      currentUserId: "user_1",
      teamId: "team_1",
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })

    expect(
      ctx.tables.documents.find(
        (document) => document.id === "private_description"
      )
    ).toMatchObject({
      linkedViewIds: ["kept_view"],
    })
    expect(
      ctx.tables.workItems.find((workItem) => workItem.id === "private_item")
    ).toMatchObject({
      referencedViewIds: ["kept_view"],
    })
    expect(ctx.tables.comments[0]).toMatchObject({
      referencedViewIds: ["kept_view"],
    })
  })

  it("clears deleted entity reference ids from persisted document, work item, and comment metadata", async () => {
    const ctx = createCascadeDeleteTeamCtx()
    const { privateDescription, privateWorkItem } = getPrivateCleanupRecords(ctx)

    Object.assign(privateDescription ?? {}, {
      linkedProjectIds: ["deleted_project", "kept_project"],
      linkedWorkItemIds: ["deleted_item", "private_item"],
      linkedDocumentIds: ["deleted_doc", "team_document"],
      linkedViewIds: ["deleted_view", "view_1"],
    })
    Object.assign(privateWorkItem ?? {}, {
      referencedProjectIds: ["deleted_project", "kept_project"],
      referencedViewIds: ["deleted_view", "view_1"],
    })
    addPrivateWorkItemComment(ctx, {
      referencedWorkItemIds: ["deleted_item", "private_item"],
      referencedDocumentIds: ["deleted_doc", "private_description"],
      referencedProjectIds: ["deleted_project", "kept_project"],
      referencedViewIds: ["deleted_view", "view_1"],
    })

    await cleanupRemainingLinksAfterDelete(ctx as never, {
      currentUserId: "user_1",
      deletedDocumentIds: new Set(["deleted_doc"]),
      deletedProjectIds: new Set(["deleted_project"]),
      deletedViewIds: new Set(["deleted_view"]),
      deletedWorkItemIds: new Set(["deleted_item"]),
    })

    expect(
      ctx.tables.workItems.find((workItem) => workItem.id === "private_item")
    ).toMatchObject({
      referencedProjectIds: ["kept_project"],
      referencedViewIds: ["view_1"],
    })
    expect(
      ctx.tables.documents.find(
        (document) => document.id === "private_description"
      )
    ).toMatchObject({
      linkedProjectIds: ["kept_project"],
      linkedWorkItemIds: ["private_item"],
      linkedDocumentIds: ["team_document"],
      linkedViewIds: ["view_1"],
    })
    expect(ctx.tables.comments[0]).toMatchObject({
      referencedWorkItemIds: ["private_item"],
      referencedDocumentIds: ["private_description"],
      referencedProjectIds: ["kept_project"],
      referencedViewIds: ["view_1"],
    })
  })
})
