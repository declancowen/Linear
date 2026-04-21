import type { MutationCtx } from "../_generated/server"

import { assertServerToken, createId, getNow } from "./core"

type AuditEventDetails = {
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

type RecordAuditEventArgs = AuditEventInput & {
  serverToken: string
}

export async function insertAuditEvent(
  ctx: MutationCtx,
  input: AuditEventInput
) {
  await ctx.db.insert("auditEvents", {
    id: createId("audit"),
    type: input.type,
    outcome: input.outcome ?? "success",
    actorUserId: input.actorUserId ?? null,
    subjectUserId: input.subjectUserId ?? null,
    workspaceId: input.workspaceId ?? null,
    teamId: input.teamId ?? null,
    entityId: input.entityId ?? null,
    summary: input.summary,
    details: input.details ?? {},
    occurredAt: getNow(),
  })
}

export async function recordAuditEventHandler(
  ctx: MutationCtx,
  args: RecordAuditEventArgs
) {
  assertServerToken(args.serverToken)

  await insertAuditEvent(ctx, args)

  return {
    recorded: true,
  }
}
