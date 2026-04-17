import { api } from "@/convex/_generated/api"
import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "@/lib/server/convex/core"

type OperationalAuditEventInput = {
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
    | "provider.membership_cleanup_failed"
    | "provider.account_cleanup_failed"
  outcome?: "success" | "failure"
  actorUserId?: string | null
  subjectUserId?: string | null
  workspaceId?: string | null
  teamId?: string | null
  entityId?: string | null
  summary: string
  details?: {
    deletedPrivateDocumentIds?: string[]
    email?: string
    inviteRole?: "admin" | "member" | "viewer" | "guest"
    nextRole?: "admin" | "member" | "viewer" | "guest"
    organizationId?: string
    previousRole?: "admin" | "member" | "viewer" | "guest"
    provider?: string
    reason?: string
    removedTeamIds?: string[]
    source?: "convex" | "server"
    workosUserId?: string
  }
}

export async function recordOperationalAuditEvent(
  input: OperationalAuditEventInput
) {
  try {
    await runConvexRequestWithRetry(`audit:${input.type}`, () =>
      getConvexServerClient().mutation(
        api.app.logAuditEvent,
        withServerToken({
          actorUserId: input.actorUserId ?? null,
          details: input.details ?? {},
          entityId: input.entityId ?? null,
          outcome: input.outcome ?? "success",
          subjectUserId: input.subjectUserId ?? null,
          summary: input.summary,
          teamId: input.teamId ?? null,
          type: input.type,
          workspaceId: input.workspaceId ?? null,
        })
      )
    )
  } catch (error) {
    console.warn(`Failed to persist operational audit event ${input.type}`, {
      error,
    })
  }
}
