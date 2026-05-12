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
  kind:
    | "team-document"
    | "workspace-document"
    | "private-document"
    | "item-description"
  workspaceId?: string | null
  teamId?: string | null
  itemId?: string | null
  searchWorkspaceId?: string | null
  teamMemberIds?: string[] | null
  projectScopes?: CollaborationProjectScopeInput[] | null
}

function addItemDescriptionCollectionScopeKeys(
  scopeKeys: Set<string>,
  input: CollaborationDocumentScopeInput
) {
  if (input.teamId) {
    scopeKeys.add(
      createWorkIndexScopeKey(
        createScopedCollectionScopeId("team", input.teamId)
      )
    )
  }

  for (const userId of input.teamMemberIds ?? []) {
    scopeKeys.add(
      createWorkIndexScopeKey(createScopedCollectionScopeId("personal", userId))
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

function addItemDescriptionScopeKeys(
  scopeKeys: Set<string>,
  input: CollaborationDocumentScopeInput,
  options: {
    includeCollectionScopes: boolean
    searchWorkspaceId?: string | null
  }
) {
  if (input.itemId) {
    scopeKeys.add(createWorkItemDetailScopeKey(input.itemId))
  }

  if (options.includeCollectionScopes) {
    addItemDescriptionCollectionScopeKeys(scopeKeys, input)
  }

  if (options.includeCollectionScopes && options.searchWorkspaceId) {
    scopeKeys.add(createSearchSeedScopeKey(options.searchWorkspaceId))
  }
}

function addDocumentCollectionScopeKeys(
  scopeKeys: Set<string>,
  input: CollaborationDocumentScopeInput,
  searchWorkspaceId?: string | null
) {
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
    addItemDescriptionScopeKeys(scopeKeys, input, {
      includeCollectionScopes,
      searchWorkspaceId,
    })
    return [...scopeKeys]
  }

  if (input.kind === "private-document" || !includeCollectionScopes) {
    return [...scopeKeys]
  }

  addDocumentCollectionScopeKeys(scopeKeys, input, searchWorkspaceId)

  return [...scopeKeys]
}
