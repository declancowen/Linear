import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

const require = createRequire(import.meta.url)
const convexPackageRoot = dirname(require.resolve("convex/package.json"))
const convexCliPath = join(convexPackageRoot, "bin/main.js")

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    execute: argv.includes("--execute"),
  }
}

function loadEnvFile(pathname) {
  const values = {}
  const raw = readFileSync(pathname, "utf8")

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }

    const [key, ...rest] = trimmed.split("=")
    const value = rest.join("=").trim().replace(/^"(.*)"$/, "$1")
    values[key] = value
  }

  return values
}

function getEnv() {
  const envFilePath = resolve(process.cwd(), ".env.local")
  const fileValues = existsSync(envFilePath) ? loadEnvFile(envFilePath) : {}
  return {
    ...fileValues,
    ...process.env,
  }
}

function getDeploymentUrl(env, environment) {
  if (environment === "development") {
    return (
      env.CONVEX_URL_DEVELOPMENT ?? env.NEXT_PUBLIC_CONVEX_URL_DEVELOPMENT
    )
  }

  return env.CONVEX_URL_PRODUCTION ?? env.NEXT_PUBLIC_CONVEX_URL_PRODUCTION
}

function getDeploymentName(deploymentUrl, label) {
  if (!deploymentUrl) {
    throw new Error(`${label} is required`)
  }

  const hostname = new URL(deploymentUrl).hostname

  if (
    !hostname.endsWith(".convex.cloud") &&
    !hostname.endsWith(".convex.site")
  ) {
    throw new Error(
      `${label} must point to a hosted Convex deployment`
    )
  }

  return hostname.split(".")[0]
}

function getDeploymentTarget(env, environment) {
  const isDevelopment = environment === "development"
  const label = isDevelopment
    ? "CONVEX_URL_DEVELOPMENT or NEXT_PUBLIC_CONVEX_URL_DEVELOPMENT"
    : "CONVEX_URL_PRODUCTION or NEXT_PUBLIC_CONVEX_URL_PRODUCTION"
  const deploymentUrl = getDeploymentUrl(env, environment)

  return {
    deployment: getDeploymentName(deploymentUrl, label),
    deploymentUrl,
  }
}

function buildDryRunSummary(env) {
  const missing = []

  if (!(env.CONVEX_URL_DEVELOPMENT ?? env.NEXT_PUBLIC_CONVEX_URL_DEVELOPMENT)) {
    missing.push("CONVEX_URL_DEVELOPMENT or NEXT_PUBLIC_CONVEX_URL_DEVELOPMENT")
  }

  if (!(env.CONVEX_URL_PRODUCTION ?? env.NEXT_PUBLIC_CONVEX_URL_PRODUCTION)) {
    missing.push("CONVEX_URL_PRODUCTION or NEXT_PUBLIC_CONVEX_URL_PRODUCTION")
  }

  if (!env.CONVEX_SERVER_TOKEN_DEVELOPMENT) {
    missing.push("CONVEX_SERVER_TOKEN_DEVELOPMENT")
  }

  if (!env.CONVEX_SERVER_TOKEN_PRODUCTION) {
    missing.push("CONVEX_SERVER_TOKEN_PRODUCTION")
  }

  let developmentDeployment = null
  let productionDeployment = null

  try {
    developmentDeployment = getDeploymentTarget(env, "development").deployment
  } catch {
    developmentDeployment = null
  }

  try {
    productionDeployment = getDeploymentTarget(env, "production").deployment
  } catch {
    productionDeployment = null
  }

  return {
    mode: "dry-run",
    mutation: "app:wipeAllAppData",
    ready: missing.length === 0,
    missing,
    targets: [
      {
        environment: "development",
        deployment: developmentDeployment,
        hasServerToken: Boolean(env.CONVEX_SERVER_TOKEN_DEVELOPMENT),
      },
      {
        environment: "production",
        deployment: productionDeployment,
        hasServerToken: Boolean(env.CONVEX_SERVER_TOKEN_PRODUCTION),
      },
    ],
    note:
      "Run again with --execute after confirming the explicit development and production deployments and tokens.",
  }
}

function extractJsonResult(stdout) {
  const trimmed = stdout.trim()

  if (!trimmed) {
    throw new Error("Convex CLI returned no output")
  }

  const startIndex = trimmed.indexOf("{")

  if (startIndex === -1) {
    throw new Error(`Could not parse Convex CLI output: ${trimmed}`)
  }

  return JSON.parse(trimmed.slice(startIndex))
}

async function runConvex(args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [convexCliPath, ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", rejectPromise)
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }

      rejectPromise(
        new Error(
          `Convex CLI failed with exit code ${code ?? "unknown"}.\n${stderr || stdout}`
        )
      )
    })
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.execute && args.dryRun) {
    throw new Error("Choose either --execute or --dry-run, not both")
  }

  const env = getEnv()

  if (args.dryRun) {
    console.log(JSON.stringify(buildDryRunSummary(env), null, 2))
    return
  }

  if (!args.execute) {
    throw new Error(
      "Pass --execute to run the Convex data wipe or --dry-run to preview it"
    )
  }
  const devServerToken = env.CONVEX_SERVER_TOKEN_DEVELOPMENT
  const prodServerToken = env.CONVEX_SERVER_TOKEN_PRODUCTION
  const developmentTarget = getDeploymentTarget(env, "development")
  const productionTarget = getDeploymentTarget(env, "production")

  if (!devServerToken || !prodServerToken) {
    throw new Error(
      "CONVEX_SERVER_TOKEN_DEVELOPMENT and CONVEX_SERVER_TOKEN_PRODUCTION are required"
    )
  }

  const sharedRunArgs = [
    "run",
    "app:wipeAllAppData",
  ]
  const sharedFlags = ["--typecheck", "disable", "--codegen", "disable"]

  const development = await runConvex(
    [
      ...sharedRunArgs,
      JSON.stringify({ serverToken: devServerToken }),
      "--deployment",
      developmentTarget.deployment,
      ...sharedFlags,
    ],
    env
  )
  const production = await runConvex(
    [
      ...sharedRunArgs,
      JSON.stringify({ serverToken: prodServerToken }),
      "--deployment",
      productionTarget.deployment,
      ...sharedFlags,
    ],
    env
  )

  for (const target of [
    {
      environment: "development",
      deployment: developmentTarget.deployment,
      result: extractJsonResult(development.stdout),
    },
    {
      environment: "production",
      deployment: productionTarget.deployment,
      result: extractJsonResult(production.stdout),
    },
  ]) {
    console.log(JSON.stringify(target, null, 2))
  }
}

await main()
