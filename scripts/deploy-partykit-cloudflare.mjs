#!/usr/bin/env node

import { spawnSync } from "node:child_process"

const environments = {
  dev: {
    serviceName: "linear-collaboration-dev",
    domainEnv: "PARTYKIT_CLOUDFLARE_DEV_DOMAIN",
  },
  prod: {
    serviceName: "linear-collaboration-prod",
    domainEnv: "PARTYKIT_CLOUDFLARE_PROD_DOMAIN",
  },
}

function formatList(values) {
  return values.map((value) => `- ${value}`).join("\n")
}

function readEnv(name) {
  const value = process.env[name]

  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeDomain(value) {
  if (!value) {
    return null
  }

  if (value.includes("://") || value.includes("/") || value.includes(":")) {
    throw new Error(
      "PartyKit cloud-prem domain must be a hostname only, for example collab.example.com"
    )
  }

  const parsed = new URL(`https://${value}`)

  if (parsed.hostname !== value || parsed.host !== value || parsed.port) {
    throw new Error(`Invalid PartyKit cloud-prem domain: ${value}`)
  }

  return value
}

const target = process.argv[2]
const config = environments[target]

if (!config) {
  console.error("Usage: pnpm partykit:deploy:<dev|prod>")
  process.exit(1)
}

const missing = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
].filter((name) => !readEnv(name))

let domain

try {
  domain = normalizeDomain(readEnv(config.domainEnv))
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Invalid PartyKit cloud-prem domain"
  )
  process.exit(1)
}

if (!domain) {
  missing.push(config.domainEnv)
}

if (missing.length > 0) {
  console.error(
    [
      `Missing Cloudflare cloud-prem deploy environment for ${target}:`,
      formatList(missing),
      "",
      "Required by PartyKit cloud-prem deployment:",
      "- CLOUDFLARE_ACCOUNT_ID",
      "- CLOUDFLARE_API_TOKEN",
      `- ${config.domainEnv}=<hostname>`,
      "",
      "This deploy path targets your own Cloudflare account. Use the explicit managed scripts only for non-durable experiments.",
    ].join("\n")
  )
  process.exit(1)
}

console.log(
  `Deploying ${config.serviceName} to Cloudflare cloud-prem domain ${domain}`
)

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const result = spawnSync(
  pnpmCommand,
  [
    "exec",
    "partykit",
    "deploy",
    "--name",
    config.serviceName,
    "--domain",
    domain,
  ],
  {
    env: process.env,
    stdio: "inherit",
  }
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
