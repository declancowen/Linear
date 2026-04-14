import { spawn } from "node:child_process"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const require = createRequire(import.meta.url)
const convexPackageRoot = dirname(require.resolve("convex/package.json"))
const convexCliPath = join(convexPackageRoot, "bin/main.js")

function parseArgs(argv) {
  return {
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
  const fileValues = loadEnvFile(resolve(process.cwd(), ".env.local"))
  return {
    ...fileValues,
    ...process.env,
  }
}

function getProdDeploymentName(env) {
  const deploymentUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL

  if (!deploymentUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required")
  }

  return new URL(deploymentUrl).hostname.split(".")[0]
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

  if (!args.execute) {
    throw new Error("Pass --execute to run the Convex data wipe")
  }

  const env = getEnv()
  const devServerToken = env.CONVEX_SERVER_TOKEN_DEVELOPMENT
  const prodServerToken = env.CONVEX_SERVER_TOKEN_PRODUCTION

  if (!devServerToken || !prodServerToken) {
    throw new Error(
      "CONVEX_SERVER_TOKEN_DEVELOPMENT and CONVEX_SERVER_TOKEN_PRODUCTION are required"
    )
  }

  const tempDir = mkdtempSync(join(tmpdir(), "convex-wipe-"))
  const envFilePath = join(tempDir, "convex.env")

  try {
    writeFileSync(
      envFilePath,
      `CONVEX_DEPLOYMENT=prod:${getProdDeploymentName(env)}\n`,
      "utf8"
    )

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
        "dev",
        "--env-file",
        envFilePath,
        ...sharedFlags,
      ],
      env
    )
    const production = await runConvex(
      [
        ...sharedRunArgs,
        JSON.stringify({ serverToken: prodServerToken }),
        ...sharedFlags,
      ],
      env
    )

    for (const target of [
      {
        environment: "development",
        result: extractJsonResult(development.stdout),
      },
      {
        environment: "production",
        result: extractJsonResult(production.stdout),
      },
    ]) {
      console.log(JSON.stringify(target, null, 2))
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
}

await main()
