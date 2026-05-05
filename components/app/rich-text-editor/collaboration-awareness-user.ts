import { getCollaborationUserColor } from "@/lib/collaboration/colors"

import { isRecord } from "./collaboration-relative-range"

export type CollaborationAwarenessUser = {
  userId: string
  sessionId: string
  name: string
  color: string
}

export function getCollaborationAwarenessPayload(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  return isRecord(value.user) ? value.user : value
}

export function getCollaborationAwarenessUser(
  value: unknown
): CollaborationAwarenessUser | null {
  const userValue = getCollaborationAwarenessPayload(value)

  if (!userValue) {
    return null
  }

  const userId = getTrimmedAwarenessString(userValue, "userId")
  const sessionId = getTrimmedAwarenessString(userValue, "sessionId")
  const name = getTrimmedAwarenessString(userValue, "name")

  if (!userId || !sessionId || !name) {
    return null
  }

  return {
    userId,
    sessionId,
    name,
    color: getCollaborationAwarenessColor(userValue, userId),
  }
}

function getTrimmedAwarenessString(
  userValue: Record<string, unknown>,
  key: string
) {
  const value = userValue[key]

  return typeof value === "string" ? value.trim() : ""
}

function getCollaborationAwarenessColor(
  userValue: Record<string, unknown>,
  userId: string
) {
  const color = userValue.color

  return typeof color === "string" && color.trim().length > 0
    ? color
    : getCollaborationUserColor(userId)
}
