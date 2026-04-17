import { describe, expect, it } from "vitest"

import { coerceWorkOSAccountApplicationError } from "@/lib/server/workos"

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
