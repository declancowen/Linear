import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  attachmentFields,
  commentFields,
  documentFields,
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
  workspaceFields,
} from "./validators"

export default defineSchema({
  appConfig: defineTable({
    key: v.literal("singleton"),
    currentUserId: v.string(),
    currentWorkspaceId: v.string(),
  }).index("by_key", ["key"]),
  workspaces: defineTable(workspaceFields).index("by_domain_id", ["id"]),
  teams: defineTable(teamFields).index("by_domain_id", ["id"]),
  teamMemberships: defineTable(teamMembershipFields)
    .index("by_team_and_user", ["teamId", "userId"])
    .index("by_user", ["userId"]),
  users: defineTable(userFields)
    .index("by_domain_id", ["id"])
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email", ["email"]),
  labels: defineTable(labelFields).index("by_domain_id", ["id"]),
  projects: defineTable(projectFields).index("by_domain_id", ["id"]),
  milestones: defineTable(milestoneFields).index("by_domain_id", ["id"]),
  workItems: defineTable(workItemFields)
    .index("by_domain_id", ["id"])
    .index("by_team_id", ["teamId"]),
  documents: defineTable(documentFields).index("by_domain_id", ["id"]),
  views: defineTable(viewDefinitionFields).index("by_domain_id", ["id"]),
  comments: defineTable(commentFields).index("by_domain_id", ["id"]),
  attachments: defineTable(attachmentFields)
    .index("by_domain_id", ["id"])
    .index("by_target", ["targetType", "targetId"]),
  notifications: defineTable(notificationFields)
    .index("by_domain_id", ["id"])
    .index("by_user", ["userId"]),
  invites: defineTable(inviteFields)
    .index("by_domain_id", ["id"])
    .index("by_token", ["token"]),
  projectUpdates: defineTable(projectUpdateFields).index("by_domain_id", ["id"]),
})
