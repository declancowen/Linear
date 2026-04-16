import { z } from "zod"

import { parseJsonBody } from "@/lib/server/route-body"

describe("parseJsonBody", () => {
  it("returns parsed JSON for valid payloads", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Linear",
      }),
    })

    const payload = await parseJsonBody(
      request,
      z.object({
        name: z.string(),
      }),
      "Invalid payload"
    )

    expect(payload).toEqual({
      name: "Linear",
    })
  })

  it("returns a 400 response for invalid payloads", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        count: "oops",
      }),
    })

    const payload = await parseJsonBody(
      request,
      z.object({
        count: z.number(),
      }),
      "Invalid payload"
    )

    expect(payload).toBeInstanceOf(Response)
    const response = payload as Response

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
      message: "Invalid payload",
      code: "ROUTE_INVALID_BODY",
    })
  })
})
