import fs from "node:fs"

function parseDotenvValue(value) {
  const trimmed = value.trim()
  const quote = trimmed[0]

  if (
    (quote === "'" || quote === '"') &&
    trimmed.endsWith(quote) &&
    trimmed.length >= 2
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export function readDotenvFile(filePath) {
  try {
    const contents = fs.readFileSync(filePath, "utf8")
    const env = {}

    for (const line of contents.split(/\r?\n/u)) {
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith("#")) {
        continue
      }

      const separatorIndex = trimmed.indexOf("=")

      if (separatorIndex <= 0) {
        continue
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1)

      env[key] = parseDotenvValue(value)
    }

    return env
  } catch {
    return {}
  }
}
