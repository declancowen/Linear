import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const MAX_EXAMPLE_PATHS = 12
const DESKTOP_RENDERER_ENTRY = "dist/desktop-renderer/index.html"
const DESKTOP_RENDERER_DIR = "dist/desktop-renderer"

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
])

const serverRuntimePatterns = [
  {
    label: "WorkOS/AuthKit server auth",
    pattern: /\bwithAuth\s*\(/,
  },
  {
    label: "request cookies",
    pattern: /\bcookies\s*\(/,
  },
  {
    label: "request headers",
    pattern: /\bheaders\s*\(/,
  },
  {
    label: "server-only app helpers",
    pattern: /@\/lib\/server\//,
  },
]
const forbiddenProductionEndpointPatterns = [
  /http:\/\/localhost(?::\d+)?/gu,
  /http:\/\/127\.0\.0\.1(?::\d+)?/gu,
]

const nextClientRuntimePatterns = [
  {
    label: "Next Link",
    pattern: /from ["']next\/link["']/,
  },
  {
    label: "Next navigation hooks",
    pattern: /from ["']next\/navigation["']/,
  },
  {
    label: "Next Image",
    pattern: /from ["']next\/image["']/,
  },
  {
    label: "Next theme provider",
    pattern: /from ["']next-themes["']/,
  },
]

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await walkFiles(entryPath)))
      }

      continue
    }

    if (entry.isFile() && /\.(tsx?|mjs|cjs|js|css|html)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function toRelativePath(filePath) {
  return path.relative(repoRoot, filePath)
}

function formatExamples(paths) {
  return paths.slice(0, MAX_EXAMPLE_PATHS)
}

async function readFile(filePath) {
  return fs.readFile(filePath, "utf8").catch(() => "")
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function findPatternMatches(files, patterns) {
  const matches = new Map(patterns.map((pattern) => [pattern.label, []]))

  for (const filePath of files) {
    const contents = await readFile(filePath)

    for (const pattern of patterns) {
      if (pattern.pattern.test(contents)) {
        matches.get(pattern.label)?.push(toRelativePath(filePath))
      }
    }
  }

  return [...matches.entries()]
    .filter(([, paths]) => paths.length > 0)
    .map(([label, paths]) => ({
      label,
      count: paths.length,
      examples: formatExamples(paths),
    }))
}

async function collectReadinessContext() {
  const nextConfig = await readFile(path.join(repoRoot, "next.config.mjs"))
  const rendererEntry = await readFile(
    path.join(repoRoot, DESKTOP_RENDERER_ENTRY)
  )
  const appFiles = (await walkFiles(path.join(repoRoot, "app"))).filter(
    (filePath) => /\.(tsx?|mjs)$/.test(filePath)
  )
  const componentFiles = await walkFiles(path.join(repoRoot, "components"))
  const appApiRoutes = appFiles.filter((filePath) =>
    toRelativePath(filePath).startsWith("app/api/")
  )
  const hostedServerRuntimeMatches = await findPatternMatches(
    appFiles.filter(
      (filePath) => !toRelativePath(filePath).startsWith("app/api/")
    ),
    serverRuntimePatterns
  )
  const nextClientRuntimeMatches = await findPatternMatches(
    componentFiles,
    nextClientRuntimePatterns
  )

  return {
    appApiRoutes,
    hasNextClientRuntimeBlockers: nextClientRuntimeMatches.length > 0,
    hostedServerRuntimeMatches,
    nextClientRuntimeMatches,
    nextConfig,
    rendererEntry,
  }
}

function collectRendererEntryBlockers(rendererEntry) {
  const blockers = []

  if (!rendererEntry.includes("fonts.googleapis.com")) {
    blockers.push({
      label: "Packaged renderer is missing web font stylesheet",
      count: 1,
      examples: [DESKTOP_RENDERER_ENTRY],
    })
  }

  const rootAbsoluteAssetReferences = [
    ...rendererEntry.matchAll(/\b(?:src|href)=["']\/assets\/[^"']+["']/gu),
  ].map((match) => match[0])

  if (rootAbsoluteAssetReferences.length > 0) {
    blockers.push({
      label: "Packaged renderer uses file-incompatible asset URLs",
      count: rootAbsoluteAssetReferences.length,
      examples: formatExamples(rootAbsoluteAssetReferences),
    })
  }

  return blockers
}

async function collectRendererStyleBlockers(rendererEntry) {
  const stylesheetReferences = [
    ...rendererEntry.matchAll(/\bhref=["']\.\/([^"']+\.css)["']/gu),
  ].map((match) => match[1])
  const rendererStyles = (
    await Promise.all(
      stylesheetReferences.map((assetPath) =>
        readFile(path.join(repoRoot, DESKTOP_RENDERER_DIR, assetPath))
      )
    )
  ).join("\n")

  if (
    rendererStyles.includes("--font-sans") &&
    rendererStyles.includes("Noto Sans")
  ) {
    return []
  }

  return [
    {
      label: "Packaged renderer is missing desktop font variables",
      count: 1,
      examples: ["desktop/renderer/desktop-fonts.css"],
    },
  ]
}

async function collectForbiddenEndpointBlockers() {
  const rendererBundleFiles = (
    await walkFiles(path.join(repoRoot, DESKTOP_RENDERER_DIR))
  ).filter((filePath) => /\.(html|css|js)$/.test(filePath))
  const forbiddenEndpointMatches = []

  for (const filePath of rendererBundleFiles) {
    const contents = await readFile(filePath)

    for (const pattern of forbiddenProductionEndpointPatterns) {
      const matches = contents.match(pattern)

      if (matches) {
        forbiddenEndpointMatches.push(
          `${toRelativePath(filePath)}: ${[...new Set(matches)].join(", ")}`
        )
      }
    }
  }

  return forbiddenEndpointMatches.length > 0
    ? [
        {
          label: "Packaged renderer contains local development endpoints",
          count: forbiddenEndpointMatches.length,
          examples: formatExamples(forbiddenEndpointMatches),
        },
      ]
    : []
}

async function collectBlockers(context) {
  const blockers = []

  if (!(await fileExists(path.join(repoRoot, DESKTOP_RENDERER_ENTRY)))) {
    blockers.push({
      label: "Packaged renderer build output is missing",
      count: 1,
      examples: [DESKTOP_RENDERER_ENTRY],
    })
  }

  blockers.push(...collectRendererEntryBlockers(context.rendererEntry))
  blockers.push(...(await collectRendererStyleBlockers(context.rendererEntry)))
  blockers.push(...(await collectForbiddenEndpointBlockers()))
  blockers.push(...context.nextClientRuntimeMatches)

  return blockers
}

function printHostedSurfaceSummary(context) {
  if (/output:\s*["']standalone["']/.test(context.nextConfig)) {
    console.log(
      "- next.config.mjs keeps the hosted web build in standalone mode"
    )
  }

  for (const finding of context.hostedServerRuntimeMatches) {
    console.log(`- ${finding.label}: ${finding.count}`)
  }

  console.log(`- app/api routes: ${context.appApiRoutes.length}`)
}

function printBlockingFindings(blockers) {
  for (const finding of blockers) {
    console.log(`- ${finding.label}: ${finding.count}`)

    for (const example of finding.examples) {
      console.log(`  - ${example}`)
    }
  }
}

function printReady(context) {
  console.log("Desktop renderer readiness")

  console.log("Status: ready")
  console.log("")
  console.log("Packaged renderer:")
  console.log(`- ${DESKTOP_RENDERER_ENTRY}`)
  console.log("")
  console.log("Hosted web/server surface remains intentional:")
  printHostedSurfaceSummary(context)
}

function printBlocked(context, blockers) {
  console.log("Desktop renderer readiness")

  console.log("Status: blocked")
  console.log("")
  console.log("Blocking findings:")
  printBlockingFindings(blockers)

  console.log("")
  console.log("Hosted web/server surface remains intentional:")
  printHostedSurfaceSummary(context)
  console.log("")
  console.log(
    context.hasNextClientRuntimeBlockers
      ? "Next step: finish the desktop client renderer boundary by moving remaining Next client runtime imports behind adapters."
      : "Next step: run pnpm desktop:renderer:build before packaged-renderer packaging."
  )

  process.exitCode = 1
}

async function main() {
  const context = await collectReadinessContext()
  const blockers = await collectBlockers(context)

  if (blockers.length === 0) {
    printReady(context)
    return
  }

  printBlocked(context, blockers)
}

await main()
