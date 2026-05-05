import Link from "next/link"
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core"

import { StatusRing } from "@/components/ui/template-primitives"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { WorkItemAssigneeAvatar } from "../work-item-ui"

export function BoardChildItemRow({
  item,
  assignee,
  interactive,
  href,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
}: {
  item: WorkItem
  assignee: AppData["users"][number] | null
  interactive: boolean
  href?: string
  isDropTarget?: boolean
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
}) {
  const className = cn(
    "flex cursor-grab touch-none items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-3 active:cursor-grabbing",
    isDropTarget && "bg-surface-3"
  )

  const content = (
    <>
      <StatusRing status={item.status} className="size-2.5" />
      <span className="shrink-0 text-[11px] text-fg-3">{item.key}</span>
      <span className="min-w-0 flex-1 truncate text-fg-2">{item.title}</span>
      {assignee ? (
        <WorkItemAssigneeAvatar user={assignee} className="size-4" />
      ) : null}
    </>
  )

  if (!interactive || !href) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link
      href={href}
      className={className}
      {...dragAttributes}
      {...dragListeners}
    >
      {content}
    </Link>
  )
}
