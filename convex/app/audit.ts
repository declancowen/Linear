import type { MutationCtx } from "../_generated/server"
import type { AuditEventInput } from "../../lib/domain/audit"

import { assertServerToken, createId, getNow } from "./core"

type RecordAuditEventArgs = AuditEventInput & {
  serverToken: string
}

export async function insertAuditEvent(
  ctx: MutationCtx,
  input: AuditEventInput
) {
  await ctx.db.insert("auditEvents", createAuditEventInsert(input))
}

function createAuditEventInsert(input: AuditEventInput) {
  return {
    id: createId("audit"),
    type: input.type,
    outcome: getAuditEventOutcome(input.outcome),
    actorUserId: getNullableAuditEventField(input.actorUserId),
    subjectUserId: getNullableAuditEventField(input.subjectUserId),
    workspaceId: getNullableAuditEventField(input.workspaceId),
    teamId: getNullableAuditEventField(input.teamId),
    entityId: getNullableAuditEventField(input.entityId),
    summary: input.summary,
    details: getAuditEventDetails(input.details),
    occurredAt: getNow(),
  }
}

function getAuditEventOutcome(outcome: AuditEventInput["outcome"]) {
  return outcome ?? "success"
}

function getNullableAuditEventField<T>(value: T | null | undefined) {
  return value ?? null
}

function getAuditEventDetails(details: AuditEventInput["details"]) {
  return details ?? {}
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
