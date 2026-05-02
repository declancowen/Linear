import { createId, getNow } from "./core"
export {
  createMentionIds,
  haveSameIds,
  normalizeUniqueIds,
  toggleReactionUsers,
} from "../../lib/domain/collaboration-utils"

export function createNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat"
    | "team"
    | "workspace",
  entityId: string,
  type:
    | "mention"
    | "assignment"
    | "comment"
    | "message"
    | "invite"
    | "status-change"
) {
  return {
    id: createId("notification"),
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    digestClaimId: null,
    digestClaimedAt: null,
    createdAt: getNow(),
  }
}

export function createDeliveredNotification(
  userId: string,
  actorId: string,
  message: string,
  entityType:
    | "workItem"
    | "document"
    | "project"
    | "invite"
    | "channelPost"
    | "chat"
    | "team"
    | "workspace",
  entityId: string,
  type:
    | "mention"
    | "assignment"
    | "comment"
    | "message"
    | "invite"
    | "status-change"
) {
  return {
    ...createNotification(userId, actorId, message, entityType, entityId, type),
    emailedAt: getNow(),
  }
}
