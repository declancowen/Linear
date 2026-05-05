import { api } from "@/convex/_generated/api"
import type { AuditEventInput } from "@/lib/domain/audit"
import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "@/lib/server/convex/core"

function auditNullable<T>(value: T | null | undefined) {
  return value ?? null
}

function auditDetails(details: AuditEventInput["details"]) {
  return details ?? {}
}

function auditOutcome(outcome: AuditEventInput["outcome"]) {
  return outcome ?? "success"
}

function createOperationalAuditMutationArgs(input: AuditEventInput) {
  return withServerToken({
    actorUserId: auditNullable(input.actorUserId),
    details: auditDetails(input.details),
    entityId: auditNullable(input.entityId),
    outcome: auditOutcome(input.outcome),
    subjectUserId: auditNullable(input.subjectUserId),
    summary: input.summary,
    teamId: auditNullable(input.teamId),
    type: input.type,
    workspaceId: auditNullable(input.workspaceId),
  })
}

async function persistOperationalAuditEvent(input: AuditEventInput) {
  await getConvexServerClient().mutation(
    api.app.logAuditEvent,
    createOperationalAuditMutationArgs(input)
  )
}

export async function recordOperationalAuditEvent(
  input: AuditEventInput
) {
  try {
    await runConvexRequestWithRetry(`audit:${input.type}`, () =>
      persistOperationalAuditEvent(input)
    )
  } catch (error) {
    console.warn(`Failed to persist operational audit event ${input.type}`, {
      error,
    })
  }
}
