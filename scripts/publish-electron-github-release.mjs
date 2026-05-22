import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const defaultOutputDir = path.join(repoRoot, "dist", "electron")
const execFileAsync = promisify(execFile)

function parseArgs(argv) {
  const options = {
    draft: false,
    dryRun: false,
    outputDir: defaultOutputDir,
    prerelease: false,
    repo: undefined,
    tag: undefined,
    version: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--draft") {
      options.draft = true
    } else if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--prerelease") {
      options.prerelease = true
    } else if (arg === "--output-dir") {
      options.outputDir = path.resolve(repoRoot, argv[++index] ?? "")
    } else if (arg === "--repo") {
      options.repo = argv[++index]
    } else if (arg === "--tag") {
      options.tag = argv[++index]
    } else if (arg === "--version") {
      options.version = argv[++index]
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function run(command, args, options = {}) {
  if (options.dryRun) {
    console.log([command, ...args].map(JSON.stringify).join(" "))
    return Promise.resolve("")
  }

  return execFileAsync(command, args, { cwd: repoRoot }).then(
    ({ stdout }) => stdout,
    (error) => {
      const output = error.stdout || ""
      const errorOutput = error.stderr || output
      const exitCode = error.code
      const processError = new Error(
        `${command} exited with code ${exitCode}: ${errorOutput}`
      )
      processError.exitCode = exitCode
      throw processError
    }
  )
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readPackageVersion(explicitVersion) {
  if (explicitVersion) {
    return explicitVersion.replace(/^v/u, "")
  }

  const packageJson = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8")
  )

  return packageJson.version
}

async function findReleaseAssets(outputDir) {
  const entries = await fs.readdir(outputDir, { withFileTypes: true })
  const assets = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(outputDir, entry.name))
    .filter((filePath) => {
      const extension = path.extname(filePath)

      return (
        [".blockmap", ".dmg", ".zip"].includes(extension) ||
        path.basename(filePath) === "latest-mac.yml"
      )
    })
    .sort()

  const basenames = assets.map((asset) => path.basename(asset))
  const hasDmg = basenames.some((name) => name.endsWith(".dmg"))
  const hasZip = basenames.some((name) => name.endsWith(".zip"))
  const hasMacManifest = basenames.includes("latest-mac.yml")

  if (!hasDmg || !hasZip || !hasMacManifest) {
    throw new Error(
      `Expected ${outputDir} to contain a DMG, ZIP, and latest-mac.yml. Run pnpm desktop:release:mac first.`
    )
  }

  return assets
}

async function releaseExists(tag, repo, dryRun) {
  if (dryRun) {
    return process.env.DESKTOP_RELEASE_DRY_RUN_EXISTS === "1"
  }

  try {
    await run("gh", ["release", "view", tag, ...(repo ? ["--repo", repo] : [])])
    return true
  } catch (error) {
    if (error.exitCode === 1) {
      return false
    }

    throw error
  }
}

function getBooleanFlagArgs(flag, enabled, explicitFalse) {
  if (enabled) {
    return [flag]
  }

  if (explicitFalse) {
    return [`${flag}=false`]
  }

  return []
}

function getReleaseStateArgs(options, { explicitFalse = false } = {}) {
  return [
    ...getBooleanFlagArgs("--draft", options.draft, explicitFalse),
    ...getBooleanFlagArgs("--prerelease", options.prerelease, explicitFalse),
  ]
}

function getLatestArgs(options) {
  return options.draft || options.prerelease ? ["--latest=false"] : ["--latest"]
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const version = await readPackageVersion(options.version)
  const tag = options.tag ?? `v${version}`
  const releaseName = `Recipe Room ${tag}`
  const repoArgs = options.repo ? ["--repo", options.repo] : []
  const dryRun = options.dryRun

  if (!(await pathExists(options.outputDir))) {
    throw new Error(`Output directory does not exist: ${options.outputDir}`)
  }

  const assets = await findReleaseAssets(options.outputDir)

  if (await releaseExists(tag, options.repo, dryRun)) {
    await run(
      "gh",
      ["release", "upload", tag, ...assets, "--clobber", ...repoArgs],
      { dryRun }
    )
    await run(
      "gh",
      [
        "release",
        "edit",
        tag,
        ...getReleaseStateArgs(options, { explicitFalse: true }),
        ...getLatestArgs(options),
        ...repoArgs,
      ],
      { dryRun }
    )
    console.log(`Uploaded ${assets.length} assets to existing release ${tag}.`)
    return
  }

  await run(
    "gh",
    [
      "release",
      "create",
      tag,
      ...assets,
      "--title",
      releaseName,
      "--generate-notes",
      ...getLatestArgs(options),
      ...getReleaseStateArgs(options),
      ...repoArgs,
    ],
    { dryRun }
  )
  console.log(`Created GitHub release ${tag} with ${assets.length} assets.`)
}

await main()
