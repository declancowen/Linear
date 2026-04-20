import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  auditEventFields,
  attachmentFields,
  callFields,
  channelPostCommentFields,
  channelPostFields,
  chatMessageFields,
  commentFields,
  conversationFields,
  documentFields,
  documentPresenceFields,
  emailJobFields,
  inviteFields,
  labelFields,
  milestoneFields,
  notificationFields,
  projectFields,
  projectUpdateFields,
  teamFields,
  teamMembershipFields,
  userFields,
  viewDefinitionFields,
  workItemFields,
  workspaceMembershipFields,
  workspaceFields,
} from "./validators"

export default defineSchema({
  appConfig: defineTable({
    key: v.literal("singleton"),
    snapshotVersion: v.optional(v.number()),
  }).index("by_key", ["key"]),
  auditEvents: defineTable(auditEventFields)
    .index("by_type_occurred_at", ["type", "occurredAt"])
    .index("by_workspace_occurred_at", ["workspaceId", "occurredAt"])
    .index("by_team_occurred_at", ["teamId", "occurredAt"])
    .index("by_actor_occurred_at", ["actorUserId", "occurredAt"])
    .index("by_subject_occurred_at", ["subjectUserId", "occurredAt"]),
  userAppStates: defineTable({
    userId: v.string(),
    currentWorkspaceId: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  workspaces: defineTable(workspaceFields)
    .index("by_domain_id", ["id"])
    .index("by_slug", ["slug"])
    .index("by_created_by", ["createdBy"]),
  workspaceMemberships: defineTable(workspaceMembershipFields)
    .index("by_workspace_and_user", ["workspaceId", "userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"]),
  teams: defineTable(teamFields)
    .index("by_domain_id", ["id"])
    .index("by_slug", ["slug"])
    .index("by_workspace_and_slug", ["workspaceId", "slug"])
    .index("by_join_code", ["joinCodeNormalized"])
    .index("by_workspace", ["workspaceId"]),
  teamMemberships: defineTable(teamMembershipFields)
    .index("by_team_and_user", ["teamId", "userId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"]),
  users: defineTable(userFields)
    .index("by_domain_id", ["id"])
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email_normalized", ["emailNormalized"])
    .index("by_email", ["email"]),
  labels: defineTable(labelFields)
    .index("by_domain_id", ["id"])
    .index("by_workspace", ["workspaceId"]),
  projects: defineTable(projectFields)
    .index("by_domain_id", ["id"])
    .index("by_scope", ["scopeType", "scopeId"]),
  milestones: defineTable(milestoneFields)
    .index("by_domain_id", ["id"])
    .index("by_project", ["projectId"]),
  workItems: defineTable(workItemFields)
    .index("by_domain_id", ["id"])
    .index("by_team_id", ["teamId"]),
  documents: defineTable(documentFields)
    .index("by_domain_id", ["id"])
    .index("by_created_by", ["createdBy"])
    .index("by_workspace", ["workspaceId"])
    .index("by_team", ["teamId"]),
  documentPresence: defineTable(documentPresenceFields)
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),
  views: defineTable(viewDefinitionFields)
    .index("by_domain_id", ["id"])
    .index("by_scope", ["scopeType", "scopeId"])
    .index("by_container", ["containerType", "containerId"])
    .index("by_scope_entity_kind", ["scopeType", "scopeId", "entityKind"]),
  comments: defineTable(commentFields)
    .index("by_domain_id", ["id"])
    .index("by_target", ["targetType", "targetId"]),
  attachments: defineTable(attachmentFields)
    .index("by_domain_id", ["id"])
    .index("by_target", ["targetType", "targetId"]),
  notifications: defineTable(notificationFields)
    .index("by_domain_id", ["id"])
    .index("by_user", ["userId"])
    .index("by_emailed_at", ["emailedAt"])
    .index("by_entity", ["entityType", "entityId"]),
  emailJobs: defineTable(emailJobFields)
    .index("by_domain_id", ["id"])
    .index("by_sent_at", ["sentAt"])
    .index("by_notification", ["notificationId"]),
  invites: defineTable(inviteFields)
    .index("by_domain_id", ["id"])
    .index("by_token", ["token"])
    .index("by_team", ["teamId"])
    .index("by_normalized_email", ["normalizedEmail"])
    .index("by_team_and_normalized_email", ["teamId", "normalizedEmail"]),
  projectUpdates: defineTable(projectUpdateFields)
    .index("by_domain_id", ["id"])
    .index("by_project", ["projectId"]),
  conversations: defineTable(conversationFields)
    .index("by_domain_id", ["id"])
    .index("by_scope", ["scopeType", "scopeId"])
    .index("by_kind_scope", ["kind", "scopeType", "scopeId"]),
  calls: defineTable(callFields)
    .index("by_domain_id", ["id"])
    .index("by_conversation", ["conversationId"]),
  chatMessages: defineTable(chatMessageFields)
    .index("by_domain_id", ["id"])
    .index("by_conversation", ["conversationId"]),
  channelPosts: defineTable(channelPostFields)
    .index("by_domain_id", ["id"])
    .index("by_conversation", ["conversationId"]),
  channelPostComments: defineTable(channelPostCommentFields)
    .index("by_domain_id", ["id"])
    .index("by_post", ["postId"]),
})
