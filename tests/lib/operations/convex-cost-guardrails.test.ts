import { describe, expect, it } from "vitest"

import {
  auditConvexEnvTargets,
  buildConvexCostDiagnosticRows,
  getConvexDeploymentNameFromDeployment,
  getConvexDeploymentNameFromUrl,
} from "@/lib/operations/convex-cost-guardrails"

describe("Convex cost guardrails", () => {
  it("normalizes cost diagnostics with function or route, calls/day, DB I/O/day, return bytes, and source", () => {
    expect(
      buildConvexCostDiagnosticRows([
        {
          calls: 300,
          dbIoBytes: 9000,
          functionName: "app:getSnapshot",
          periodDays: 3,
          returnBytes: 227000,
          source: "convex",
        },
        {
          calls: 30,
          dbIoBytes: 6000,
          periodDays: 3,
          returnBytes: 950,
          route: "/api/events/scoped",
          source: "route",
        },
      ])
    ).toEqual([
      {
        callsPerDay: 100,
        dbIoBytesPerDay: 3000,
        functionOrRoute: "app:getSnapshot",
        returnBytes: 227000,
        source: "convex",
      },
      {
        callsPerDay: 10,
        dbIoBytesPerDay: 2000,
        functionOrRoute: "/api/events/scoped",
        returnBytes: 950,
        source: "route",
      },
    ])
  })

  it("extracts deployment names from Convex URLs and CLI deployment values", () => {
    expect(
      getConvexDeploymentNameFromUrl(
        "https://content-frog-200.eu-west-1.convex.cloud"
      )
    ).toBe("content-frog-200")
    expect(
      getConvexDeploymentNameFromDeployment(
        "dev:flexible-cheetah-243 # team: declan-cowen"
      )
    ).toBe("flexible-cheetah-243")
  })

  it("makes local/prod Convex target differences visible", () => {
    expect(
      auditConvexEnvTargets({
        localEnv: {
          CONVEX_DEPLOYMENT: "dev:flexible-cheetah-243",
          NEXT_PUBLIC_CONVEX_URL:
            "https://flexible-cheetah-243.eu-west-1.convex.cloud",
        },
        productionEnv: {
          NEXT_PUBLIC_CONVEX_URL:
            "https://content-frog-200.eu-west-1.convex.cloud",
        },
      })
    ).toMatchObject({
      findings: [
        {
          code: "CONVEX_LOCAL_TARGET_DIFFERS_FROM_PRODUCTION",
          severity: "info",
        },
      ],
      local: {
        cliDeployment: "flexible-cheetah-243",
        urlDeployment: "flexible-cheetah-243",
      },
      production: {
        urlDeployment: "content-frog-200",
      },
    })
  })

  it("flags mismatched local Convex URL and CLI deployment targets", () => {
    expect(
      auditConvexEnvTargets({
        localEnv: {
          CONVEX_DEPLOYMENT: "dev:flexible-cheetah-243",
          NEXT_PUBLIC_CONVEX_URL:
            "https://content-frog-200.eu-west-1.convex.cloud",
        },
        productionEnv: {
          NEXT_PUBLIC_CONVEX_URL:
            "https://content-frog-200.eu-west-1.convex.cloud",
        },
      }).findings
    ).toEqual([
      expect.objectContaining({
        code: "CONVEX_LOCAL_URL_DEPLOYMENT_MISMATCH",
        severity: "warning",
      }),
    ])
  })
})
