import { recordOperationalAuditEvent } from "@/lib/server/audit"
import { logProviderError } from "@/lib/server/provider-errors"
import {
  deactivateUserOrganizationMembership,
  deleteWorkOSUser,
} from "@/lib/server/workos"

type ProviderMembershipCleanup = {
  workspaceId?: string
  organizationId: string
  workosUserId: string
}

function getProviderMembershipCleanupKey(input: ProviderMembershipCleanup) {
  return `${input.organizationId}:${input.workosUserId}`
}

function getErrorReason(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export async function reconcileProviderMembershipCleanup(input: {
  label: string
  memberships?: ProviderMembershipCleanup[] | null
}) {
  const memberships = [
    ...new Map(
      (input.memberships ?? []).map((membership) => [
        getProviderMembershipCleanupKey(membership),
        membership,
      ])
    ).values(),
  ]

  for (const membership of memberships) {
    try {
      await deactivateUserOrganizationMembership({
        organizationId: membership.organizationId,
        workosUserId: membership.workosUserId,
      })
    } catch (error) {
      const reason = getErrorReason(error)

      logProviderError(
        membership.workspaceId
          ? `${input.label} (${membership.workspaceId})`
          : input.label,
        error
      )

      await recordOperationalAuditEvent({
        type: "provider.membership_cleanup_failed",
        outcome: "failure",
        workspaceId: membership.workspaceId ?? null,
        entityId: membership.organizationId,
        summary: `Provider membership cleanup failed for organization ${membership.organizationId}.`,
        details: {
          organizationId: membership.organizationId,
          provider: "workos",
          reason,
          source: "server",
          workosUserId: membership.workosUserId,
        },
      })
    }
  }
}

export async function reconcileDeletedAccountProviderCleanup(input: {
  workosUserId: string | null
  memberships?: ProviderMembershipCleanup[] | null
}) {
  try {
    await deleteWorkOSUser({
      workosUserId: input.workosUserId,
    })

    return {
      providerCleanupPending: false,
    }
  } catch (error) {
    const reason = getErrorReason(error)

    logProviderError(
      "Failed to delete WorkOS user after account deletion",
      error
    )

    await recordOperationalAuditEvent({
      type: "provider.account_cleanup_failed",
      outcome: "failure",
      entityId: input.workosUserId,
      summary: "Provider account cleanup failed after account deletion.",
      details: {
        provider: "workos",
        reason,
        source: "server",
        workosUserId: input.workosUserId ?? undefined,
      },
    })

    await reconcileProviderMembershipCleanup({
      label:
        "Failed to deactivate WorkOS organization membership after account deletion",
      memberships: input.memberships,
    })

    return {
      providerCleanupPending: true,
    }
  }
}
