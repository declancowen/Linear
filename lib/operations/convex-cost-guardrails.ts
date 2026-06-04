type ConvexCostSource = "convex" | "route" | "client" | "manual"

export type ConvexCostDiagnosticSample = {
  calls?: number | null
  dbIoBytes?: number | null
  functionName?: string | null
  periodDays?: number | null
  returnBytes?: number | null
  route?: string | null
  source?: ConvexCostSource | null
}

export type ConvexCostDiagnosticRow = {
  callsPerDay: number
  dbIoBytesPerDay: number
  functionOrRoute: string
  returnBytes: number
  source: ConvexCostSource
}

export type ConvexEnvAuditInput = {
  localEnv?: Record<string, string | undefined>
  productionEnv?: Record<string, string | undefined>
}

type ConvexEnvAuditFinding = {
  code:
    | "CONVEX_LOCAL_TARGET_DIFFERS_FROM_PRODUCTION"
    | "CONVEX_LOCAL_URL_DEPLOYMENT_MISMATCH"
    | "CONVEX_PRODUCTION_TARGET_MISSING"
  message: string
  severity: "info" | "warning"
}

function normalizePositiveNumber(value: number | null | undefined) {
  return Number.isFinite(value) && value && value > 0 ? value : 0
}

function getDiagnosticName(sample: ConvexCostDiagnosticSample) {
  return (
    sample.functionName?.trim() ||
    sample.route?.trim() ||
    "unknown-function-or-route"
  )
}

function getPeriodDays(sample: ConvexCostDiagnosticSample) {
  return Math.max(1, normalizePositiveNumber(sample.periodDays))
}

export function buildConvexCostDiagnosticRows(
  samples: ConvexCostDiagnosticSample[]
): ConvexCostDiagnosticRow[] {
  return samples
    .map((sample) => {
      const periodDays = getPeriodDays(sample)

      return {
        callsPerDay: Math.round(
          normalizePositiveNumber(sample.calls) / periodDays
        ),
        dbIoBytesPerDay: Math.round(
          normalizePositiveNumber(sample.dbIoBytes) / periodDays
        ),
        functionOrRoute: getDiagnosticName(sample),
        returnBytes: Math.round(normalizePositiveNumber(sample.returnBytes)),
        source: sample.source ?? "manual",
      }
    })
    .sort((left, right) => {
      const dbIoDelta = right.dbIoBytesPerDay - left.dbIoBytesPerDay

      return dbIoDelta === 0
        ? right.callsPerDay - left.callsPerDay
        : dbIoDelta
    })
}

export function getConvexDeploymentNameFromUrl(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).hostname.split(".")[0] ?? null
  } catch {
    return null
  }
}

export function getConvexDeploymentNameFromDeployment(
  value: string | undefined
) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.replace(/^(dev|prod):/, "").split(/\s+/)[0] ?? null
}

export function auditConvexEnvTargets({
  localEnv = {},
  productionEnv = {},
}: ConvexEnvAuditInput) {
  const localUrlDeployment = getConvexDeploymentNameFromUrl(
    localEnv.NEXT_PUBLIC_CONVEX_URL ?? localEnv.CONVEX_URL
  )
  const localCliDeployment = getConvexDeploymentNameFromDeployment(
    localEnv.CONVEX_DEPLOYMENT
  )
  const productionUrlDeployment = getConvexDeploymentNameFromUrl(
    productionEnv.NEXT_PUBLIC_CONVEX_URL ?? productionEnv.CONVEX_URL
  )
  const productionCliDeployment = getConvexDeploymentNameFromDeployment(
    productionEnv.CONVEX_DEPLOYMENT
  )
  const productionDeployment =
    productionUrlDeployment ?? productionCliDeployment ?? null
  const findings: ConvexEnvAuditFinding[] = []

  if (!productionDeployment) {
    findings.push({
      code: "CONVEX_PRODUCTION_TARGET_MISSING",
      message:
        "Production Convex target is not visible; cost investigations may aim at the wrong deployment.",
      severity: "warning",
    })
  }

  if (
    localUrlDeployment &&
    localCliDeployment &&
    localUrlDeployment !== localCliDeployment
  ) {
    findings.push({
      code: "CONVEX_LOCAL_URL_DEPLOYMENT_MISMATCH",
      message: `Local Convex URL targets ${localUrlDeployment}, but CONVEX_DEPLOYMENT targets ${localCliDeployment}.`,
      severity: "warning",
    })
  }

  if (
    localUrlDeployment &&
    productionDeployment &&
    localUrlDeployment !== productionDeployment
  ) {
    findings.push({
      code: "CONVEX_LOCAL_TARGET_DIFFERS_FROM_PRODUCTION",
      message: `Local Convex URL targets ${localUrlDeployment}; production targets ${productionDeployment}.`,
      severity: "info",
    })
  }

  return {
    findings,
    local: {
      cliDeployment: localCliDeployment,
      urlDeployment: localUrlDeployment,
    },
    production: {
      cliDeployment: productionCliDeployment,
      urlDeployment: productionUrlDeployment,
    },
  }
}
