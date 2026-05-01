#!/usr/bin/env node

let input = ""

for await (const chunk of process.stdin) {
  input += chunk
}

let report

try {
  report = JSON.parse(input)
} catch (error) {
  console.error("Failed to parse Fallow health JSON output.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
}

const findings = Array.isArray(report?.findings) ? report.findings : []
const summary = report?.summary ?? {}
const score = report?.health_score?.score
const grade = report?.health_score?.grade

if (findings.length > 0) {
  console.error(`Fallow health gate failed: findings=${findings.length}`)
  for (const finding of findings.slice(0, 10)) {
    const location = `${finding.path ?? "unknown"}:${finding.line ?? "?"}`
    const name = finding.name ?? "anonymous"
    const severity = finding.severity ?? "unknown"
    console.error(`- ${severity} ${location} ${name}`)
  }
  process.exit(1)
}

const scoreLabel =
  typeof score === "number" && typeof grade === "string"
    ? ` score=${score.toFixed(1)} grade=${grade}`
    : ""

console.log(
  [
    "Fallow health gate passed:",
    `findings=0`,
    `functions_above_threshold=${summary.functions_above_threshold ?? 0}`,
    scoreLabel.trim(),
  ]
    .filter(Boolean)
    .join(" ")
)
