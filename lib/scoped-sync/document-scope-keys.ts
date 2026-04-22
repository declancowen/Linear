import {
  createDocumentDetailScopeKey,
  createDocumentIndexScopeKey,
  createWorkIndexScopeKey,
  createWorkItemDetailScopeKey,
} from "./scope-keys"

type CollaborationDocumentScopeInput = {
  documentId: string
  kind: "team-document" | "workspace-document" | "private-document" | "item-description"
  workspaceId?: string | null
  teamId?: string | null
  itemId?: string | null
}

export function buildCollaborationDocumentScopeKeys(
  input: CollaborationDocumentScopeInput,
  options?: {
    includeCollectionScopes?: boolean
  }
) {
  const includeCollectionScopes = options?.includeCollectionScopes ?? true
  const scopeKeys = new Set<string>()

  scopeKeys.add(createDocumentDetailScopeKey(input.documentId))

  if (input.kind === "item-description") {
    if (input.itemId) {
      scopeKeys.add(createWorkItemDetailScopeKey(input.itemId))
    }

    if (includeCollectionScopes && input.teamId) {
      scopeKeys.add(createWorkIndexScopeKey(input.teamId))
    }

    return [...scopeKeys]
  }

  if (!includeCollectionScopes) {
    return [...scopeKeys]
  }

  if (input.teamId) {
    scopeKeys.add(createDocumentIndexScopeKey(input.teamId))
  } else if (input.workspaceId) {
    scopeKeys.add(createDocumentIndexScopeKey(input.workspaceId))
  }

  return [...scopeKeys]
}
