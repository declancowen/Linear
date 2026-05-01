#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

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

function resolveDiffBase() {
  const head = process.env.DIFF_HEAD || "HEAD"
  const configuredBase = process.env.DIFF_BASE

  if (canResolveCommit(configuredBase) && canResolveCommit(head)) {
    return {
      base: runGit(["merge-base", configuredBase, head]),
      head,
    }
  }

  const defaultBranch = process.env.DEFAULT_BRANCH || "main"
  const defaultBranchRef = `origin/${defaultBranch}`

  if (canResolveCommit(defaultBranchRef) && canResolveCommit(head)) {
    return {
      base: runGit(["merge-base", defaultBranchRef, head]),
      head,
    }
  }

  return null
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

function listConvexModules(directory) {
  const modules = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)

    if (entry.name === "_generated") {
      continue
    }

    if (entry.isDirectory()) {
      modules.push(...listConvexModules(entryPath))
      continue
    }

    if (!entry.isFile() || !/\.[jt]s$/.test(entry.name)) {
      continue
    }

    if (entryPath === SCHEMA_PATH) {
      continue
    }

    modules.push(entryPath.replace(/\.[jt]s$/, ""))
  }

  return modules.sort()
}

function parseGeneratedImports(apiText) {
  const modules = new Set()
  const importPattern = /import type \* as \S+ from "\.\.\/(.+?)\.js";/g

  for (const match of apiText.matchAll(importPattern)) {
    modules.add(`convex/${match[1]}`)
  }

  return modules
}

function parseGeneratedApiMap(apiText) {
  const modules = new Set()
  const fullApiBody = apiText.match(
    /declare const fullApi: ApiFromModules<\{\n([\s\S]*?)\n\}>;/
  )?.[1]

  if (!fullApiBody) {
    throw new Error(
      "Could not parse fullApi module map from generated API file."
    )
  }

  const modulePattern = /^\s+(?:"([^"]+)"|([A-Za-z_$][\w$]*)): typeof /gm

  for (const match of fullApiBody.matchAll(modulePattern)) {
    modules.add(`convex/${match[1] ?? match[2]}`)
  }

  return modules
}

function assertNoSchemaDriftWithoutDeployment(changedFiles, diffRange) {
  if (!diffRange) {
    console.warn(
      "No reliable diff base was available; schema drift cannot be checked in fallback mode."
    )
    return
  }

  if (!changedFiles.includes(SCHEMA_PATH)) {
    return
  }

  console.error(
    "Convex schema changed, but CONVEX_DEPLOYMENT is unavailable. Configure the deployment secret so CI can run Convex codegen and verify data model bindings."
  )
  process.exit(1)
}

function assertGeneratedApiRoster() {
  if (!existsSync(GENERATED_API_PATH)) {
    console.error(`Missing generated API file: ${GENERATED_API_PATH}`)
    process.exit(1)
  }

  const expectedModules = listConvexModules(CONVEX_DIR)
  const apiText = readFileSync(GENERATED_API_PATH, "utf8")
  const importedModules = parseGeneratedImports(apiText)
  const mappedModules = parseGeneratedApiMap(apiText)
  const missingImports = expectedModules.filter(
    (moduleName) => !importedModules.has(moduleName)
  )
  const missingMapEntries = expectedModules.filter(
    (moduleName) => !mappedModules.has(moduleName)
  )
  const staleImports = [...importedModules].filter(
    (moduleName) => !expectedModules.includes(moduleName)
  )
  const staleMapEntries = [...mappedModules].filter(
    (moduleName) => !expectedModules.includes(moduleName)
  )

  if (
    missingImports.length > 0 ||
    missingMapEntries.length > 0 ||
    staleImports.length > 0 ||
    staleMapEntries.length > 0
  ) {
    console.error("Convex generated API module roster is stale.")
    for (const [label, values] of [
      ["missing imports", missingImports],
      ["missing API map entries", missingMapEntries],
      ["stale imports", staleImports],
      ["stale API map entries", staleMapEntries],
    ]) {
      if (values.length > 0) {
        console.error(`${label}:`)
        for (const value of values) {
          console.error(`- ${value}`)
        }
      }
    }
    process.exit(1)
  }

  console.log(
    `Convex generated API roster verified without deployment: modules=${expectedModules.length}`
  )
}

const diffRange = resolveDiffBase()
const changedFiles = listChangedFiles(diffRange)

assertNoSchemaDriftWithoutDeployment(changedFiles, diffRange)
assertGeneratedApiRoster()
