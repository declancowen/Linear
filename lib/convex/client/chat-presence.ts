"use client"

import { runRouteMutation } from "./shared"

type ChatPresenceSessionPayload = {
  roomId: string
  conversationId: string
  token: string
  serviceUrl: string
  sessionId: string
  expiresAt: number
}

export function syncCreateChatPresenceSession(conversationId: string) {
  return runRouteMutation<ChatPresenceSessionPayload>(
    `/api/collaboration/chats/${conversationId}/session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
}
