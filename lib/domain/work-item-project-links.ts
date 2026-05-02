export type WorkItemProjectLinkItem = {
  id: string
  parentId: string | null
  primaryProjectId: string | null
}

export type WorkItemProjectLinkPatch = {
  parentId?: string | null
  primaryProjectId?: string | null
}

export type WorkItemProjectLinkResolution = {
  cascadeItemIds: Set<string>
  resolvedPrimaryProjectId: string | null
  shouldCascadeProjectLink: boolean
}

function findRootItemId(
  itemId: string,
  parentIds: Map<string, string | null>
) {
  let rootItemId = itemId
  const visited = new Set<string>([rootItemId])

  while (true) {
    const parentId = parentIds.get(rootItemId) ?? null

    if (!parentId || visited.has(parentId)) {
      break
    }

    visited.add(parentId)
    rootItemId = parentId
  }

  return rootItemId
}

function collectCascadeItemIds(
  rootItemId: string,
  parentIds: Map<string, string | null>
) {
  const cascadeItemIds = new Set<string>([rootItemId])
  const queue = [rootItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    for (const [itemId, parentId] of parentIds) {
      if (parentId !== currentId || cascadeItemIds.has(itemId)) {
        continue
      }

      cascadeItemIds.add(itemId)
      queue.push(itemId)
    }
  }

  return cascadeItemIds
}

export function resolveWorkItemProjectLinkUpdate(input: {
  items: WorkItemProjectLinkItem[]
  itemId: string
  existingPrimaryProjectId: string | null
  patch: WorkItemProjectLinkPatch
}): WorkItemProjectLinkResolution {
  const itemsById = new Map(input.items.map((item) => [item.id, item]))
  const existingItem = itemsById.get(input.itemId) ?? null
  const nextParentId =
    input.patch.parentId === undefined
      ? (existingItem?.parentId ?? null)
      : input.patch.parentId
  const nextParent = nextParentId ? (itemsById.get(nextParentId) ?? null) : null
  const resolvedPrimaryProjectId =
    input.patch.primaryProjectId !== undefined
      ? input.patch.primaryProjectId
      : input.patch.parentId !== undefined
        ? (nextParent?.primaryProjectId ?? input.existingPrimaryProjectId)
        : input.existingPrimaryProjectId
  const parentIds = new Map<string, string | null>(
    input.items.map((item) => [
      item.id,
      item.id === input.itemId ? (nextParentId ?? null) : item.parentId,
    ])
  )
  const rootItemId = findRootItemId(input.itemId, parentIds)
  const cascadeItemIds = collectCascadeItemIds(rootItemId, parentIds)
  const shouldCascadeProjectLink =
    (input.patch.primaryProjectId !== undefined ||
      input.patch.parentId !== undefined) &&
    [...cascadeItemIds].some((itemId) => {
      const currentProjectId =
        itemId === input.itemId
          ? input.existingPrimaryProjectId
          : (itemsById.get(itemId)?.primaryProjectId ?? null)

      return currentProjectId !== resolvedPrimaryProjectId
    })

  return {
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  }
}
