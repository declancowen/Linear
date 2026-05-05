import { arrayMove } from "@dnd-kit/sortable"

import type { DisplayProperty, Project } from "@/lib/domain/types"

export function getProjectStatusIconStatus(status: Project["status"]) {
  if (status === "in-progress") {
    return "in-progress"
  }

  if (status === "completed") {
    return "completed"
  }

  if (status === "cancelled") {
    return "cancelled"
  }

  return status === "backlog" ? "backlog" : "todo"
}

export function getReorderedDisplayPropertiesAfterDrag({
  activeId,
  overId,
  visibleProperties,
}: {
  activeId: DisplayProperty
  overId: DisplayProperty | null
  visibleProperties: DisplayProperty[]
}) {
  if (!overId || activeId === overId) {
    return null
  }

  const oldIndex = visibleProperties.indexOf(activeId)
  const newIndex = visibleProperties.indexOf(overId)

  if (oldIndex < 0 || newIndex < 0) {
    return null
  }

  return arrayMove(visibleProperties, oldIndex, newIndex)
}
