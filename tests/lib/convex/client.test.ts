import {
  syncAcceptInvite,
  syncRequestAccountEmailChange,
  syncRequestCurrentAccountPasswordReset,
} from "@/lib/convex/client"

describe("route client helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts account email updates through the shared route client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          logoutRequired: true,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    )

    await expect(
      syncRequestAccountEmailChange("person@example.com")
    ).resolves.toEqual({
      ok: true,
      logoutRequired: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/email",
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("throws RouteMutationError when the route client receives a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Invite not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    )

    await expect(syncAcceptInvite("invite-token")).rejects.toMatchObject({
      message: "Invite not found",
      status: 404,
    })
  })

  it("supports password reset initiation through the shared route client", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    )

    await expect(syncRequestCurrentAccountPasswordReset()).resolves.toEqual({
      ok: true,
    })
  })
})
