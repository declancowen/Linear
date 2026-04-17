import { describe, expect, it } from "vitest"

import {
  createDocumentMentionQueueState,
  getPendingDocumentMentionEntries,
  reduceDocumentMentionQueue,
} from "@/lib/content/document-mention-queue"

describe("document mention queue", () => {
  it("drops pending users immediately when their mentions are deleted", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "track-user",
      userId: "user_1",
    })
    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {},
    })

    expect(getPendingDocumentMentionEntries(state)).toEqual([])
  })

  it("preserves mentions added while an earlier batch is in flight", () => {
    let state = createDocumentMentionQueueState({})

    state = reduceDocumentMentionQueue(state, {
      type: "track-user",
      userId: "user_1",
    })
    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 1,
      },
    })
    state = reduceDocumentMentionQueue(state, {
      type: "track-user",
      userId: "user_1",
    })
    state = reduceDocumentMentionQueue(state, {
      type: "sync-counts",
      counts: {
        user_1: 2,
      },
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
})
