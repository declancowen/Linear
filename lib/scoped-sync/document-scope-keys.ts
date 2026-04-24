import {
  createDocumentDetailScopeKey,
  createDocumentIndexScopeKey,
  createProjectDetailScopeKey,
  createProjectIndexScopeKey,
  createSearchSeedScopeKey,
  createScopedCollectionScopeId,
  createWorkIndexScopeKey,
  createWorkItemDetailScopeKey,
} from "./scope-keys"

type CollaborationProjectScopeInput = {
  projectId: string
  scopeType: "team" | "workspace"
  scopeId: string
}

type CollaborationDocumentScopeInput = {
  documentId: string
  kind: "team-document" | "workspace-document" | "private-document" | "item-description"
  workspaceId?: string | null
  teamId?: string | null
  itemId?: string | null
  searchWorkspaceId?: string | null
  teamMemberIds?: string[] | null
  projectScopes?: CollaborationProjectScopeInput[] | null
}

export function buildCollaborationDocumentScopeKeys(
  input: CollaborationDocumentScopeInput,
  options?: {
    includeCollectionScopes?: boolean
  }
) {
  const includeCollectionScopes = options?.includeCollectionScopes ?? true
  const scopeKeys = new Set<string>()
  const searchWorkspaceId = input.searchWorkspaceId ?? input.workspaceId

  scopeKeys.add(createDocumentDetailScopeKey(input.documentId))

  if (input.kind === "item-description") {
    if (input.itemId) {
      scopeKeys.add(createWorkItemDetailScopeKey(input.itemId))
    }

    if (includeCollectionScopes && input.teamId) {
      scopeKeys.add(
        createWorkIndexScopeKey(
          createScopedCollectionScopeId("team", input.teamId)
        )
      )
    }

    if (includeCollectionScopes) {
      for (const userId of input.teamMemberIds ?? []) {
        scopeKeys.add(
          createWorkIndexScopeKey(
            createScopedCollectionScopeId("personal", userId)
          )
        )
      }

      for (const projectScope of input.projectScopes ?? []) {
        scopeKeys.add(createProjectDetailScopeKey(projectScope.projectId))
        scopeKeys.add(
          createProjectIndexScopeKey(
            createScopedCollectionScopeId(
              projectScope.scopeType,
              projectScope.scopeId
            )
          )
        )
      }
    }

    if (includeCollectionScopes && searchWorkspaceId) {
      scopeKeys.add(createSearchSeedScopeKey(searchWorkspaceId))
    }

    return [...scopeKeys]
  }

  if (input.kind === "private-document") {
    return [...scopeKeys]
  }

  if (!includeCollectionScopes) {
    return [...scopeKeys]
  }

  if (input.teamId) {
    scopeKeys.add(
      createDocumentIndexScopeKey(
        createScopedCollectionScopeId("team", input.teamId)
      )
    )
  } else if (input.workspaceId) {
    scopeKeys.add(
      createDocumentIndexScopeKey(
        createScopedCollectionScopeId("workspace", input.workspaceId)
      )
    )
  }

  if (searchWorkspaceId) {
    scopeKeys.add(createSearchSeedScopeKey(searchWorkspaceId))
  }

  return [...scopeKeys]
}
