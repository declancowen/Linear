type WorkItemAssigneeSource = {
  assigneeId?: string | null
  assigneeIds?: readonly string[] | null
}

function normalizeWorkItemAssigneeIds(
  assigneeIds: readonly (string | null | undefined)[] | null | undefined
) {
  return [
    ...new Set(
      (assigneeIds ?? [])
        .map((assigneeId) => assigneeId?.trim() ?? "")
        .filter(Boolean)
    ),
  ]
}

function getPrimaryWorkItemAssigneeId(
  assigneeIds: readonly (string | null | undefined)[] | null | undefined
) {
  return normalizeWorkItemAssigneeIds(assigneeIds)[0] ?? null
}

export function getWorkItemAssigneeIds(item: WorkItemAssigneeSource) {
  if (item.assigneeIds !== undefined && item.assigneeIds !== null) {
    return normalizeWorkItemAssigneeIds(item.assigneeIds)
  }

  return item.assigneeId ? [item.assigneeId] : []
}

export function getWorkItemAssigneeFields(
  assigneeIds: readonly (string | null | undefined)[] | null | undefined
) {
  const normalizedAssigneeIds = normalizeWorkItemAssigneeIds(assigneeIds)

  return {
    assigneeId: getPrimaryWorkItemAssigneeId(normalizedAssigneeIds),
    assigneeIds: normalizedAssigneeIds,
  }
}

export function getResolvedWorkItemMutationAssigneeIds(input: {
  assigneeId?: string | null
  assigneeIds?: readonly string[] | null
}) {
  if (input.assigneeIds !== undefined) {
    return normalizeWorkItemAssigneeIds(input.assigneeIds)
  }

  return input.assigneeId ? [input.assigneeId] : []
}

export function haveSameWorkItemAssigneeIds(
  left: readonly (string | null | undefined)[] | null | undefined,
  right: readonly (string | null | undefined)[] | null | undefined
) {
  const normalizedLeft = normalizeWorkItemAssigneeIds(left).sort()
  const normalizedRight = normalizeWorkItemAssigneeIds(right).sort()

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every(
      (assigneeId, index) => assigneeId === normalizedRight[index]
    )
  )
}

export function getAddedWorkItemAssigneeIds(input: {
  fromAssigneeIds: readonly (string | null | undefined)[] | null | undefined
  toAssigneeIds: readonly (string | null | undefined)[] | null | undefined
}) {
  const fromAssigneeIds = new Set(
    normalizeWorkItemAssigneeIds(input.fromAssigneeIds)
  )

  return normalizeWorkItemAssigneeIds(input.toAssigneeIds).filter(
    (assigneeId) => !fromAssigneeIds.has(assigneeId)
  )
}

export function toggleWorkItemAssigneeId(
  currentAssigneeIds: readonly (string | null | undefined)[] | null | undefined,
  assigneeId: string
) {
  const current = new Set(normalizeWorkItemAssigneeIds(currentAssigneeIds))

  if (current.has(assigneeId)) {
    current.delete(assigneeId)
  } else {
    current.add(assigneeId)
  }

  return [...current]
}
