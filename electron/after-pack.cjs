/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

function runPlutil(args) {
  execFileSync("plutil", args, { stdio: "inherit" })
}

function runPlistBuddy(command, infoPlistPath) {
  execFileSync("/usr/libexec/PlistBuddy", ["-c", command, infoPlistPath], {
    stdio: "inherit",
  })
}

function readSha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return
  }

  const productFileName =
    context.packager?.appInfo?.productFilename ?? "Recipe Room"
  const infoPlistPath = path.join(
    context.appOutDir,
    `${productFileName}.app`,
    "Contents",
    "Info.plist"
  )
  const appAsarPath = path.join(
    context.appOutDir,
    `${productFileName}.app`,
    "Contents",
    "Resources",
    "app.asar"
  )

  runPlutil([
    "-replace",
    "NSAppTransportSecurity.NSAllowsArbitraryLoads",
    "-bool",
    "NO",
    infoPlistPath,
  ])
  runPlutil([
    "-replace",
    "NSAppTransportSecurity.NSAllowsLocalNetworking",
    "-bool",
    "YES",
    infoPlistPath,
  ])

  if (fs.existsSync(appAsarPath)) {
    runPlistBuddy(
      `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${readSha256(
        appAsarPath
      )}`,
      infoPlistPath
    )
  }
}
