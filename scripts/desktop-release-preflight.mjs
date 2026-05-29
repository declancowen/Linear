import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const { resolveDeepLinkScheme } = require("../electron/deep-links.cjs")

const repoRoot = path.resolve(__dirname, "..")
const electronOutputDir = path.join(repoRoot, "dist", "electron")
const appBundlePath = path.join(electronOutputDir, "Recipe Room.app")
const macReleaseArchitectures = ["arm64", "x64"]
const windowsReleaseArchitectures = ["arm64", "ia32", "x64"]
const primaryMacReleaseArchitecture = "arm64"
const releaseArchivePath = path.join(
  electronOutputDir,
  `Recipe-Room-mac-${primaryMacReleaseArchitecture}.zip`
)
const legacyArchivePath = path.join(
  electronOutputDir,
  "Recipe Room-mac-arm64.zip"
)
const releaseUpdateManifestPath = path.join(electronOutputDir, "latest-mac.yml")
const windowsReleaseUpdateManifestPath = path.join(
  electronOutputDir,
  "latest.yml"
)
const rendererDir = path.join(repoRoot, "dist", "desktop-renderer")
const rendererIndexPath = path.join(rendererDir, "index.html")
const rendererAssetsDir = path.join(rendererDir, "assets")
const infoPlistPath = path.join(appBundlePath, "Contents", "Info.plist")
const appAsarPath = path.join(
  appBundlePath,
  "Contents",
  "Resources",
  "app.asar"
)
const releasePolicyPath = path.join(repoRoot, "desktop", "release-policy.json")
const strictMode = process.env.DESKTOP_RELEASE_STRICT === "1"
const publicReleaseMode = process.env.DESKTOP_PUBLIC_RELEASE === "1"

const requiredHostedEnvNames = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_PARTYKIT_URL",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
  "DESKTOP_WORKOS_REDIRECT_URI",
  "DESKTOP_DEEP_LINK_SCHEME",
  "DESKTOP_API_ALLOWED_ORIGINS",
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
  "DESKTOP_SESSION_SECRET",
]

const serverOnlySecretNames = [
  "COLLABORATION_TOKEN_SECRET",
  "CONVEX_DEPLOY_KEY",
  "CONVEX_SERVER_TOKEN",
  "CRON_SECRET",
  "DESKTOP_SESSION_SECRET",
  "HMS_SECRET",
  "RESEND_API_KEY",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
]
const forbiddenRendererEndpointPatterns = [
  /http:\/\/localhost(?::\d+)?/gu,
  /http:\/\/127\.0\.0\.1(?::\d+)?/gu,
]

const results = []

function addResult(status, check, detail) {
  results.push({ status, check, detail })
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function formatList(values, limit = 5) {
  if (values.length <= limit) {
    return values.join(", ")
  }

  return `${values.slice(0, limit).join(", ")} and ${values.length - limit} more`
}

async function readSha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex")
}

function isPlaceholderValue(value) {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  return (
    !trimmed ||
    trimmed === "..." ||
    lower.includes("replace-with") ||
    lower.includes("your-") ||
    lower.includes("example.com") ||
    lower.includes("your-production-domain.com") ||
    lower.endsWith("_...") ||
    lower.endsWith(":...")
  )
}

function splitEnvList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed
  const separatorIndex = normalized.indexOf("=")

  if (separatorIndex === -1) {
    return null
  }

  const key = normalized.slice(0, separatorIndex).trim()
  let value = normalized.slice(separatorIndex + 1).trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return key ? [key, value] : null
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return null
  }
}

