import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ConvexHttpClient } from "convex/browser"

import { api } from "../convex/_generated/api.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const DEFAULT_WORKBOOK_PATH =
  process.env.CODECOY_FRONT_END_AUDIT_WORKBOOK ?? null
const PROD_ENV_PATH = path.join(repoRoot, ".vercel/.env.production.local")
const OUTPUT_DIR = path.join(repoRoot, "outputs/codecoy-front-end-audit-import")

const TARGET_TEAM_CODE =
  process.env.CODECOY_FRONT_END_AUDIT_TEAM_CODE ?? "CodeCoy"
const TARGET_PROJECT_NAME =
  process.env.CODECOY_FRONT_END_AUDIT_PROJECT_NAME ?? "frontendaudit"
const TARGET_PROJECT_ALIASES = [TARGET_PROJECT_NAME, "Front End Audit"]
const ACTOR_EMAIL =
  process.env.CODECOY_FRONT_END_AUDIT_ACTOR_EMAIL ?? "declan@cowen.co"
const ACTOR_USER_ID =
  process.env.CODECOY_FRONT_END_AUDIT_ACTOR_USER_ID ?? "user_xdtnopuu"

const STATUS_MAP = new Map([
  ["To Do", "todo"],
  ["In Progress", "in-progress"],
  ["Done", "done"],
])

function hasFlag(name) {
  return process.argv.includes(name)
}

function getFlagValue(name, fallback) {
  const index = process.argv.indexOf(name)

  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

function parseEnvFile(text) {
  const env = {}

  for (const line of text.split(/\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u)

    if (!match) continue
    env[match[1]] = match[2].replace(/^"|"$/g, "")
  }

  return env
}

async function readProductionEnv() {
  return parseEnvFile(await fs.readFile(PROD_ENV_PATH, "utf8"))
}

function runPythonJson(pythonCode, args) {
  const pythonBin = process.env.PYTHON_BIN ?? "python3"
  const output = execFileSync(pythonBin, ["-c", pythonCode, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  })

  return JSON.parse(output)
}

function loadAuditRows(workbookPath) {
  return runPythonJson(
    String.raw`
import json
import openpyxl
import sys

workbook_path = sys.argv[1]
wb = openpyxl.load_workbook(workbook_path, data_only=True)
ws = wb["Audit"]
headers = [cell.value for cell in ws[1]]
rows = []

for row_index, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    if not any(value not in (None, "") for value in row):
        continue
    entry = dict(zip(headers, row))
    entry["__rowNumber"] = row_index
    rows.append(entry)

print(json.dumps(rows, ensure_ascii=False, default=str))
`,
    [workbookPath]
  )
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (slug) return slug
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)
}

function stableId(prefix, value) {
  const slug = slugify(value)

  if (`${prefix}_${slug}`.length <= 80) {
    return `${prefix}_${slug}`
  }

  const digest = crypto
    .createHash("sha1")
    .update(value)
    .digest("hex")
    .slice(0, 12)
  return `${prefix}_${slug.slice(0, 52)}_${digest}`
}

function normalizeText(value) {
  if (value == null) return ""
  return String(value).replace(/\r\n/g, "\n").trim()
}

