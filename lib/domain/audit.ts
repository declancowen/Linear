export type AuditEventRole = "admin" | "member" | "viewer" | "guest"

export type AuditEventDetails = {
  deletedPrivateDocumentIds?: string[]
  email?: string
  inviteRole?: AuditEventRole
  nextRole?: AuditEventRole
  organizationId?: string
  previousRole?: AuditEventRole
  provider?: string
  reason?: string
  removedTeamIds?: string[]
  source?: "convex" | "server"
  workosUserId?: string
}

export type AuditEventInput = {
  type:
    | "membership.role_changed"
    | "membership.removed_from_team"
    | "membership.removed_from_workspace"
    | "membership.left_team"
    | "membership.left_workspace"
    | "workspace.deleted"
    | "account.deleted"
    | "invite.created"
    | "invite.accepted"
    | "invite.declined"
    | "invite.cancelled"
    | "provider.membership_cleanup_failed"
    | "provider.account_cleanup_failed"
  outcome?: "success" | "failure"
  actorUserId?: string | null
  subjectUserId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  entityId?: string | null
  summary: string
  details?: AuditEventDetails
}