async function runCapture(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr}${error.message}`,
      })
    })
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function walkFiles(rootDir) {
  const files = []

  async function walk(currentDir) {
    let entries

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.isFile()) {
        files.push(entryPath)
      }
    }
  }

  await walk(rootDir)

  return files
}

async function collectFiles(fileOrDirPath) {
  try {
    const stat = await fs.stat(fileOrDirPath)

    if (stat.isFile()) {
      return [fileOrDirPath]
    }

    if (stat.isDirectory()) {
      return walkFiles(fileOrDirPath)
    }
  } catch {}

  return []
}

async function loadEnvSnapshot() {
  const env = new Map()
  const envFiles = [
    ".env",
    ".env.production",
    ".env.local",
    ".env.production.local",
    ".vercel/.env.production.local",
  ]

  for (const envFile of envFiles) {
    const contents = await readTextIfExists(path.join(repoRoot, envFile))

    if (!contents) {
      continue
    }

    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line)

      if (!parsed) {
        continue
      }

      const [key, value] = parsed
      env.set(key, { value, source: envFile })
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env.set(key, { value, source: "process.env" })
    }
  }

  return env
}

async function loadReleasePolicy() {
  try {
    return JSON.parse(await fs.readFile(releasePolicyPath, "utf8"))
  } catch {
    return null
  }
}

async function loadVercelProductionEnvNames() {
  const projectConfigText = await readTextIfExists(
    path.join(repoRoot, ".vercel", "project.json")
  )

  if (!projectConfigText) {
    return new Set()
  }

  let projectConfig

  try {
    projectConfig = JSON.parse(projectConfigText)
  } catch {
    return new Set()
  }

  const teamId = projectConfig.orgId

  if (!teamId) {
    return new Set()
  }

  const result = await runCapture("vercel", [
    "env",
    "ls",
    "production",
    "--scope",
    teamId,
    "--no-color",
  ])

  if (result.code !== 0) {
    return new Set()
  }

  return new Set(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim().match(/^([A-Z0-9_]+)\s+/u)?.[1])
      .filter(Boolean)
  )
}

function isInternalReleasePolicy(releasePolicy) {
  return releasePolicy?.channel === "internal" && !publicReleaseMode
}

function expectsGitHubReleaseArtifacts(releasePolicy) {
  return (
    process.env.DESKTOP_RELEASE_ARTIFACTS === "1" ||
    publicReleaseMode ||
    releasePolicy?.distribution === "github-release-dmg" ||
    releasePolicy?.distribution === "github-release-desktop-installers" ||
    releasePolicy?.updates === "electron-updater-github-releases"
  )
}

async function resolveDesktopArchivePath() {
  for (const candidatePath of [releaseArchivePath, legacyArchivePath]) {
    if (await pathExists(candidatePath)) {
      return candidatePath
    }
  }

  return expectsGitHubReleaseArtifacts(await loadReleasePolicy())
    ? releaseArchivePath
    : legacyArchivePath
}

function getUsableEnvValue(env, key) {
  const entry = env.get(key)

  if (!entry || isPlaceholderValue(entry.value)) {
    return null
  }

  return entry.value
}

async function checkArtifactPresence(releasePolicy) {
  const archivePath = await resolveDesktopArchivePath()
  const artifactChecks = [
    ["Packaged app bundle", appBundlePath],
    ["Desktop archive", archivePath],
    ["Packaged renderer entry", rendererIndexPath],
  ]

  if (expectsGitHubReleaseArtifacts(releasePolicy)) {
    for (const architecture of macReleaseArchitectures) {
      artifactChecks.push(
        [
          `Desktop macOS DMG (${architecture})`,
          path.join(electronOutputDir, `Recipe-Room-mac-${architecture}.dmg`),
        ],
        [
          `Desktop macOS ZIP (${architecture})`,
          path.join(electronOutputDir, `Recipe-Room-mac-${architecture}.zip`),
        ]
      )
    }

    for (const architecture of windowsReleaseArchitectures) {
      artifactChecks.push([
        `Desktop Windows installer (${architecture})`,
        path.join(electronOutputDir, `Recipe-Room-win-${architecture}.exe`),
      ])
    }

    artifactChecks.push(
      ["macOS updater manifest", releaseUpdateManifestPath],
      ["Windows updater manifest", windowsReleaseUpdateManifestPath]
    )
  }

  for (const [name, artifactPath] of artifactChecks) {
    if (await pathExists(artifactPath)) {
      addResult("pass", name, path.relative(repoRoot, artifactPath))
      continue
    }

    addResult(
      "fail",
      name,
      `${path.relative(repoRoot, artifactPath)} is missing`
    )
  }
}

async function readPackagedInfoPlist() {
  const result = await runCapture("plutil", [
    "-convert",
    "json",
    "-o",
    "-",
    infoPlistPath,
  ])

  if (result.code !== 0) {
    return {
      error: `Could not parse Info.plist: ${(result.stderr || result.stdout).trim()}`,
    }
  }

  try {
    return {
      plist: JSON.parse(result.stdout),
    }
  } catch (error) {
    return {
      error: `Invalid plist JSON: ${error.message}`,
    }
  }
}

function checkDeepLinkRegistration(plist) {
  const expectedScheme = resolveDeepLinkScheme(process.env)
  const schemes = (plist.CFBundleURLTypes ?? []).flatMap(
    (urlType) => urlType.CFBundleURLSchemes ?? []
  )

  if (schemes.includes(expectedScheme)) {
    addResult(
      "pass",
      "Deep-link registration",
      `Scheme ${expectedScheme} is registered`
    )
    return
  }

  addResult(
    "fail",
    "Deep-link registration",
    `Expected scheme ${expectedScheme}; found ${schemes.join(", ") || "none"}`
  )
}

function checkMacTransportSecurity(plist) {
  const appTransportSecurity = plist.NSAppTransportSecurity

  if (appTransportSecurity?.NSAllowsArbitraryLoads === true) {
    addResult(
      "fail",
      "macOS transport security",
      "NSAllowsArbitraryLoads is true in the packaged app"
    )
    return
  }

  if (appTransportSecurity?.NSAllowsArbitraryLoads === false) {
    addResult(
      "pass",
      "macOS transport security",
      "Broad arbitrary network loads are disabled"
    )
    return
  }

  addResult(
    "warn",
    "macOS transport security",
    "NSAllowsArbitraryLoads is not explicit"
  )
}

async function checkAsarIntegrity(plist) {
  const asarIntegrityHash =
    plist.ElectronAsarIntegrity?.["Resources/app.asar"]?.hash

  if (!(await pathExists(appAsarPath))) {
    addResult("fail", "Electron asar integrity", "Packaged app.asar is missing")
    return
  }

  if (!asarIntegrityHash) {
    addResult(
      "fail",
      "Electron asar integrity",
      "Info.plist is missing ElectronAsarIntegrity for Resources/app.asar"
    )
    return
  }

  const actualAsarHash = await readSha256(appAsarPath)

  if (actualAsarHash === asarIntegrityHash) {
    addResult(
      "pass",
      "Electron asar integrity",
      "Info.plist hash matches packaged app.asar"
    )
    return
  }

  addResult(
    "fail",
    "Electron asar integrity",
    "Info.plist hash does not match packaged app.asar"
  )
}

async function checkInfoPlist() {
  if (!(await pathExists(infoPlistPath))) {
    addResult("fail", "macOS Info.plist", "Packaged app Info.plist is missing")
    return
  }

  const { error, plist } = await readPackagedInfoPlist()

  if (error) {
    addResult("fail", "macOS Info.plist", error)
    return
  }

  checkDeepLinkRegistration(plist)
  checkMacTransportSecurity(plist)
  await checkAsarIntegrity(plist)
}

async function extractArchiveForVerification() {
  const archivePath = await resolveDesktopArchivePath()

  if (!(await pathExists(archivePath))) {
    return {
      error: `${path.relative(repoRoot, archivePath)} is missing`,
    }
  }

  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "recipe-room-desktop-preflight-")
  )
  const result = await runCapture("ditto", ["-x", "-k", archivePath, tempRoot])

  if (result.code !== 0) {
    await fs.rm(tempRoot, { force: true, recursive: true })
    return {
      error: `Could not extract desktop archive: ${(
        result.stderr || result.stdout
      ).trim()}`,
    }
  }

  const extractedAppPath = path.join(tempRoot, "Recipe Room.app")

  if (!(await pathExists(extractedAppPath))) {
    await fs.rm(tempRoot, { force: true, recursive: true })
    return {
      error: "Desktop archive did not contain Recipe Room.app",
    }
  }

  return {
    appPath: extractedAppPath,
    cleanup: () => fs.rm(tempRoot, { force: true, recursive: true }),
  }
}

async function resolveMacSigningVerificationApp() {
  const archiveVerification = await extractArchiveForVerification()

  if (archiveVerification.error) {
    addResult("fail", "Desktop archive extraction", archiveVerification.error)
    return {
      cleanup: null,
      verificationAppPath: appBundlePath,
    }
  } else {
    addResult(
      "pass",
      "Desktop archive extraction",
      "Archive extracts to Recipe Room.app for signature verification"
    )
  }

  return {
    cleanup: archiveVerification.cleanup,
    verificationAppPath: archiveVerification.appPath,
  }
}

async function checkMacSignatureIntegrity(verificationAppPath) {
  const strictCodesign = await runCapture("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    verificationAppPath,
  ])
  const strictCodesignOutput =
    `${strictCodesign.stdout}${strictCodesign.stderr}`.trim()

  if (strictCodesign.code === 0) {
    addResult(
      "pass",
      "macOS signature integrity",
      "codesign --verify --deep --strict accepts the archived app"
    )
    return
  }

  addResult(
    "fail",
    "macOS signature integrity",
    strictCodesignOutput ||
      "codesign --verify --deep --strict rejected the packaged app"
  )
}

async function checkMacCodeSigningIdentity(verificationAppPath, releasePolicy) {
  const codesign = await runCapture("codesign", [
    "-dv",
    "--verbose=4",
    verificationAppPath,
  ])
  const codesignOutput = `${codesign.stdout}${codesign.stderr}`

  if (codesign.code !== 0) {
    addResult(
      "fail",
      "macOS code signing",
      `codesign failed: ${codesignOutput.trim()}`
    )
  } else if (
    codesignOutput.includes("Signature=adhoc") ||
    codesignOutput.includes("TeamIdentifier=not set")
  ) {
    if (isInternalReleasePolicy(releasePolicy)) {
      addResult(
        "pass",
        "macOS code signing",
        "Ad-hoc signing is explicitly accepted by desktop/release-policy.json for internal builds"
      )
    } else {
      addResult(
        "pending",
        "macOS code signing",
        "Current build is ad-hoc signed; public releases need Developer ID signing"
      )
    }
  } else {
    addResult(
      "pass",
      "macOS code signing",
      "Developer signing identity is present"
    )
  }
}

async function checkMacGatekeeper(releasePolicy) {
  const spctl = await runCapture("spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    appBundlePath,
  ])
  const spctlOutput = `${spctl.stdout}${spctl.stderr}`.trim()

  if (spctl.code === 0) {
    addResult("pass", "macOS Gatekeeper", "spctl accepts the packaged app")
  } else if (isInternalReleasePolicy(releasePolicy)) {
    addResult(
      "pass",
      "macOS Gatekeeper",
      "Gatekeeper rejection is accepted only for internal local-zip builds"
    )
  } else {
    addResult(
      "pending",
      "macOS Gatekeeper",
      spctlOutput || "spctl did not accept the packaged app"
    )
  }
}

async function checkMacSigning(releasePolicy) {
  if (!(await pathExists(appBundlePath))) {
    return
  }

  const { cleanup, verificationAppPath } =
    await resolveMacSigningVerificationApp()

  try {
    await checkMacSignatureIntegrity(verificationAppPath)
    await checkMacCodeSigningIdentity(verificationAppPath, releasePolicy)
  } finally {
    await cleanup?.()
  }

  await checkMacGatekeeper(releasePolicy)
}

function collectRootAbsoluteAssetReferences(indexHtml) {
  return [
    ...indexHtml.matchAll(/\b(?:src|href)=["']\/assets\/[^"']+["']/gu),
  ].map((match) => match[0])
}

function checkRendererAssetUrls(indexHtml) {
  const rootAbsoluteAssetReferences =
    collectRootAbsoluteAssetReferences(indexHtml)

  if (rootAbsoluteAssetReferences.length > 0) {
    addResult(
      "fail",
      "Renderer file asset URLs",
      `Packaged file:// renderer cannot load root-absolute asset URLs: ${formatList(
        rootAbsoluteAssetReferences
      )}`
    )
    return
  }

  addResult(
    "pass",
    "Renderer file asset URLs",
    "Startup HTML uses relative asset URLs for file:// loading"
  )
}

function collectStylesheetReferences(indexHtml) {
  return [...indexHtml.matchAll(/\bhref=["']\.\/([^"']+\.css)["']/gu)].map(
    (match) => match[1]
  )
}

async function readRendererStyles(indexHtml) {
  return (
    await Promise.all(
      collectStylesheetReferences(indexHtml).map((assetPath) =>
        fs.readFile(path.join(rendererDir, assetPath), "utf8").catch(() => "")
      )
    )
  ).join("\n")
}

async function checkRendererFontParity(indexHtml) {
  if (!indexHtml.includes("fonts.googleapis.com")) {
    addResult(
      "fail",
      "Renderer font parity",
      "Startup HTML does not load the desktop web font stylesheet"
    )
    return
  }

  const rendererStyles = await readRendererStyles(indexHtml)

  if (
    rendererStyles.includes("--font-sans") &&
    rendererStyles.includes("Noto Sans")
  ) {
    addResult(
      "pass",
      "Renderer font parity",
      "Packaged renderer defines the same primary font family as the web app"
    )
    return
  }

  addResult(
    "fail",
    "Renderer font parity",
    "Packaged renderer CSS does not define the desktop font variables"
  )
}

async function collectRendererBundleFiles() {
  return [
    rendererIndexPath,
    ...(await walkFiles(rendererAssetsDir)).filter((filePath) =>
      /\.(css|js)$/u.test(filePath)
    ),
  ]
}

async function collectForbiddenEndpointMatches(rendererBundleFiles) {
  const forbiddenEndpointMatches = []

  for (const filePath of rendererBundleFiles) {
    const contents = await fs.readFile(filePath, "utf8")

    for (const pattern of forbiddenRendererEndpointPatterns) {
      const matches = contents.match(pattern)

      if (matches) {
        forbiddenEndpointMatches.push(
          `${path.relative(repoRoot, filePath)}: ${formatList([
            ...new Set(matches),
          ])}`
        )
      }
    }
  }

  return forbiddenEndpointMatches
}

async function checkRendererProductionEndpoints() {
  const forbiddenEndpointMatches = await collectForbiddenEndpointMatches(
    await collectRendererBundleFiles()
  )

  if (forbiddenEndpointMatches.length > 0) {
    addResult(
      "fail",
      "Renderer production endpoints",
      `Packaged renderer contains local development endpoints: ${formatList(
        forbiddenEndpointMatches
      )}`
    )
    return
  }

  addResult(
    "pass",
    "Renderer production endpoints",
    "Packaged renderer does not contain localhost API/auth origins"
  )
}

async function collectRendererAssetSizes() {
  const assetFiles = (await walkFiles(rendererAssetsDir)).filter((filePath) =>
    filePath.endsWith(".js")
  )
  const sizes = new Map()

  for (const filePath of assetFiles) {
    const stat = await fs.stat(filePath)
    sizes.set(path.basename(filePath), stat.size)
  }

  return sizes
}

function checkRendererStartupChunk(indexHtml, sizes) {
  const entryMatch = indexHtml.match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/u
  )
  const entryName = entryMatch ? path.basename(entryMatch[1]) : null
  const entrySize = entryName ? sizes.get(entryName) : null

  if (!entryName || typeof entrySize !== "number") {
    addResult(
      "fail",
      "Renderer startup chunk",
      "Could not resolve module entry chunk"
    )
  } else if (entrySize > 300 * 1024) {
    addResult(
      "fail",
      "Renderer startup chunk",
      `${entryName} is ${formatBytes(entrySize)}; expected <= 300.0 KiB`
    )
  } else {
    addResult(
      "pass",
      "Renderer startup chunk",
      `${entryName} is ${formatBytes(entrySize)}`
    )
  }
}

function checkRendererSignedInChunk(sizes) {
  const signedInChunk = [...sizes.entries()].find(([name]) =>
    name.startsWith("desktop-signed-in-app-")
  )

  if (!signedInChunk) {
    addResult(
      "warn",
      "Signed-in renderer chunk",
      "Could not find desktop-signed-in-app chunk"
    )
  } else if (signedInChunk[1] > 300 * 1024) {
    addResult(
      "warn",
      "Signed-in renderer chunk",
      `${signedInChunk[0]} is ${formatBytes(signedInChunk[1])}; review startup cost`
    )
  } else {
    addResult(
      "pass",
      "Signed-in renderer chunk",
      `${signedInChunk[0]} is ${formatBytes(signedInChunk[1])}`
    )
  }
}

function checkRendererRouteChunkBudget(sizes) {
  const routeChunkBudgetBytes = 2 * 1024 * 1024
  const largeRouteChunks = [...sizes.entries()]
    .filter(
      ([name, size]) =>
        (name.startsWith("app-collaboration-") ||
          name.startsWith("app-screens-")) &&
        size > routeChunkBudgetBytes
    )
    .map(([name, size]) => `${name} (${formatBytes(size)})`)

  if (largeRouteChunks.length > 0) {
    addResult(
      "warn",
      "Route-local chunk budget",
      `${formatList(largeRouteChunks)} exceed ${formatBytes(routeChunkBudgetBytes)}`
    )
  } else {
    addResult(
      "pass",
      "Route-local chunk budget",
      `No route chunk exceeds ${formatBytes(routeChunkBudgetBytes)}`
    )
  }
}

function checkRendererModulePreload(indexHtml, sizes) {
  const largePreloads = [
    ...indexHtml.matchAll(
      /rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gu
    ),
  ]
    .map((match) => path.basename(match[1]))
    .filter((name) => (sizes.get(name) ?? 0) > 500 * 1024)

  if (largePreloads.length > 0) {
    addResult(
      "warn",
      "Renderer modulepreload",
      `Startup HTML preloads large lazy chunks: ${formatList(largePreloads)}`
    )
    return
  }

  addResult(
    "pass",
    "Renderer modulepreload",
    "Startup HTML does not preload large lazy chunks"
  )
}

async function checkRendererBundle() {
  if (!(await pathExists(rendererIndexPath))) {
    return
  }

  const indexHtml = await fs.readFile(rendererIndexPath, "utf8")
  const sizes = await collectRendererAssetSizes()

  checkRendererAssetUrls(indexHtml)
  await checkRendererFontParity(indexHtml)
  await checkRendererProductionEndpoints()
  checkRendererStartupChunk(indexHtml, sizes)
  checkRendererSignedInChunk(sizes)
  checkRendererRouteChunkBudget(sizes)
  checkRendererModulePreload(indexHtml, sizes)
}

async function collectArtifactScanFiles() {
  const appResourcesDir = path.join(appBundlePath, "Contents", "Resources")
  const scanRoots = [
    path.join(appResourcesDir, "app.asar"),
    path.join(appResourcesDir, "app.asar.unpacked"),
    rendererDir,
  ]
  const artifactFiles = []

  for (const scanRoot of scanRoots) {
    artifactFiles.push(...(await collectFiles(scanRoot)))
  }

  return artifactFiles
}

async function collectSecretNameLeaks(artifactFiles) {
  const leakedNames = new Set()

  for (const filePath of artifactFiles.filter(
    (artifactFilePath) => !artifactFilePath.endsWith(".map")
  )) {
    const contents = await fs.readFile(filePath)
    const text = contents.toString("utf8")

    for (const secretName of serverOnlySecretNames) {
      if (text.includes(secretName)) {
        leakedNames.add(secretName)
      }
    }
  }

  return leakedNames
}

function collectSensitiveValues(env) {
  const sensitiveValues = new Map()

  for (const secretName of serverOnlySecretNames) {
    const value = getUsableEnvValue(env, secretName)

    if (value && value.length >= 8) {
      sensitiveValues.set(secretName, value)
    }
  }

  return sensitiveValues
}

async function collectSecretValueLeaks(artifactFiles, sensitiveValues) {
  const leakedValues = new Set()

  for (const filePath of artifactFiles) {
    const contents = await fs.readFile(filePath)

    for (const [secretName, secretValue] of sensitiveValues) {
      if (contents.includes(Buffer.from(secretValue))) {
        leakedValues.add(secretName)
      }
    }
  }

  return leakedValues
}

function reportSecretNameScan(leakedNames) {
  if (leakedNames.size > 0) {
    addResult(
      "fail",
      "Server secret name scan",
      `Artifacts reference server-only names: ${formatList([...leakedNames].sort())}`
    )
  } else {
    addResult(
      "pass",
      "Server secret name scan",
      "No server-only env names found in non-map artifacts"
    )
  }
}

function reportSecretValueScan(leakedValues, sensitiveValues) {
  if (leakedValues.size > 0) {
    addResult(
      "fail",
      "Server secret value scan",
      `Artifacts contain local values for: ${formatList([...leakedValues].sort())}`
    )
  } else if (sensitiveValues.size > 0) {
    addResult(
      "pass",
      "Server secret value scan",
      `Checked ${sensitiveValues.size} local server-only values without printing them`
    )
  } else {
    addResult(
      "pending",
      "Server secret value scan",
      "No local server-only values were available to compare against artifacts"
    )
  }
}

async function checkArtifactSecrets(env) {
  const artifactFiles = await collectArtifactScanFiles()
  const leakedNames = await collectSecretNameLeaks(artifactFiles)
  const sensitiveValues = collectSensitiveValues(env)
  const leakedValues = await collectSecretValueLeaks(
    artifactFiles,
    sensitiveValues
  )

  reportSecretNameScan(leakedNames)
  reportSecretValueScan(leakedValues, sensitiveValues)
}

async function checkHostedApiCorsDeployment(apiBaseUrl, origins) {
  if (!apiBaseUrl || !origins.includes("null")) {
    addResult(
      "pending",
      "Hosted API CORS deployment",
      "Hosted API base URL and null desktop origin must be configured before live CORS smoke"
    )
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(
      new URL("/api/auth/desktop/session", apiBaseUrl),
      {
        method: "OPTIONS",
        headers: {
          Origin: "null",
          "Access-Control-Request-Method": "POST",
        },
        signal: controller.signal,
      }
    )
    const allowOrigin = response.headers.get("access-control-allow-origin")
    const allowMethods = response.headers.get("access-control-allow-methods")

    if (
      response.ok &&
      allowOrigin === "null" &&
      allowMethods?.toUpperCase().includes("POST")
    ) {
      addResult(
        "pass",
        "Hosted API CORS deployment",
        "Production API preflight accepts the packaged file:// renderer origin"
      )
      return
    }

    addResult(
      "pending",
      "Hosted API CORS deployment",
      `Production API preflight not ready yet: HTTP ${response.status}, allow-origin ${allowOrigin ?? "missing"}`
    )
  } catch (error) {
    addResult(
      "pending",
      "Hosted API CORS deployment",
      `Production API preflight could not be verified: ${error.message}`
    )
  } finally {
    clearTimeout(timeout)
  }
}

function hasHostedEnvName(env, vercelProductionEnvNames, name) {
  return Boolean(
    getUsableEnvValue(env, name) || vercelProductionEnvNames.has(name)
  )
}

async function checkHostedEnv(env, vercelProductionEnvNames) {
  const missing = requiredHostedEnvNames.filter(
    (name) => !hasHostedEnvName(env, vercelProductionEnvNames, name)
  )

  checkHostedEnvNames(missing)
  checkHostedApiBaseUrl(env)
  await checkHostedCorsAndRedirects(env)
}

function checkHostedEnvNames(missing) {
  if (missing.length > 0) {
    addResult(
      "pending",
      "Hosted environment names",
      `Not visible locally or placeholder-like: ${formatList(missing)}`
    )
  } else {
    addResult(
      "pass",
      "Hosted environment names",
      "Required desktop/web env names are present locally"
    )
  }
}

function checkHostedApiBaseUrl(env) {
  const apiBaseUrl = getUsableEnvValue(env, "NEXT_PUBLIC_API_BASE_URL")

  if (apiBaseUrl && isHttpsUrl(apiBaseUrl)) {
    addResult(
      "pass",
      "Hosted API base URL",
      "NEXT_PUBLIC_API_BASE_URL is HTTPS"
    )
  } else {
    addResult(
      "pending",
      "Hosted API base URL",
      "Packaged desktop should build with an HTTPS NEXT_PUBLIC_API_BASE_URL"
    )
  }
}

function checkDesktopCorsOrigins(origins, corsOrigins) {
  if (!corsOrigins) {
    addResult(
      "pending",
      "Desktop API CORS origins",
      "DESKTOP_API_ALLOWED_ORIGINS is not configured locally"
    )
    return
  }

  if (origins.includes("*")) {
    addResult(
      "fail",
      "Desktop API CORS origins",
      "Wildcard origin is not allowed"
    )
  } else if (origins.includes("null")) {
    addResult(
      "pass",
      "Desktop API CORS origins",
      "Includes null for the current file:// packaged renderer"
    )
  } else {
    addResult(
      "pending",
      "Desktop API CORS origins",
      `Current file:// packaged renderer needs null; configured ${formatList(origins)}`
    )
  }
}

