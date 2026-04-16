import { jsonError, jsonOk } from "@/lib/server/route-response"

describe("route responses", () => {
  it("returns successful JSON payloads", async () => {
    const response = jsonOk(
      {
        ok: true,
      },
      {
        status: 201,
      }
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      ok: true,
    })
  })

  it("returns error payloads with optional details", async () => {
    const response = jsonError("Unauthorized", 401, {
      code: "AUTH_UNAUTHORIZED",
      retryable: false,
      details: {
        notice: "Sign in again.",
      },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      message: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
      retryable: false,
      details: {
        notice: "Sign in again.",
      },
      notice: "Sign in again.",
    })
  })

  it("does not let detail keys overwrite the route error envelope", async () => {
    const response = jsonError("Forbidden", 403, {
      details: {
        error: "Overwritten",
        message: "Overwritten",
        code: "Overwritten",
        notice: "Access denied.",
      },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden",
      message: "Forbidden",
      details: {
        notice: "Access denied.",
      },
      notice: "Access denied.",
    })
  })
})
