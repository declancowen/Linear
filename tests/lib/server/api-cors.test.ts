import { describe, expect, it } from "vitest"
import { NextResponse } from "next/server"

import {
  applyApiCorsHeaders,
  createApiCorsPreflightResponse,
} from "@/lib/server/api-cors"

function expectCredentialedCorsHeaders(response: Response | null | undefined) {
  expect(response?.headers.get("Access-Control-Allow-Origin")).toBe(
    "app://recipe-room"
  )
  expect(response?.headers.get("Access-Control-Allow-Credentials")).toBe("true")
}

describe("api cors helpers", () => {
  it("does not add CORS headers without an allowed origin", () => {
    const response = NextResponse.next()

    applyApiCorsHeaders(
      response,
      new Request("https://teams.example.com/api/test", {
        headers: {
          Origin: "app://recipe-room",
        },
      }),
      {
        allowedOrigins: ["app://other-app"],
      }
    )

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull()
  })

  it("adds credentialed CORS headers for explicitly allowed API origins", () => {
    const response = NextResponse.next()

    applyApiCorsHeaders(
      response,
      new Request("https://teams.example.com/api/test", {
        headers: {
          Origin: "app://recipe-room",
        },
      }),
      {
        allowedOrigins: ["app://recipe-room"],
      }
    )

    expectCredentialedCorsHeaders(response)
    expect(response.headers.get("Vary")).toBe("Origin")
  })

  it("returns a preflight response for allowed desktop API origins", () => {
    const response = createApiCorsPreflightResponse(
      new Request("https://teams.example.com/api/test", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Headers": "authorization, content-type",
          "Access-Control-Request-Method": "POST",
          Origin: "app://recipe-room",
        },
      }),
      {
        allowedOrigins: ["app://recipe-room"],
      }
    )

    expect(response?.status).toBe(204)
    expectCredentialedCorsHeaders(response)
    expect(response?.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST"
    )
    expect(response?.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, content-type"
    )
  })

  it("denies preflight requests from unlisted origins", () => {
    const response = createApiCorsPreflightResponse(
      new Request("https://teams.example.com/api/test", {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          Origin: "app://unexpected",
        },
      }),
      {
        allowedOrigins: ["app://recipe-room"],
      }
    )

    expect(response?.status).toBe(403)
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })
})