function checkWorkOSRedirectContract(env) {
  const webRedirect = getUsableEnvValue(env, "NEXT_PUBLIC_WORKOS_REDIRECT_URI")
  const desktopRedirect = getUsableEnvValue(env, "DESKTOP_WORKOS_REDIRECT_URI")

  if (
    webRedirect &&
    desktopRedirect &&
    isHttpsUrl(webRedirect) &&
    isHttpsUrl(desktopRedirect)
  ) {
    addResult(
      "pass",
      "WorkOS redirect env contract",
      "Web and desktop callback URLs are HTTPS"
    )
  } else {
    addResult(
      "pending",
      "WorkOS redirect env contract",
      "Expected HTTPS web callback and HTTPS desktop callback env values"
    )
  }
}

function checkWorkOSRedirectAllowlistMarker(env) {
  if (getUsableEnvValue(env, "DESKTOP_WORKOS_REDIRECTS_VERIFIED") === "1") {
    addResult(
      "pass",
      "WorkOS dashboard redirect allowlist",
      "Manual verification marker is set"
    )
  } else {
    addResult(
      "pending",
      "WorkOS dashboard redirect allowlist",
      "Verify WorkOS contains the web callback and desktop callback/deep-link redirect"
    )
  }
}

async function checkHostedCorsDeployment(env, apiBaseUrl, origins) {
  if (getUsableEnvValue(env, "DESKTOP_HOSTED_API_CORS_VERIFIED") === "1") {
    addResult(
      "pass",
      "Hosted API CORS deployment",
      "Manual verification marker is set"
    )
  } else {
    await checkHostedApiCorsDeployment(apiBaseUrl, origins)
  }
}

