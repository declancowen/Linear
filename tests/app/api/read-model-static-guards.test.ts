import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry)
    const stat = statSync(absolutePath)

    if (stat.isDirectory()) {
      return listFiles(absolutePath)
    }

    return [absolutePath]
  })
}

function getSchemaTableSource(schemaSource: string, tableName: string) {
  const tableStart = schemaSource.indexOf(`${tableName}: defineTable`)

  if (tableStart < 0) {
    return ""
  }

  const nextTableMatch = /\n  [A-Za-z][A-Za-z0-9]*: defineTable/.exec(
    schemaSource.slice(tableStart + 1)
  )

  return nextTableMatch === null
    ? schemaSource.slice(tableStart)
    : schemaSource.slice(tableStart, tableStart + 1 + nextTableMatch.index)
}

describe("read model static guards", () => {
  it("keeps read-model routes and server handlers off full app snapshots", () => {
    const guardedFiles = [
      ...listFiles(path.join(repoRoot, "app/api/read-models")),
      path.join(repoRoot, "lib/server/scoped-read-model-route-handlers.ts"),
      path.join(repoRoot, "lib/server/scoped-read-models.ts"),
    ]
    const offenders = guardedFiles.filter((file) =>
      readFileSync(file, "utf8").includes("getSnapshotServer")
    )

    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([])
  })

  it("keeps read-model routes behind scoped route handlers", () => {
    const routeFiles = listFiles(path.join(repoRoot, "app/api/read-models"))
    const offenders = routeFiles.filter((file) => {
      const source = readFileSync(file, "utf8")

      return !source.includes("scoped-read-model-route-handlers")
    })

    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([])
  })

  it("keeps retention cleanup tables indexed by retention timestamps", () => {
    const schemaSource = readFileSync(
      path.join(repoRoot, "convex/schema.ts"),
      "utf8"
    )
    const emailJobsSource = getSchemaTableSource(schemaSource, "emailJobs")
    const chatMessagesSource = getSchemaTableSource(schemaSource, "chatMessages")
    const notificationsSource = getSchemaTableSource(schemaSource, "notifications")
    const readModelVersionsSource = getSchemaTableSource(
      schemaSource,
      "readModelVersions"
    )

    expect(readModelVersionsSource).toContain(
      '.index("by_updated_at", ["updatedAt"])'
    )
    expect(notificationsSource).toContain(
      '.index("by_created_at", ["createdAt"])'
    )
    expect(notificationsSource).toContain('.index("by_read_at", ["readAt"])')
    expect(notificationsSource).toContain(
      '.index("by_archived_at", ["archivedAt"])'
    )
    expect(notificationsSource).toContain(
      '.index("by_emailed_at", ["emailedAt"])'
    )
    expect(emailJobsSource).toContain('.index("by_created_at", ["createdAt"])')
    expect(emailJobsSource).toContain('.index("by_sent_at", ["sentAt"])')
    expect(chatMessagesSource).toContain(
      '.index("by_conversation_created_at", ["conversationId", "createdAt"])'
    )
  })
})
