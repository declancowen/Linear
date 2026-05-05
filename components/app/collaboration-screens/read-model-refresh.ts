"use client"

import {
  fetchConversationListReadModel,
  fetchConversationThreadReadModel,
} from "@/lib/convex/client"
import {
  getConversationListScopeKeys,
  getConversationThreadScopeKeys,
} from "@/lib/scoped-sync/read-models"
import { useScopedReadModelRefresh } from "@/hooks/use-scoped-read-model-refresh"

export function useConversationListReadModelRefresh(
  currentUserId: string | null | undefined
) {
  return useScopedReadModelRefresh({
    enabled: Boolean(currentUserId),
    scopeKeys: currentUserId ? getConversationListScopeKeys(currentUserId) : [],
    fetchLatest: () => fetchConversationListReadModel(currentUserId ?? ""),
  })
}

export function useConversationThreadReadModelRefresh(
  conversationId: string | null | undefined
) {
  return useScopedReadModelRefresh({
    enabled: Boolean(conversationId),
    scopeKeys: conversationId
      ? getConversationThreadScopeKeys(conversationId)
      : [],
    fetchLatest: () => fetchConversationThreadReadModel(conversationId ?? ""),
  })
}
