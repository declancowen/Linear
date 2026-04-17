import { describe, expect, it } from "vitest"

import {
  createDocumentMentionQueueState,
  getPendingDocumentMentionEntries,
  reduceDocumentMentionQueue,
} from "@/lib/content/document-mention-queue"

describe("document mention queue", () => {
  it("initializes baseline and current counts as separate objects", () => {
    const state = createDocumentMentionQueueState({
      user_1: 1,
    })

    expect(state.baselineCounts).toEqual({
      user_1: 1,
    })
    expect(state.currentCounts).toEqual({
      user_1: 1,
    })
    expect(state.baselineCounts).not.toBe(state.currentCounts)
  })

  it("drops pending users immediately when their mentions are deleted", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 1,
      },
      trackCountIncreases: true,
    })
    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {},
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([])
  })

  it("tracks new local mention count increases without double-counting", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 1,
      },
      trackCountIncreases: true,
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([
      {
        userId: "user_1",
        count: 1,
      },
    ])
  })

  it("preserves mentions added while an earlier batch is in flight", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 1,
      },
      trackCountIncreases: true,
    })
    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 2,
      },
      trackCountIncreases: true,
    })
    state = reduceDocumentMentionQueue(state, {
      type: "mark-sent",
      entries: [
        {
          userId: "user_1",
          count: 1,
        },
      ],
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([
      {
        userId: "user_1",
        count: 1,
      },
    ])
  })

  it("tracks mention count increases introduced without mention-selection callbacks", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_2: 2,
      },
      trackCountIncreases: true,
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([
      {
        userId: "user_2",
        count: 2,
      },
    ])
  })

  it("ignores configured users when auto-tracking count increases", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_self: 1,
      },
      trackCountIncreases: true,
      ignoredUserIds: ["user_self"],
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([])
  })
})
