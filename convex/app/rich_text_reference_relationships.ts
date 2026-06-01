import type { MutationCtx } from "../_generated/server"

import {
  extractRichTextEntityReferences,
  type RichTextEntityReferenceType,
} from "../../lib/content/rich-text-references"
import {
  getDocumentDoc,
  getProjectDoc,
  getViewDoc,
  getWorkItemDoc,
} from "./data"
import {
  requireReadableDocumentAccess,
  requireReadableTeamAccess,
  requireReadableWorkItemAccess,
  requireReadableWorkspaceAccess,
} from "./access"

type DocumentDoc = NonNullable<Awaited<ReturnType<typeof getDocumentDoc>>>
type WorkItemDoc = NonNullable<Awaited<ReturnType<typeof getWorkItemDoc>>>

export type RichTextReferenceRelationshipIds = {
  documentIds: string[]
  projectIds: string[]
  viewIds: string[]
  workItemIds: string[]
}

const emptyRelationships: RichTextReferenceRelationshipIds = {
  documentIds: [],
  projectIds: [],
  viewIds: [],
  workItemIds: [],
}

function getReferenceIds(content: string, type: RichTextEntityReferenceType) {
  return extractRichTextEntityReferences(content)
    .filter((reference) => reference.type === type)
    .map((reference) => reference.id)
}

async function filterReadableDocumentReferenceIds(
  ctx: MutationCtx,
  ids: string[],
  currentUserId: string
) {
  const allowedIds: string[] = []

  for (const id of ids) {
    const document = await getDocumentDoc(ctx, id)

    if (
      !document ||
      document.kind === "private-document" ||
      document.kind === "item-description"
    ) {
      continue
    }

    try {
      await requireReadableDocumentAccess(ctx, document, currentUserId)
      allowedIds.push(document.id)
    } catch {
      continue
    }
  }

  return allowedIds
}

async function filterReadableWorkItemReferenceIds(
  ctx: MutationCtx,
  ids: string[],
  currentUserId: string,
  options: {
    excludeItemId?: string
  } = {}
) {
  const allowedIds: string[] = []

  for (const id of ids) {
    if (id === options.excludeItemId) {
      continue
    }

    const item = await getWorkItemDoc(ctx, id)

    if (!item || (item.visibility ?? "team") === "private") {
      continue
    }

    try {
      await requireReadableWorkItemAccess(ctx, item, currentUserId)
      allowedIds.push(item.id)
    } catch {
      continue
    }
  }

  return allowedIds
}

async function filterReadableProjectReferenceIds(
  ctx: MutationCtx,
  ids: string[],
  currentUserId: string
) {
  const allowedIds: string[] = []

  for (const id of ids) {
    const project = await getProjectDoc(ctx, id)

    if (!project) {
      continue
    }

    try {
      if (project.scopeType === "team") {
        await requireReadableTeamAccess(ctx, project.scopeId, currentUserId)
      } else {
        await requireReadableWorkspaceAccess(
          ctx,
          project.scopeId,
          currentUserId
        )
      }
      allowedIds.push(project.id)
    } catch {
      continue
    }
  }

  return allowedIds
}

async function filterReadableViewReferenceIds(
  ctx: MutationCtx,
  ids: string[],
  currentUserId: string
) {
  const allowedIds: string[] = []

  for (const id of ids) {
    const view = await getViewDoc(ctx, id)

    if (!view || view.scopeType === "personal") {
      continue
    }

    try {
      if (view.scopeType === "team") {
        await requireReadableTeamAccess(ctx, view.scopeId, currentUserId)
      } else {
        await requireReadableWorkspaceAccess(ctx, view.scopeId, currentUserId)
      }
      allowedIds.push(view.id)
    } catch {
      continue
    }
  }

  return allowedIds
}

export async function resolveDocumentRichTextReferenceRelationships(
  ctx: MutationCtx,
  input: {
    content: string
    currentUserId: string
    document: DocumentDoc
  }
): Promise<RichTextReferenceRelationshipIds> {
  if (input.document.kind === "private-document") {
    return emptyRelationships
  }

  const [documentIds, projectIds, viewIds, workItemIds] = await Promise.all([
    filterReadableDocumentReferenceIds(
      ctx,
      getReferenceIds(input.content, "document").filter(
        (id) => id !== input.document.id
      ),
      input.currentUserId
    ),
    filterReadableProjectReferenceIds(
      ctx,
      getReferenceIds(input.content, "project"),
      input.currentUserId
    ),
    filterReadableViewReferenceIds(
      ctx,
      getReferenceIds(input.content, "view"),
      input.currentUserId
    ),
    filterReadableWorkItemReferenceIds(
      ctx,
      getReferenceIds(input.content, "workItem"),
      input.currentUserId
    ),
  ])

  return { documentIds, projectIds, viewIds, workItemIds }
}

export async function resolveWorkItemDescriptionRichTextReferenceRelationships(
  ctx: MutationCtx,
  input: {
    content: string
    currentUserId: string
    item: WorkItemDoc
  }
): Promise<
  Pick<RichTextReferenceRelationshipIds, "documentIds" | "workItemIds">
> {
  if ((input.item.visibility ?? "team") === "private") {
    return {
      documentIds: [],
      workItemIds: [],
    }
  }

  const [documentIds, workItemIds] = await Promise.all([
    filterReadableDocumentReferenceIds(
      ctx,
      getReferenceIds(input.content, "document"),
      input.currentUserId
    ),
    filterReadableWorkItemReferenceIds(
      ctx,
      getReferenceIds(input.content, "workItem"),
      input.currentUserId,
      { excludeItemId: input.item.id }
    ),
  ])

  return { documentIds, workItemIds }
}

export async function resolveWorkItemCommentReferenceIds(
  ctx: MutationCtx,
  input: {
    content: string
    currentUserId: string
    item: WorkItemDoc
  }
) {
  if ((input.item.visibility ?? "team") === "private") {
    return []
  }

  return filterReadableWorkItemReferenceIds(
    ctx,
    getReferenceIds(input.content, "workItem"),
    input.currentUserId
  )
}