async function checkHostedCorsAndRedirects(env) {
  const corsOrigins = getUsableEnvValue(env, "DESKTOP_API_ALLOWED_ORIGINS")
  const origins = corsOrigins ? splitEnvList(corsOrigins) : []
  const apiBaseUrl = getUsableEnvValue(env, "NEXT_PUBLIC_API_BASE_URL")

  checkDesktopCorsOrigins(origins, corsOrigins)
  checkWorkOSRedirectContract(env)
  checkWorkOSRedirectAllowlistMarker(env)
  await checkHostedCorsDeployment(env, apiBaseUrl, origins)
}

async function checkUpdaterOwnership(releasePolicy) {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8")
  )
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  }
  const electronFiles = await walkFiles(path.join(repoRoot, "electron"))
  let hasUpdaterCode = Boolean(dependencies["electron-updater"])

  for (const filePath of electronFiles) {
    const text = await fs.readFile(filePath, "utf8")

    if (text.includes("autoUpdater") || text.includes("electron-updater")) {
      hasUpdaterCode = true
      break
    }
  }

  if (hasUpdaterCode) {
    addResult(
      "pass",
      "Update path ownership",
      "Updater code/dependency is present"
    )
  } else if (
    process.env.DESKTOP_RELEASE_CHANNEL === "internal" ||
    isInternalReleasePolicy(releasePolicy)
  ) {
    addResult(
      "pass",
      "Update path ownership",
      "Manual rebuild/repackage is explicitly accepted by desktop/release-policy.json for internal builds"
    )
  } else {
    addResult(
      "pending",
      "Update path ownership",
      "No updater implementation found; add one or mark the release internal-only"
    )
  }
}

