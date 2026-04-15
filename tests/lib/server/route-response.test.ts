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
      details: {
        notice: "Sign in again.",
      },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
      notice: "Sign in again.",
    })
  })
})
