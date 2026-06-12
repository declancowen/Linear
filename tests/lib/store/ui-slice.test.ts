import { describe, expect, it } from "vitest"

import {
  getViewerDirectoryPresetSurfaceKey,
  getViewerScopedDirectoryKey,
  getViewerScopedViewKey,
} from "@/lib/domain/viewer-view-config"
import { createUiSlice } from "@/lib/store/app-store-internal/slices/ui"
import {
  createTestAppData,
  createTestWorkItem,
  createTestViewDefinition,
} from "@/tests/lib/fixtures/app-data"
import { createMutableSetState } from "@/tests/lib/fixtures/store"

function createUiSliceHarness() {
  const state = {
    ...createTestAppData({
      views: [
        createTestViewDefinition({
          id: "view_1",
          route: "/team/platform/work",
          displayProps: ["id", "status"],
          hiddenState: {
            groups: ["todo"],
            subgroups: [],
          },
        }),
      ],
    }),
    pendingWorkItemSyncsById: {},
    pendingCommentSyncsById: {},
    pendingChatMessageSyncsById: {},
    pendingChannelPostCommentSyncsById: {},
  }
  const setState = createMutableSetState(state)
  const slice = createUiSlice(setState as never)
  const storageKey = getViewerScopedViewKey(
    state.currentUserId,
    "/team/platform/work",
    "view_1"
  )

  return {
    slice,
    state,
    storageKey,
  }
}