function htmlEscape(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function paragraphHtml(value) {
  const text = normalizeText(value)

  if (!text) return "<p>None captured.</p>"

  return text
    .split(/\n{2,}/u)
    .map(
      (paragraph) => `<p>${htmlEscape(paragraph).replace(/\n/g, "<br>")}</p>`
    )
    .join("")
}

function sectionHtml(title, value) {
  return `<p><strong>${htmlEscape(title)}</strong></p>${paragraphHtml(value)}`
}

function splitLabeledDetail(detail, labels) {
  const text = normalizeText(detail)
  const result = {}
  const matches = []

  for (const label of labels) {
    const match = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`,
      "iu"
    ).exec(text)
    if (match) {
      matches.push({
        label,
        index: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  matches.sort((a, b) => a.index - b.index)

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = matches[index + 1]
    result[current.label] = text
      .slice(current.end, next?.index ?? text.length)
      .trim()
  }

  return result
}

function splitBugDetail(detail) {
  const text = normalizeText(detail)
  const notesMatch = /\n\s*Notes\s*:/iu.exec(text)

  if (!notesMatch) {
    return {
      observedProblem: text,
      notes: "",
    }
  }

  return {
    observedProblem: text.slice(0, notesMatch.index).trim(),
    notes: text.slice(notesMatch.index + notesMatch[0].length).trim(),
  }
}

function buildSourceHtml(row) {
  return [
    "<p><strong>Source</strong></p>",
    "<ul>",
    `<li><strong>Type:</strong> ${htmlEscape(row.Type)}</li>`,
    `<li><strong>Group:</strong> ${htmlEscape(row.Group)}</li>`,
    `<li><strong>Applies To:</strong> ${htmlEscape(row["Applies To"]) || "None captured."}</li>`,
    `<li><strong>State / Variant:</strong> ${htmlEscape(row["State / Variant"]) || "None captured."}</li>`,
    `<li><strong>Source Ref:</strong> ${htmlEscape(row["Source Ref"])}</li>`,
    `<li><strong>Spreadsheet Row:</strong> ${row.__rowNumber}</li>`,
    "</ul>",
  ].join("")
}

function buildDescription(row) {
  const type = normalizeText(row.Type)
  const detail = normalizeText(row["Requirement / Issue Detail"])
  const html = [buildSourceHtml(row)]

  if (type === "Bug") {
    const { observedProblem, notes } = splitBugDetail(detail)
    html.push(sectionHtml("Observed Problem", observedProblem))
    html.push(
      sectionHtml(
        "Notes / Developer Translation",
        notes || row["Developer Translation"]
      )
    )
    html.push(sectionHtml("Acceptance Criteria", row["Acceptance Criteria"]))
    html.push(sectionHtml("Repro Steps", row["Repro Steps"]))
  } else {
    const split = splitLabeledDetail(detail, [
      "UX / Design Intent",
      "Visual & Interaction Requirement",
    ])
    html.push(sectionHtml("UX / Design Intent", split["UX / Design Intent"]))
    html.push(
      sectionHtml(
        "Visual & Interaction Requirement",
        split["Visual & Interaction Requirement"]
      )
    )
    html.push(
      sectionHtml("Developer Translation", row["Developer Translation"])
    )
    html.push(
      sectionHtml("Light Mode Requirement", row["Light Mode Requirement"])
    )
    html.push(
      sectionHtml("Dark Mode Requirement", row["Dark Mode Requirement"])
    )
    html.push(sectionHtml("Acceptance Criteria", row["Acceptance Criteria"]))
  }

  html.push(sectionHtml("Feedback - Declan", row["Feedback - Declan"]))
  html.push(sectionHtml("Feedback - CodeCoy", row["Feedback - Codecoy"]))

  return html.join("")
}

function truncateTitle(title) {
  const normalized = normalizeText(title)

  if (normalized.length <= 96) return normalized
  return `${normalized.slice(0, 93)}...`
}

function validateRows(rows) {
  const errors = []

  for (const row of rows) {
    if (!normalizeText(row.Group))
      errors.push(`Row ${row.__rowNumber}: missing Group`)
    if (!normalizeText(row.Title))
      errors.push(`Row ${row.__rowNumber}: missing Title`)
    if (!normalizeText(row.Type))
      errors.push(`Row ${row.__rowNumber}: missing Type`)
    if (!["CX", "Bug"].includes(normalizeText(row.Type))) {
      errors.push(`Row ${row.__rowNumber}: unsupported Type ${row.Type}`)
    }
    if (!STATUS_MAP.has(normalizeText(row.Status))) {
      errors.push(`Row ${row.__rowNumber}: unsupported Status ${row.Status}`)
    }
    if (!normalizeText(row["Source Ref"])) {
      errors.push(`Row ${row.__rowNumber}: missing Source Ref`)
    }
  }

  const refs = rows.map((row) => normalizeText(row["Source Ref"]))
  const duplicateRefs = refs.filter((ref, index) => refs.indexOf(ref) !== index)
  if (duplicateRefs.length > 0) {
    errors.push(
      `Duplicate Source Ref values: ${[...new Set(duplicateRefs)].join(", ")}`
    )
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"))
  }
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const value = normalizeText(row[field]) || "None captured"
    counts.set(value, (counts.get(value) ?? 0) + 1)
    return counts
  }, new Map())
}

function formatCounts(counts) {
  return [...counts.entries()]
    .map(([label, count]) => `${label}: ${count}`)
    .join(", ")
}

function getUniqueValues(rows, field, limit) {
  return [
    ...new Set(rows.map((row) => normalizeText(row[field])).filter(Boolean)),
  ].slice(0, limit)
}

function cleanRepresentativeTitle(row) {
  const title = normalizeText(row.Title)
  const group = normalizeText(row.Group)
  const bugPrefix = `Bug - ${group} - `

  if (title.startsWith(bugPrefix)) {
    return title.slice(bugPrefix.length)
  }

  return title
}

function listHtml(values) {
  if (values.length === 0) {
    return "<p>None captured.</p>"
  }

  return [
    "<ul>",
    ...values.map((value) => `<li>${htmlEscape(value)}</li>`),
    "</ul>",
  ].join("")
}

function buildAreaDescription(group, groupRows) {
  const typeCounts = countBy(groupRows, "Type")
  const statusCounts = countBy(groupRows, "Status")
  const appliesTo = getUniqueValues(groupRows, "Applies To", 8)
  const states = getUniqueValues(groupRows, "State / Variant", 8)
  const representativeTitles = groupRows
    .slice(0, 8)
    .map(cleanRepresentativeTitle)

  return [
    sectionHtml(
      "Parent Goal",
      `This parent issue tracks the ${group} work in the Front End Audit. The child issues define the UX, visual behavior, implementation translation, light/dark requirements, acceptance criteria, bug fixes, and feedback needed to bring this area into the approved product state.`
    ),
    "<p><strong>What This Area Covers</strong></p>",
    listHtml(appliesTo),
    "<p><strong>States / Variants Covered</strong></p>",
    listHtml(states),
    "<p><strong>Representative Child Work</strong></p>",
    listHtml(representativeTitles),
    "<p><strong>Imported Scope</strong></p>",
    listHtml([
      `${groupRows.length} child issues`,
      `Types: ${formatCounts(typeCounts)}`,
      `Source statuses: ${formatCounts(statusCounts)}`,
    ]),
    sectionHtml(
      "Completion Target",
      "Complete the linked child issues until the covered screens and states match their acceptance criteria, implementation notes, theme requirements, and recorded Declan/CodeCoy feedback."
    ),
  ].join("")
}

function createAreaRecords(rows, labelByType) {
  const groups = [...new Set(rows.map((row) => normalizeText(row.Group)))]

  return groups.map((group) => {
    const groupRows = rows.filter((row) => normalizeText(row.Group) === group)
    const labelIds = [
      ...new Set(
        groupRows
          .map((row) => labelByType.get(normalizeText(row.Type)))
          .filter(Boolean)
      ),
    ]

    return {
      description: buildAreaDescription(group, groupRows),
      docId: stableId("doc_fe_audit_area", group),
      group,
      id: stableId("item_fe_audit_area", group),
      labelIds,
      title: truncateTitle(`Area: ${group}`),
    }
  })
}

function createChildRecords(rows, labelByType) {
  return rows.map((row) => ({
    description: buildDescription(row),
    docId: stableId("doc_fe_audit_row", normalizeText(row["Source Ref"])),
    group: normalizeText(row.Group),
    id: stableId("item_fe_audit_row", normalizeText(row["Source Ref"])),
    labelIds: [labelByType.get(normalizeText(row.Type))].filter(Boolean),
    originalTitle: normalizeText(row.Title),
    sourceRef: normalizeText(row["Source Ref"]),
    status: STATUS_MAP.get(normalizeText(row.Status)),
    title: truncateTitle(row.Title),
    type: normalizeText(row.Type),
  }))
}

function makeEmptyViewFilters(teamId, projectId) {
  return {
    status: [],
    priority: [],
    assigneeIds: [],
    creatorIds: [],
    updatedByIds: [],
    documentKinds: [],
    linkedWorkItemIds: [],
    leadIds: [],
    health: [],
    milestoneIds: [],
    relationTypes: [],
    projectIds: [projectId],
    parentIds: [],
    itemTypes: [],
    labelIds: [],
    teamIds: [teamId],
    visibility: [],
    showCompleted: true,
  }
}

async function getSnapshot(client, serverToken) {
  return client.query(api.app.getSnapshot, {
    serverToken,
    email: ACTOR_EMAIL,
  })
}

function findProject(snapshot, teamId) {
  const normalizedTargetNames = new Set(
    TARGET_PROJECT_ALIASES.map((name) => slugify(name))
  )

  return snapshot.projects.find(
    (project) =>
      project.scopeType === "team" &&
      project.scopeId === teamId &&
      normalizedTargetNames.has(slugify(project.name))
  )
}

async function ensureLabels(client, serverToken, workspaceId, apply) {
  if (!apply) {
    return new Map([
      ["CX", "label_dry_run_cx"],
      ["Bug", "label_dry_run_bug"],
    ])
  }

  const entries = await Promise.all(
    ["CX", "Bug"].map(async (name) => {
      const label = await client.mutation(api.app.createLabel, {
        serverToken,
        currentUserId: ACTOR_USER_ID,
        workspaceId,
        name,
      })

      return [name, label.id]
    })
  )

  return new Map(entries)
}

async function ensureProject(client, serverToken, snapshot, teamId, apply) {
  const existing = findProject(snapshot, teamId)

  if (existing) return existing

  if (!apply) {
    return {
      id: "project_dry_run_frontendaudit",
      name: TARGET_PROJECT_NAME,
    }
  }

  await client.mutation(api.app.createProject, {
    serverToken,
    currentUserId: ACTOR_USER_ID,
    scopeType: "team",
    scopeId: teamId,
    templateType: "bug-tracking",
    name: TARGET_PROJECT_NAME,
    icon: "BugBeetle",
    summary: "Imported frontend audit issue backlog for CodeCoy.",
    status: "in-progress",
    priority: "none",
    leadId: ACTOR_USER_ID,
    memberIds: [ACTOR_USER_ID],
    startDate: null,
    targetDate: null,
    settingsTeamId: teamId,
    presentation: {
      itemLevel: "issue",
      showChildItems: true,
      layout: "list",
      grouping: "status",
      ordering: "updatedAt",
      displayProps: ["id", "status", "priority", "labels", "updated"],
      filters: makeEmptyViewFilters(teamId, "project_pending"),
    },
  })

  const nextSnapshot = await getSnapshot(client, serverToken)
  const created = findProject(nextSnapshot, teamId)

  if (!created) {
    throw new Error(
      "Created project was not visible in the post-create snapshot"
    )
  }

  await client.mutation(api.app.updateProject, {
    serverToken,
    currentUserId: ACTOR_USER_ID,
    projectId: created.id,
    patch: {
      startDate: null,
      targetDate: null,
      presentation: {
        itemLevel: "issue",
        showChildItems: true,
        layout: "list",
        grouping: "status",
        ordering: "updatedAt",
        displayProps: ["id", "status", "priority", "labels", "updated"],
        filters: makeEmptyViewFilters(teamId, created.id),
      },
    },
  })

  return {
    ...created,
    startDate: null,
    targetDate: null,
  }
}

async function upsertWorkItem(client, serverToken, snapshot, input, apply) {
  const existing = snapshot.workItems.find((item) => item.id === input.id)
  const common = {
    title: input.title,
    status: input.status,
    priority: "none",
    primaryProjectId: input.primaryProjectId,
    labelIds: input.labelIds ?? [],
    description: input.description,
    startDate: null,
    dueDate: null,
    targetDate: null,
    startTime: null,
    endTime: null,
    scheduleTimeZone: null,
  }

  if (!apply) {
    return existing ? "update" : "create"
  }

  if (existing) {
    await client.mutation(api.app.updateWorkItem, {
      serverToken,
      currentUserId: ACTOR_USER_ID,
      origin: "codecoy-front-end-audit-import",
      itemId: input.id,
      patch: common,
    })
    return "update"
  }

  await client.mutation(api.app.createWorkItem, {
    serverToken,
    currentUserId: ACTOR_USER_ID,
    origin: "codecoy-front-end-audit-import",
    id: input.id,
    descriptionDocId: input.docId,
    teamId: input.teamId,
    type: input.type,
    title: input.title,
    parentId: input.parentId,
    primaryProjectId: input.primaryProjectId,
    assigneeId: null,
    status: input.status,
    priority: "none",
    labelIds: input.labelIds ?? [],
    visibility: "team",
    startDate: null,
    dueDate: null,
    targetDate: null,
    startTime: null,
    endTime: null,
    scheduleTimeZone: null,
  })

  await client.mutation(api.app.updateWorkItem, {
    serverToken,
    currentUserId: ACTOR_USER_ID,
    origin: "codecoy-front-end-audit-import",
    itemId: input.id,
    patch: common,
  })

  return "create"
}

function getScopedCollectionScopeId(scopeType, scopeId) {
  return `${scopeType}_${scopeId}`
}

function buildScopeKeys({
  areaRecords,
  childRecords,
  projectId,
  teamId,
  workspaceId,
}) {
  return [
    `work-index:${getScopedCollectionScopeId("team", teamId)}`,
    `project-index:${getScopedCollectionScopeId("team", teamId)}`,
    `project-detail:${projectId}`,
    `search-seed:${workspaceId}`,
    `workspace-membership:${workspaceId}`,
    ...areaRecords.map((record) => `work-item-detail:${record.id}`),
    ...childRecords.map((record) => `work-item-detail:${record.id}`),
  ]
}

async function main() {
  const apply = hasFlag("--apply")
  const parentsOnly = hasFlag("--parents-only")
  const workbookPath = getFlagValue("--workbook", DEFAULT_WORKBOOK_PATH)

  if (!workbookPath) {
    throw new Error(
      "Missing workbook path. Pass --workbook <path> or set CODECOY_FRONT_END_AUDIT_WORKBOOK."
    )
  }

  const rows = loadAuditRows(workbookPath)
  validateRows(rows)

  const groups = new Set(rows.map((row) => normalizeText(row.Group)))
  const statusCounts = rows.reduce((counts, row) => {
    const status = normalizeText(row.Status)
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})
  const typeCounts = rows.reduce((counts, row) => {
    const type = normalizeText(row.Type)
    counts[type] = (counts[type] ?? 0) + 1
    return counts
  }, {})

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(
    path.join(OUTPUT_DIR, "source-manifest.json"),
    JSON.stringify({ workbookPath, rows }, null, 2)
  )

  const env = await readProductionEnv()
  const convexUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL
  const serverToken = env.CONVEX_SERVER_TOKEN

  if (!convexUrl || !serverToken) {
    throw new Error("Production Convex env is missing")
  }

  const client = new ConvexHttpClient(convexUrl)
  const target = await client.query(api.app.lookupTeamByJoinCode, {
    serverToken,
    code: TARGET_TEAM_CODE,
  })

  if (!target) {
    throw new Error(`Could not find target team ${TARGET_TEAM_CODE}`)
  }

  const snapshot = await getSnapshot(client, serverToken)
  const labelByType = await ensureLabels(
    client,
    serverToken,
    target.workspace.id,
    apply
  )
  const project = await ensureProject(
    client,
    serverToken,
    snapshot,
    target.team.id,
    apply
  )
  const areaRecords = createAreaRecords(rows, labelByType)
  const childRecords = createChildRecords(rows, labelByType)
  const existingSnapshot = apply
    ? await getSnapshot(client, serverToken)
    : snapshot
  const results = {
    areaCreates: 0,
    areaUpdates: 0,
    childCreates: 0,
    childUpdates: 0,
  }

  const areaByGroup = new Map(
    areaRecords.map((record) => [record.group, record])
  )

  for (const area of areaRecords) {
    const action = await upsertWorkItem(
      client,
      serverToken,
      existingSnapshot,
      {
        description: area.description,
        docId: area.docId,
        id: area.id,
        labelIds: area.labelIds,
        parentId: null,
        primaryProjectId: project.id,
        status: "todo",
        teamId: target.team.id,
        title: area.title,
        type: "issue",
      },
      apply
    )

    if (action === "create") results.areaCreates += 1
    else results.areaUpdates += 1
  }

  const afterAreasSnapshot = apply
    ? await getSnapshot(client, serverToken)
    : snapshot

  if (!parentsOnly) {
    for (const child of childRecords) {
      const parent = areaByGroup.get(child.group)

      if (!parent) {
        throw new Error(`Missing area for ${child.sourceRef}`)
      }

      const action = await upsertWorkItem(
        client,
        serverToken,
        afterAreasSnapshot,
        {
          description: child.description,
          docId: child.docId,
          id: child.id,
          labelIds: child.labelIds,
          parentId: parent.id,
          primaryProjectId: project.id,
          status: child.status,
          teamId: target.team.id,
          title: child.title,
          type: "sub-issue",
        },
        apply
      )

      if (action === "create") results.childCreates += 1
      else results.childUpdates += 1
    }
  }

  if (apply) {
    await client.mutation(api.app.bumpScopedReadModelVersions, {
      serverToken,
      scopeKeys: buildScopeKeys({
        areaRecords,
        childRecords: parentsOnly ? [] : childRecords,
        projectId: project.id,
        teamId: target.team.id,
        workspaceId: target.workspace.id,
      }),
    })
  }

  const output = {
    apply,
    parentsOnly,
    workbookPath,
    target: {
      teamId: target.team.id,
      teamName: target.team.name,
      workspaceId: target.workspace.id,
      workspaceName: target.workspace.name,
      projectId: project.id,
      projectName: project.name,
    },
    source: {
      rows: rows.length,
      groups: groups.size,
      statusCounts,
      typeCounts,
      titleTruncations: childRecords.filter(
        (record) => record.title !== record.originalTitle
      ),
    },
    results,
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, apply ? "apply-result.json" : "dry-run-result.json"),
    JSON.stringify(output, null, 2)
  )

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
