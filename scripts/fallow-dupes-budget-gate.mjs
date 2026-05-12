#!/usr/bin/env node

const DEFAULT_MAX_CLONE_GROUPS = 0
const DEFAULT_MAX_DUPLICATED_LINES = 0
const DEFAULT_MAX_DUPLICATION_PERCENTAGE = 0

function readNumberBudget(name, fallback) {
  const value = process.env[name]

  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

let input = ""

for await (const chunk of process.stdin) {
  input += chunk
}

let report

try {
  report = JSON.parse(input)
} catch (error) {
  console.error("Failed to parse Fallow duplication JSON output.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
}

const stats = report?.stats ?? {}
const cloneGroups = Number(stats.clone_groups ?? 0)
const duplicatedLines = Number(stats.duplicated_lines ?? 0)
const duplicationPercentage = Number(stats.duplication_percentage ?? 0)
const maxCloneGroups = readNumberBudget(
  "FALLOW_DUPES_MAX_CLONE_GROUPS",
  DEFAULT_MAX_CLONE_GROUPS
)
const maxDuplicatedLines = readNumberBudget(
  "FALLOW_DUPES_MAX_DUPLICATED_LINES",
  DEFAULT_MAX_DUPLICATED_LINES
)
const maxDuplicationPercentage = readNumberBudget(
  "FALLOW_DUPES_MAX_DUPLICATION_PERCENTAGE",
  DEFAULT_MAX_DUPLICATION_PERCENTAGE
)

const summary = [
  `clone_groups=${cloneGroups}/${maxCloneGroups}`,
  `duplicated_lines=${duplicatedLines}/${maxDuplicatedLines}`,
  `duplication_percentage=${duplicationPercentage.toFixed(2)}%/${maxDuplicationPercentage.toFixed(2)}%`,
].join(" ")

if (
  cloneGroups > maxCloneGroups ||
  duplicatedLines > maxDuplicatedLines ||
  duplicationPercentage > maxDuplicationPercentage
) {
  console.error(`Fallow duplication budget failed: ${summary}`)
  process.exit(1)
}

console.log(`Fallow duplication budget passed: ${summary}`)
