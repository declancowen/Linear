import type {
  PendingDocumentMention,
  RichTextMentionCounts,
} from "./rich-text-mentions"

export type DocumentMentionQueueState = {
  baselineCounts: RichTextMentionCounts
  currentCounts: RichTextMentionCounts
  trackedUserIds: Record<string, true>
}

export type DocumentMentionQueueAction =
  | {
      type: "reset-document"
      counts: RichTextMentionCounts
    }
  | {
      type: "sync-counts"
      counts: RichTextMentionCounts
    }
  | {
      type: "track-user"
      userId: string
    }
  | {
      type: "clear-all"
    }
  | {
      type: "mark-sent"
      entries: PendingDocumentMention[]
    }

function cloneMentionCounts(counts: RichTextMentionCounts) {
  return { ...counts }
}

function getPendingMentionCount(
  baselineCounts: RichTextMentionCounts,
  currentCounts: RichTextMentionCounts,
  userId: string
) {
  return Math.max(0, (currentCounts[userId] ?? 0) - (baselineCounts[userId] ?? 0))
}

function pruneTrackedUserIds(
  trackedUserIds: Record<string, true>,
  baselineCounts: RichTextMentionCounts,
  currentCounts: RichTextMentionCounts
) {
  return Object.fromEntries(
    Object.keys(trackedUserIds)
      .filter(
        (userId) =>
          getPendingMentionCount(baselineCounts, currentCounts, userId) > 0
      )
      .map((userId) => [userId, true] as const)
  )
}

export function createDocumentMentionQueueState(
  counts: RichTextMentionCounts
): DocumentMentionQueueState {
  const initialCounts = cloneMentionCounts(counts)

  return {
    baselineCounts: initialCounts,
    currentCounts: initialCounts,
    trackedUserIds: {},
  }
}

export function reduceDocumentMentionQueue(
  state: DocumentMentionQueueState,
  action: DocumentMentionQueueAction
): DocumentMentionQueueState {
  switch (action.type) {
    case "reset-document":
      return createDocumentMentionQueueState(action.counts)

    case "sync-counts": {
      const nextCurrentCounts = cloneMentionCounts(action.counts)

      return {
        ...state,
        currentCounts: nextCurrentCounts,
        trackedUserIds: pruneTrackedUserIds(
          state.trackedUserIds,
          state.baselineCounts,
          nextCurrentCounts
        ),
      }
    }

    case "track-user": {
      const nextCurrentCounts = cloneMentionCounts(state.currentCounts)
      nextCurrentCounts[action.userId] = (nextCurrentCounts[action.userId] ?? 0) + 1

      return {
        ...state,
        currentCounts: nextCurrentCounts,
        trackedUserIds: {
          ...state.trackedUserIds,
          [action.userId]: true,
        },
      }
    }

    case "clear-all":
      return {
        baselineCounts: cloneMentionCounts(state.currentCounts),
        currentCounts: state.currentCounts,
        trackedUserIds: {},
      }

    case "mark-sent": {
      const nextBaselineCounts = cloneMentionCounts(state.baselineCounts)

      for (const entry of action.entries) {
        nextBaselineCounts[entry.userId] = Math.min(
          state.currentCounts[entry.userId] ?? 0,
          (nextBaselineCounts[entry.userId] ?? 0) + entry.count
        )
      }

      return {
        ...state,
        baselineCounts: nextBaselineCounts,
        trackedUserIds: pruneTrackedUserIds(
          state.trackedUserIds,
          nextBaselineCounts,
          state.currentCounts
        ),
      }
    }
  }
}

export function getPendingDocumentMentionEntries(
  state: DocumentMentionQueueState
) {
  return Object.keys(state.trackedUserIds).flatMap<PendingDocumentMention>(
    (userId) => {
      const count = getPendingMentionCount(
        state.baselineCounts,
        state.currentCounts,
        userId
      )

      return count > 0
        ? [
            {
              userId,
              count,
            },
          ]
        : []
    }
  )
}
