import type { RichTextEntityReferenceCandidate } from "@/lib/content/rich-text-references"
import { getViewHref } from "@/lib/domain/default-views"
import type { AppData, Document, WorkItem } from "@/lib/domain/types"
import {
  getAccessibleTeams,
  getDocument,
  getProjectHref,
  getProjectsForScope,
} from "@/lib/domain/selectors-internal/core"
import {
  getSearchableDocuments,
  getViewContextLabel,
  getWorkspaceDirectoryViews,
} from "@/lib/domain/selectors-internal/content"
import { getVisibleWorkItems } from "@/lib/domain/selectors-internal/work-items"

export type RichTextReferenceContext =
  | {
      type: "document"
      documentId: string
    }
  | {
      type: "workItemDescription"
      itemId: string
    }
  | {
      type: "workItemComment"
      itemId: string
    }

function getWorkspaceIdForWorkItem(data: AppData, item: WorkItem) {
  if ((item.visibility ?? "team") === "private") {
    return item.workspaceId ?? null
  }

  return (
    item.workspaceId ??
    data.teams.find((team) => team.id === item.teamId)?.workspaceId ??
    null
  )
}

function getReferenceWorkspaceId(
  data: AppData,
  context: RichTextReferenceContext
) {
  if (context.type === "document") {
    return getDocument(data, context.documentId)?.workspaceId ?? null
  }

  const item = data.workItems.find((entry) => entry.id === context.itemId)

  return item ? getWorkspaceIdForWorkItem(data, item) : null
}

function isPrivateReferenceSource(
  data: AppData,
  context: RichTextReferenceContext
) {
  if (context.type === "document") {
    const document = getDocument(data, context.documentId)

    return document?.kind === "private-document"
  }

  const item = data.workItems.find((entry) => entry.id === context.itemId)

  return (item?.visibility ?? "team") === "private"
}

function getDocumentContextLabel(
  document: Document,
  accessibleTeamNamesById: Map<string, string>
) {
  if (document.kind === "workspace-document") {
    return "Workspace document"
  }

  const teamName = accessibleTeamNamesById.get(document.teamId ?? "")

  return teamName ? `${teamName} document` : "Team document"
}

function getDocumentReferenceCandidates(
  data: AppData,
  workspaceId: string,
  context: RichTextReferenceContext,
  accessibleTeamNamesById: Map<string, string>
): RichTextEntityReferenceCandidate[] {
  return getSearchableDocuments(data, workspaceId)
    .filter(
      (document) =>
        document.kind !== "private-document" &&
        document.kind !== "item-description" &&
        (context.type !== "document" || document.id !== context.documentId)
    )
    .map((document) => ({
      type: "document" as const,
      id: document.id,
      label: document.title.trim() || "Untitled document",
      subtitle: getDocumentContextLabel(document, accessibleTeamNamesById),
      href: `/docs/${document.id}`,
      keywords: [document.id, document.previewText ?? document.content],
    }))
}

function getWorkItemReferenceCandidates(
  data: AppData,
  workspaceId: string,
  context: RichTextReferenceContext
): RichTextEntityReferenceCandidate[] {
  return getVisibleWorkItems(data, { workspaceId })
    .filter(
      (item) =>
        context.type === "document" ||
        context.itemId !== item.id ||
        context.type === "workItemComment"
    )
    .map((item) => ({
      type: "workItem" as const,
      id: item.id,
      label: item.title.trim() || item.key || "Untitled work item",
      subtitle: item.key,
      href: `/items/${item.id}`,
      keywords: [item.id, item.key, item.status, item.priority],
    }))
}

function getProjectReferenceCandidates(
  data: AppData,
  workspaceId: string
): RichTextEntityReferenceCandidate[] {
  return getProjectsForScope(data, "workspace", workspaceId).map((project) => ({
    type: "project" as const,
    id: project.id,
    label: project.name.trim() || "Untitled project",
    subtitle:
      project.scopeType === "workspace" ? "Workspace project" : "Team project",
    href: getProjectHref(data, project) ?? `/projects/${project.id}`,
    keywords: [project.id, project.summary, project.status, project.priority],
  }))
}

function getViewReferenceCandidates(
  data: AppData,
  workspaceId: string
): RichTextEntityReferenceCandidate[] {
  return getWorkspaceDirectoryViews(data, workspaceId).map((view) => ({
    type: "view" as const,
    id: view.id,
    label: view.name.trim() || "Untitled view",
    subtitle: `${getViewContextLabel(data, view)} ${view.entityKind} view`,
    href: getViewHref(view),
    keywords: [view.id, view.description, view.route, view.entityKind],
  }))
}

function sortReferenceCandidates(
  candidates: RichTextEntityReferenceCandidate[]
) {
  return [...candidates].sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.label.localeCompare(right.label)
  )
}

export function getRichTextReferenceCandidates(
  data: AppData,
  context: RichTextReferenceContext
): RichTextEntityReferenceCandidate[] {
  if (isPrivateReferenceSource(data, context)) {
    return []
  }

  const workspaceId = getReferenceWorkspaceId(data, context)

  if (!workspaceId) {
    return []
  }

  const accessibleTeamNamesById = new Map(
    getAccessibleTeams(data)
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => [team.id, team.name])
  )
  const documents = getDocumentReferenceCandidates(
    data,
    workspaceId,
    context,
    accessibleTeamNamesById
  )
  const workItems = getWorkItemReferenceCandidates(data, workspaceId, context)

  return sortReferenceCandidates([
    ...documents,
    ...workItems,
    ...getProjectReferenceCandidates(data, workspaceId),
    ...getViewReferenceCandidates(data, workspaceId),
  ])
}
