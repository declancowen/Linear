"use client"

import type { JSONContent } from "@tiptap/core"

import type { CollaborationLimits } from "@/lib/collaboration/limits"
import type { CollaborationSessionRole } from "@/lib/collaboration/transport"

import { runRouteMutation } from "./shared"

export type DocumentCollaborationSessionPayload = {
  roomId: string
  documentId: string
  token: string
  serviceUrl: string
  role: CollaborationSessionRole
  sessionId: string
  protocolVersion: number
  schemaVersion: number
  limits: CollaborationLimits
  expiresAt: number
  contentJson?: JSONContent
  contentHtml?: string
}

export function syncCreateDocumentCollaborationSession(documentId: string) {
  return runRouteMutation<DocumentCollaborationSessionPayload>(
    `/api/collaboration/documents/${documentId}/session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
}

export function buildScopedInvalidationStreamUrl(scopeKeys: string[]) {
  const searchParams = new URLSearchParams()

  for (const scopeKey of scopeKeys) {
    if (scopeKey.trim()) {
      searchParams.append("scopeKey", scopeKey)
    }
  }

  const query = searchParams.toString()

  return query.length > 0 ? `/api/events/scoped?${query}` : "/api/events/scoped"
}
