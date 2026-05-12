import { describe, expect, it } from "vitest"

import { getErrorDiagnostics } from "@/lib/convex/retry"

describe("Convex retry diagnostics", () => {
  it("serializes nested Error causes with bounded depth", () => {
    const root = new Error("root", {
      cause: new Error("first", {
        cause: new Error("second", {
          cause: new Error("third", {
            cause: new Error("fourth"),
          }),
        }),
      }),
    })

    expect(getErrorDiagnostics(root)).toEqual({
      name: "Error",
      message: "root",
      code: null,
      cause: {
        name: "Error",
        message: "first",
        code: null,
        cause: {
          name: "Error",
          message: "second",
          code: null,
          cause: {
            name: "Error",
            message: "third",
            code: null,
            cause: {
              message: "Error cause depth exceeded",
            },
          },
        },
      },
    })
  })

  it("reads diagnostic fields from plain objects and primitive errors", () => {
    expect(
      getErrorDiagnostics({
        name: "ConvexError",
        message: "Provider unavailable",
        code: "UNAVAILABLE",
      })
    ).toEqual({
      name: "ConvexError",
      message: "Provider unavailable",
      code: "UNAVAILABLE",
      cause: null,
    })
    expect(getErrorDiagnostics("offline")).toEqual({
      message: "offline",
    })
  })
})
