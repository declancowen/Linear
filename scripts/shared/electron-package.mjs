import fs from "node:fs/promises"
import path from "node:path"

export async function findBuiltApp(searchDir) {
  const outputEntries = await fs.readdir(searchDir, { withFileTypes: true })

  for (const entry of outputEntries) {
    if (!entry.isDirectory() || !entry.name.startsWith("mac")) {
      continue
    }

    const appPath = path.join(searchDir, entry.name, "Recipe Room.app")

    try {
      await fs.access(appPath)
      return {
        appPath,
        archivePath: path.join(searchDir, `Recipe Room-${entry.name}.zip`),
      }
    } catch {}
  }

  throw new Error("Packaged app bundle was not created")
}