describe("ui slice", () => {
  it("toggles viewer display properties and hidden group values from the base view", () => {
    const { slice, state, storageKey } = createUiSliceHarness()

    slice.toggleViewerViewDisplayProperty(
      "/team/platform/work",
      "view_1",
      "priority"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.displayProps).toEqual([
      "id",
      "status",
      "priority",
    ])

    slice.toggleViewerViewDisplayProperty("/team/platform/work", "view_1", "id")
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.displayProps).toEqual([
      "status",
      "priority",
    ])

    slice.toggleViewerViewHiddenValue(
      "/team/platform/work",
      "view_1",
      "groups",
      "todo"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.hiddenState).toEqual({
      groups: [],
      subgroups: [],
    })

    slice.toggleViewerViewHiddenValue(
      "/team/platform/work",
      "view_1",
      "subgroups",
      "blocked"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]?.hiddenState).toEqual({
      groups: [],
      subgroups: ["blocked"],
    })
  })

  it("resets viewer view overrides back to the base view", () => {
    const { slice, state, storageKey } = createUiSliceHarness()

    slice.toggleViewerViewDisplayProperty(
      "/team/platform/work",
      "view_1",
      "priority"
    )
    expect(state.ui.viewerViewConfigByRoute[storageKey]).toBeDefined()

    slice.resetViewerViewConfig("/team/platform/work", "view_1")

    expect(state.ui.viewerViewConfigByRoute[storageKey]).toBeUndefined()
  })

  it("creates, selects, updates, and deletes viewer-local directory presets", () => {
    const { slice, state } = createUiSliceHarness()
    const surfaceKey = "views-directory:workspace:workspace_1"
    const routeKey = getViewerScopedDirectoryKey(
      state.currentUserId,
      surfaceKey
    )

    const presetId = slice.createViewerDirectoryPreset(surfaceKey, {
      name: "Active views",
      icon: "SquaresFour",
      config: {
        layout: "board",
        filters: { entityKinds: ["items"] },
      },
    })

    expect(presetId).toBeTruthy()
    expect(state.ui.viewerDirectoryPresetsByRoute[routeKey]).toEqual([
      expect.objectContaining({
        id: presetId,
        name: "Active views",
        icon: "SquaresFour",
      }),
    ])
    expect(state.ui.selectedDirectoryPresetByRoute[routeKey]).toBe(presetId)
    expect(
      state.ui.viewerDirectoryConfigByRoute[
        getViewerScopedDirectoryKey(
          state.currentUserId,
          getViewerDirectoryPresetSurfaceKey(surfaceKey, presetId!)
        )
      ]
    ).toEqual({
      layout: "board",
      filters: { entityKinds: ["items"] },
    })

    expect(
      slice.updateViewerDirectoryPreset(surfaceKey, presetId!, {
        name: "Renamed",
      })
    ).toBe(true)
    expect(state.ui.viewerDirectoryPresetsByRoute[routeKey]?.[0]?.name).toBe(
      "Renamed"
    )

    slice.deleteViewerDirectoryPreset(surfaceKey, presetId!)

    expect(state.ui.viewerDirectoryPresetsByRoute[routeKey]).toEqual([])
    expect(state.ui.selectedDirectoryPresetByRoute[routeKey]).toBeUndefined()
  })

  it("preserves a local read notification while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const readAt = "2026-04-20T10:00:00.000Z"
    const notification = {
      id: "notification_1",
      userId: "user_1",
      type: "comment" as const,
      entityType: "workItem" as const,
      entityId: "item_1",
      actorId: "user_2",
      message: "Blake commented on Task",
      readAt,
      archivedAt: null,
      emailedAt: null,
      createdAt: "2026-04-20T09:00:00.000Z",
    }

    state.notifications = [notification]

    slice.mergeReadModelData({
      notifications: [
        {
          ...notification,
          readAt: null,
        },
      ],
    })

    expect(state.notifications[0]?.readAt).toBe(readAt)

    slice.replaceDomainData({
      notifications: [
        {
          ...notification,
          readAt: null,
        },
      ],
    } as never)

    expect(state.notifications[0]?.readAt).toBe(readAt)
  })

  it("preserves pending optimistic work item fields while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const serverItem = createTestWorkItem("item_1", {
      status: "todo",
      updatedAt: "2026-04-20T09:00:00.000Z",
    })
    const optimisticItem = {
      ...serverItem,
      status: "done" as const,
      updatedAt: "2026-04-20T10:00:00.000Z",
    }

    state.workItems = [optimisticItem]
    state.pendingWorkItemSyncsById = {
      item_1: "work_item_sync_1",
    }

    slice.mergeReadModelData({
      workItems: [serverItem],
    })

    expect(state.workItems[0]).toMatchObject({
      id: "item_1",
      status: "done",
      updatedAt: "2026-04-20T10:00:00.000Z",
    })

    slice.replaceDomainData({
      workItems: [serverItem],
    } as never)

    expect(state.workItems[0]).toMatchObject({
      id: "item_1",
      status: "done",
      updatedAt: "2026-04-20T10:00:00.000Z",
    })
  })

  it("preserves pending optimistic chat messages while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const optimisticMessage = {
      id: "message_pending",
      conversationId: "conversation_1",
      kind: "text" as const,
      content: "<p>Sending</p>",
      callId: null,
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_1",
      createdAt: "2026-04-20T10:00:00.000Z",
    }

    state.chatMessages = [optimisticMessage]
    state.pendingChatMessageSyncsById = {
      message_pending: "chat_message_sync_1",
    }

    slice.mergeReadModelData({
      chatMessages: [],
    })

    expect(state.chatMessages).toEqual([optimisticMessage])

    slice.replaceDomainData({
      chatMessages: [],
    } as never)

    expect(state.chatMessages).toEqual([optimisticMessage])
  })

  it("preserves pending optimistic comments while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const optimisticComment = {
      id: "comment_pending",
      targetType: "workItem" as const,
      targetId: "item_1",
      parentCommentId: null,
      content: "<p>Uploading</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_1",
      createdAt: "2026-04-20T10:00:00.000Z",
    }

    state.comments = [optimisticComment]
    state.pendingCommentSyncsById = {
      comment_pending: "comment_sync_1",
    }

    slice.mergeReadModelData({
      comments: [],
    })

    expect(state.comments).toEqual([optimisticComment])

    slice.replaceDomainData({
      comments: [],
    } as never)

    expect(state.comments).toEqual([optimisticComment])
  })

  it("preserves pending optimistic channel post comments while stale read models arrive", () => {
    const { slice, state } = createUiSliceHarness()
    const optimisticComment = {
      id: "channel_comment_pending",
      postId: "post_1",
      content: "<p>Uploading</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_1",
      createdAt: "2026-04-20T10:00:00.000Z",
    }

    state.channelPostComments = [optimisticComment]
    state.pendingChannelPostCommentSyncsById = {
      channel_comment_pending: "channel_comment_sync_1",
    }

    slice.mergeReadModelData({
      channelPostComments: [],
    })

    expect(state.channelPostComments).toEqual([optimisticComment])

    slice.replaceDomainData({
      channelPostComments: [],
    } as never)

    expect(state.channelPostComments).toEqual([optimisticComment])
  })
})