function printSummary() {
  const counts = results.reduce(
    (accumulator, result) => {
      accumulator[result.status] += 1
      return accumulator
    },
    { fail: 0, pass: 0, pending: 0, warn: 0 }
  )

  for (const result of results) {
    console.log(
      `${result.status.toUpperCase().padEnd(7)} ${result.check} - ${result.detail}`
    )
  }

  console.log("")
  console.log(
    `Summary: ${counts.pass} pass, ${counts.warn} warn, ${counts.pending} pending, ${counts.fail} fail`
  )

  if (strictMode && (counts.warn > 0 || counts.pending > 0)) {
    console.log(
      "Strict mode treats warnings and pending checks as release blockers."
    )
  }

  if (
    counts.fail > 0 ||
    (strictMode && (counts.warn > 0 || counts.pending > 0))
  ) {
    process.exitCode = 1
  }
}

const env = await loadEnvSnapshot()
const releasePolicy = await loadReleasePolicy()
const vercelProductionEnvNames = await loadVercelProductionEnvNames()

await checkArtifactPresence(releasePolicy)
await checkInfoPlist()
await checkMacSigning(releasePolicy)
await checkRendererBundle()
await checkArtifactSecrets(env)
await checkHostedEnv(env, vercelProductionEnvNames)
await checkUpdaterOwnership(releasePolicy)
printSummary()
