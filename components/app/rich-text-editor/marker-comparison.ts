import type { DocumentPresenceViewer } from "@/lib/domain/types"
import { areArraysEqual } from "./array-equality"

export type BlockPresenceMarker = {
  blockId: string
  top: number
  viewers: DocumentPresenceViewer[]
}

export type CollaborationCursorMarker = {
  key: string
  name: string
  color: string
  left: number
  top: number
  height: number
}

export type CollaborationSelectionMarker = {
  key: string
  color: string
  left: number
  top: number
  width: number
  height: number
}

export type PositionedCollaborationMarker = {
  key: string
  left: number
  top: number
}

export function areCollaborationSelectionMarkersEqual(
  left: CollaborationSelectionMarker[],
  right: CollaborationSelectionMarker[]
) {
  return areArraysEqual(
    left,
    right,
    (leftMarker, rightMarker) =>
      leftMarker.key === rightMarker.key &&
      leftMarker.color === rightMarker.color &&
      leftMarker.left === rightMarker.left &&
      leftMarker.top === rightMarker.top &&
      leftMarker.top === rightMarker.top &&
      leftMarker.width === rightMarker.width &&
      leftMarker.height === rightMarker.height
  )
}

export function areBlockPresenceMarkersEqual(
  left: BlockPresenceMarker[],
  right: BlockPresenceMarker[]
) {
  return areArraysEqual(left, right, (leftMarker, rightMarker) => {
    if (
      leftMarker.blockId !== rightMarker.blockId ||
      leftMarker.top !== rightMarker.top ||
      leftMarker.viewers.length !== rightMarker.viewers.length
    ) {
      return false
    }

    return areArraysEqual(
      leftMarker.viewers,
      rightMarker.viewers,
      (leftViewer, rightViewer) =>
        leftViewer.userId === rightViewer.userId &&
        leftViewer.activeBlockId === rightViewer.activeBlockId
    )
  })
}

export function areCollaborationCursorMarkersEqual(
  left: CollaborationCursorMarker[],
  right: CollaborationCursorMarker[]
) {
  return areArraysEqual(
    left,
    right,
    (leftMarker, rightMarker) =>
      leftMarker.key === rightMarker.key &&
      leftMarker.name === rightMarker.name &&
      leftMarker.color === rightMarker.color &&
      leftMarker.left === rightMarker.left &&
      leftMarker.top === rightMarker.top &&
      leftMarker.height === rightMarker.height
  )
}

export function sortCollaborationMarkers<
  TMarker extends PositionedCollaborationMarker,
>(markers: TMarker[]) {
  return markers.sort(
    (left, right) =>
      left.top - right.top ||
      left.left - right.left ||
      left.key.localeCompare(right.key)
  )
}
