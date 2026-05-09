#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { parseGeneratedApiMap } from "./shared/convex-generated-api.mjs"

const ZERO_SHA = "0000000000000000000000000000000000000000"
const CONVEX_DIR = "convex"
const GENERATED_API_PATH = "convex/_generated/api.d.ts"
const SCHEMA_PATH = "convex/schema.ts"

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

function canResolveCommit(ref) {
  if (!ref || ref === ZERO_SHA) {
    return false
  }

  try {
    runGit(["cat-file", "-e", `${ref}^{commit}`])
    return true
  } catch {
    return false
  }
}

function resolveMergeBaseRange(baseRef, head) {
  if (canResolveCommit(baseRef) && canResolveCommit(head)) {
    return {
      base: runGit(["merge-base", baseRef, head]),
      head,
    }
  }

  return null
}

function resolveDefaultBranchDiffBase(head) {
  const defaultBranch = process.env.DEFAULT_BRANCH || "main"
  return resolveMergeBaseRange(`origin/${defaultBranch}`, head)
}

function resolveDiffBase() {
  const head = process.env.DIFF_HEAD || "HEAD"

  return (
    resolveMergeBaseRange(process.env.DIFF_BASE, head) ??
    resolveDefaultBranchDiffBase(head)
  )
}

function listChangedFiles(diffRange) {
  if (!diffRange) {
    return []
  }

  return runGit([
    "diff",
    "--name-only",
    diffRange.base,
    diffRange.head,
    "--",
    CONVEX_DIR,
  ])
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
}

function isConvexSourceModule(entry, entryPath) {
  return entry.isFile() && /\.[jt]s$/.test(entry.name) && entryPath !== SCHEMA_PATH
}

function listConvexModuleEntries(directory, entry) {
  const entryPath = path.join(directory, entry.name)

  if (entry.name === "_generated") {
    return []
  }

  if (entry.isDirectory()) {
    return listConvexModules(entryPath)
  }

  return isConvexSourceModule(entry, entryPath)
    ? [entryPath.replace(/\.[jt]s$/, "")]
    : []
}

function listConvexModules(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => listConvexModuleEntries(directory, entry))
    .sort()
}

function parseGeneratedImports(apiText) {
  const modules = new Set()
  const importPattern = /import type \* as \S+ from "\.\.\/(.+?)\.js";/g

  for (const match of apiText.matchAll(importPattern)) {
    modules.add(`convex/${match[1]}`)
  }

  return modules
}

function assertNoSchemaDriftWithoutDeployment(changedFiles, diffRange) {
  if (!diffRange) {
    console.error(
      "CONVEX_DEPLOYMENT is unavailable and no reliable diff base could be resolved, so schema drift cannot be checked in fallback mode."
    )
    process.exit(1)
  }

  if (!changedFiles.includes(SCHEMA_PATH)) {
    return
  }

  console.error(
    "Convex schema changed, but CONVEX_DEPLOYMENT is unavailable. Configure the deployment secret so CI can run Convex codegen and verify data model bindings."
  )
  process.exit(1)
}

function readGeneratedApiRoster() {
  const expectedModules = listConvexModules(CONVEX_DIR)
  const apiText = readFileSync(GENERATED_API_PATH, "utf8")
  const importedModules = parseGeneratedImports(apiText)
  const mappedModules = parseGeneratedApiMap(apiText)

  return {
    expectedModules,
    importedModules,
    mappedModules,
  }
}

function getMissingRosterEntries(expectedModules, actualModules) {
  return expectedModules.filter((moduleName) => !actualModules.has(moduleName))
}

function getStaleRosterEntries(actualModules, expectedModules) {
  return [...actualModules].filter(
    (moduleName) => !expectedModules.includes(moduleName)
  )
}

function getGeneratedApiRosterDrift(roster) {
  return [
    [
      "missing imports",
      getMissingRosterEntries(roster.expectedModules, roster.importedModules),
    ],
    [
      "missing API map entries",
      getMissingRosterEntries(roster.expectedModules, roster.mappedModules),
    ],
    [
      "stale imports",
      getStaleRosterEntries(roster.importedModules, roster.expectedModules),
    ],
    [
      "stale API map entries",
      getStaleRosterEntries(roster.mappedModules, roster.expectedModules),
    ],
  ]
}

function hasGeneratedApiRosterDrift(driftEntries) {
  return driftEntries.some(([, values]) => values.length > 0)
}

function logGeneratedApiRosterDrift(driftEntries) {
  console.error("Convex generated API module roster is stale.")

  for (const [label, values] of driftEntries) {
    if (values.length === 0) {
      continue
    }

    console.error(`${label}:`)
    for (const value of values) {
      console.error(`- ${value}`)
    }
  }
}

function assertGeneratedApiRoster() {
  if (!existsSync(GENERATED_API_PATH)) {
    console.error(`Missing generated API file: ${GENERATED_API_PATH}`)
    process.exit(1)
  }

  const roster = readGeneratedApiRoster()
  const driftEntries = getGeneratedApiRosterDrift(roster)

  if (hasGeneratedApiRosterDrift(driftEntries)) {
    logGeneratedApiRosterDrift(driftEntries)
    process.exit(1)
  }

  console.log(
    `Convex generated API roster verified without deployment: modules=${roster.expectedModules.length}`
  )
}

const diffRange = resolveDiffBase()
const changedFiles = listChangedFiles(diffRange)

assertNoSchemaDriftWithoutDeployment(changedFiles, diffRange)
assertGeneratedApiRoster()
