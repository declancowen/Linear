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
      trackCountIncreases?: boolean
      ignoredUserIds?: string[]
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

function trackCountIncreases(
  trackedUserIds: Record<string, true>,
  previousCounts: RichTextMentionCounts,
  nextCounts: RichTextMentionCounts,
  baselineCounts: RichTextMentionCounts,
  ignoredUserIds: string[] = []
) {
  const ignoredUserIdSet = new Set(ignoredUserIds)
  const nextTrackedUserIds = { ...trackedUserIds }

  for (const userId of Object.keys(nextCounts)) {
    if (ignoredUserIdSet.has(userId)) {
      continue
    }

    if ((nextCounts[userId] ?? 0) <= (previousCounts[userId] ?? 0)) {
      continue
    }

    if (getPendingMentionCount(baselineCounts, nextCounts, userId) <= 0) {
      continue
    }

    nextTrackedUserIds[userId] = true
  }

  return nextTrackedUserIds
}

export function createDocumentMentionQueueState(
  counts: RichTextMentionCounts
): DocumentMentionQueueState {
  const initialCounts = cloneMentionCounts(counts)

  return {
    baselineCounts: initialCounts,
    currentCounts: cloneMentionCounts(initialCounts),
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
      const prunedTrackedUserIds = pruneTrackedUserIds(
        state.trackedUserIds,
        state.baselineCounts,
        nextCurrentCounts
      )

      return {
        ...state,
        currentCounts: nextCurrentCounts,
        trackedUserIds: action.trackCountIncreases
          ? trackCountIncreases(
              prunedTrackedUserIds,
              state.currentCounts,
              nextCurrentCounts,
              state.baselineCounts,
              action.ignoredUserIds
            )
          : prunedTrackedUserIds,
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
