import { beforeEach, describe, expect, it, vi } from "vitest"

const workosServerMocks = vi.hoisted(() => ({
  createWorkOS: vi.fn(),
}))

vi.mock("@workos-inc/node", () => ({
  createWorkOS: workosServerMocks.createWorkOS,
}))

import {
  coerceWorkOSAccountApplicationError,
  deactivateUserOrganizationMembership,
  getWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"

function mockWorkosMembershipClient(input: {
  deactivateOrganizationMembership: ReturnType<typeof vi.fn>
  listOrganizationMemberships: ReturnType<typeof vi.fn>
}) {
  workosServerMocks.createWorkOS.mockReturnValue({
    userManagement: input,
  })
}

function expectMembershipDeactivation(
  organizationId = "org_1",
  workosUserId = "workos_user_1"
) {
  return expect(
    deactivateUserOrganizationMembership({
      organizationId,
      workosUserId,
    })
  )
}

describe("workos account error coercion", () => {
  it("maps expected provider failures to typed application errors", () => {
    expect(
      coerceWorkOSAccountApplicationError({ status: 409 }, "fallback")
    ).toMatchObject({
      status: 409,
      code: "ACCOUNT_EMAIL_CONFLICT",
    })

    expect(
      coerceWorkOSAccountApplicationError(
        { rawData: { error: "user_not_found" } },
        "fallback"
      )
    ).toMatchObject({
      status: 404,
      code: "WORKOS_USER_NOT_FOUND",
    })

    expect(
      coerceWorkOSAccountApplicationError(
        new Error("This account is not linked to WorkOS"),
        "fallback"
      )
    ).toMatchObject({
      status: 409,
      code: "ACCOUNT_WORKOS_LINK_REQUIRED",
    })
  })
})

describe("workos organization membership lifecycle", () => {
  beforeEach(() => {
    workosServerMocks.createWorkOS.mockReset()
    process.env.WORKOS_API_KEY = "workos-key"
    process.env.WORKOS_CLIENT_ID = "client-id"
  })

  it("deactivates active memberships and skips missing membership inputs", async () => {
    const deactivateOrganizationMembership = vi.fn().mockResolvedValue({
      id: "membership_1",
      status: "inactive",
    })
    const listOrganizationMemberships = vi.fn().mockResolvedValue({
      data: [
        {
          id: "membership_1",
          status: "active",
        },
      ],
    })

    mockWorkosMembershipClient({
      deactivateOrganizationMembership,
      listOrganizationMemberships,
    })

    await expectMembershipDeactivation().resolves.toEqual({
      id: "membership_1",
      status: "inactive",
    })
    await expect(
      deactivateUserOrganizationMembership({
        organizationId: null,
        workosUserId: "workos_user_1",
      })
    ).resolves.toBeNull()
    expect(listOrganizationMemberships).toHaveBeenCalledWith({
      organizationId: "org_1",
      userId: "workos_user_1",
    })
    expect(deactivateOrganizationMembership).toHaveBeenCalledWith(
      "membership_1"
    )
  })

  it("does not deactivate inactive or missing memberships", async () => {
    const deactivateOrganizationMembership = vi.fn()
    const listOrganizationMemberships = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: "membership_1",
            status: "inactive",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [],
      })

    mockWorkosMembershipClient({
      deactivateOrganizationMembership,
      listOrganizationMemberships,
    })

    await expectMembershipDeactivation().resolves.toEqual({
      id: "membership_1",
      status: "inactive",
    })
    await expectMembershipDeactivation(
      "org_2",
      "workos_user_2"
    ).resolves.toBeNull()
    expect(deactivateOrganizationMembership).not.toHaveBeenCalled()
  })
})

describe("workos auth error parsing", () => {
  it("prefers raw WorkOS payload values for auth codes and messages", () => {
    const error = {
      error: "top_level_error",
      message: "Top-level message",
      rawData: {
        error: "raw_error",
        error_description: "Raw description",
      },
    }

    expect(getWorkOSAuthErrorCode(error)).toBe("top_level_error")
    expect(getWorkOSAuthErrorMessage(error)).toBe("Top-level message")
  })

  it("falls back through WorkOS message fields", () => {
    expect(
      getWorkOSAuthErrorMessage({
        rawData: {
          errorDescription: "Camel description",
        },
      })
    ).toBe("Camel description")

    expect(
      getWorkOSAuthErrorMessage({
        rawData: {
          error_description: "Snake description",
        },
      })
    ).toBe("Snake description")
  })

  it("extracts pending authentication from top-level and raw payloads", () => {
    expect(
      getWorkOSPendingAuthentication({
        pendingAuthenticationToken: "pending-top",
        user: {
          email: "top@example.com",
        },
      })
    ).toEqual({
      email: "top@example.com",
      pendingAuthenticationToken: "pending-top",
    })

    expect(
      getWorkOSPendingAuthentication({
        rawData: {
          pending_authentication_token: "pending-raw",
          email: "raw@example.com",
        },
      })
    ).toEqual({
      email: "raw@example.com",
      pendingAuthenticationToken: "pending-raw",
    })
  })

  it("returns null for non-object auth errors without pending authentication", () => {
    expect(getWorkOSAuthErrorCode("provider down")).toBeNull()
    expect(getWorkOSAuthErrorMessage(null)).toBeNull()
    expect(getWorkOSPendingAuthentication({ error: "invalid" })).toBeNull()
  })
})
