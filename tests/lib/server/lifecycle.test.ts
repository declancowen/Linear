import { beforeEach, describe, expect, it, vi } from "vitest"

const recordOperationalAuditEventMock = vi.fn()
const deactivateUserOrganizationMembershipMock = vi.fn()
const deleteWorkOSUserMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/audit", () => ({
  recordOperationalAuditEvent: recordOperationalAuditEventMock,
}))

vi.mock("@/lib/server/workos", () => ({
  deactivateUserOrganizationMembership:
    deactivateUserOrganizationMembershipMock,
  deleteWorkOSUser: deleteWorkOSUserMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  logProviderError: logProviderErrorMock,
}))

describe("server lifecycle reconciliation", () => {
  beforeEach(() => {
    recordOperationalAuditEventMock.mockReset()
    deactivateUserOrganizationMembershipMock.mockReset()
    deleteWorkOSUserMock.mockReset()
    logProviderErrorMock.mockReset()
    recordOperationalAuditEventMock.mockResolvedValue(undefined)
    deactivateUserOrganizationMembershipMock.mockResolvedValue(undefined)
    deleteWorkOSUserMock.mockResolvedValue(undefined)
  })

  it("deduplicates organization cleanup calls", async () => {
    const { reconcileProviderMembershipCleanup } =
      await import("@/lib/server/lifecycle")

    await reconcileProviderMembershipCleanup({
      label: "cleanup failed",
      memberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })

    expect(deactivateUserOrganizationMembershipMock).toHaveBeenCalledTimes(1)
    expect(deactivateUserOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      workosUserId: "workos_1",
    })
    expect(recordOperationalAuditEventMock).not.toHaveBeenCalled()
  })

  it("falls back to organization deactivation when WorkOS user deletion fails", async () => {
    const { reconcileDeletedAccountProviderCleanup } =
      await import("@/lib/server/lifecycle")

    deleteWorkOSUserMock.mockRejectedValueOnce(new Error("provider down"))

    await expect(
      reconcileDeletedAccountProviderCleanup({
        workosUserId: "workos_1",
        memberships: [
          {
            workspaceId: "workspace_1",
            organizationId: "org_1",
            workosUserId: "workos_1",
          },
        ],
      })
    ).resolves.toEqual({
      providerCleanupPending: true,
    })

    expect(logProviderErrorMock).toHaveBeenCalledWith(
      "Failed to delete WorkOS user after account deletion",
      expect.any(Error)
    )
    expect(recordOperationalAuditEventMock).toHaveBeenCalledWith({
      type: "provider.account_cleanup_failed",
      outcome: "failure",
      entityId: "workos_1",
      summary: "Provider account cleanup failed after account deletion.",
      details: {
        provider: "workos",
        reason: "provider down",
        source: "server",
        workosUserId: "workos_1",
      },
    })
    expect(deactivateUserOrganizationMembershipMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      workosUserId: "workos_1",
    })
  })

  it("records audit events for provider membership cleanup failures", async () => {
    const { reconcileProviderMembershipCleanup } =
      await import("@/lib/server/lifecycle")

    deactivateUserOrganizationMembershipMock.mockRejectedValueOnce(
      new Error("membership deactivation failed")
    )

    await reconcileProviderMembershipCleanup({
      label: "workspace leave",
      memberships: [
        {
          workspaceId: "workspace_1",
          organizationId: "org_1",
          workosUserId: "workos_1",
        },
      ],
    })

    expect(recordOperationalAuditEventMock).toHaveBeenCalledWith({
      type: "provider.membership_cleanup_failed",
      outcome: "failure",
      workspaceId: "workspace_1",
      entityId: "org_1",
      summary: "Provider membership cleanup failed for organization org_1.",
      details: {
        organizationId: "org_1",
        provider: "workos",
        reason: "membership deactivation failed",
        source: "server",
        workosUserId: "workos_1",
      },
    })
  })
})
