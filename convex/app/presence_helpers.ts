import type { Doc } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

type DocumentPresenceDoc = Doc<"documentPresence">

export const DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS = 2 * 60 * 1000

export type PresenceActor = {
  currentUserId: string
  workosUserId: string
  email: string
  name: string
  avatarUrl: string
  avatarImageUrl?: string | null
  activeBlockId?: string | null
  editing?: boolean
  sessionId: string
}

export type PresenceClearActor = Pick<
  PresenceActor,
  "currentUserId" | "sessionId" | "workosUserId"
>

function presenceEntryMatchesActor(
  entry: DocumentPresenceDoc,
  actor: PresenceClearActor
) {
  return (
    entry.workosUserId === actor.workosUserId ||
    (!entry.workosUserId && entry.userId === actor.currentUserId)
  )
}

function presenceEntryConflictsWithActor(
  entry: DocumentPresenceDoc,
  actor: PresenceClearActor
) {
  return entry.workosUserId
    ? entry.workosUserId !== actor.workosUserId
    : entry.userId !== actor.currentUserId
}

function comparePresenceLastSeenDesc(
  left: DocumentPresenceDoc,
  right: DocumentPresenceDoc
) {
  return Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
}

function getLatestPresenceForActor(
  entries: DocumentPresenceDoc[],
  actor: PresenceActor
) {
  return [...entries]
    .filter((entry) => presenceEntryMatchesActor(entry, actor))
    .sort(comparePresenceLastSeenDesc)[0]
}

function assertPresenceSessionOwnedByActor(
  entries: DocumentPresenceDoc[],
  actor: PresenceClearActor
) {
  const hasConflictingPresence = entries.some((entry) =>
    presenceEntryConflictsWithActor(entry, actor)
  )

  if (hasConflictingPresence) {
    throw new Error("Document presence session is already in use")
  }
}

function getPresenceWriteFields(
  documentId: string,
  actor: PresenceActor,
  currentTime: string
) {
  return {
    activeBlockId: actor.activeBlockId ?? null,
    avatarUrl: actor.avatarUrl,
    avatarImageUrl: actor.avatarImageUrl ?? null,
    documentId,
    email: actor.email,
    editing: actor.editing ?? false,
    lastSeenAt: currentTime,
    name: actor.name,
    userId: actor.currentUserId,
    workosUserId: actor.workosUserId,
  }
}

export function isDocumentPresenceActive(
  lastSeenAt: string,
  currentTime = Date.now()
) {
  const parsedLastSeenAt = Date.parse(lastSeenAt)

  return (
    Number.isFinite(parsedLastSeenAt) &&
    currentTime - parsedLastSeenAt <= DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS
  )
}

export async function assertDocumentEditLeaseAvailable(
  ctx: MutationCtx,
  documentId: string,
  actor: PresenceActor,
  currentTime: string
) {
  const entries = await ctx.db
    .query("documentPresence")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect()
  const currentTimeMs = Date.parse(currentTime)
  const hasConflictingEditor = entries.some(
    (entry) =>
      entry.editing === true &&
      entry.sessionId !== actor.sessionId &&
      isDocumentPresenceActive(entry.lastSeenAt, currentTimeMs)
  )

  if (hasConflictingEditor) {
    throw new Error("Work item is already being edited")
  }
}

export async function assertDocumentEditLeaseOwned(
  ctx: MutationCtx,
  documentId: string,
  actor: Pick<PresenceActor, "currentUserId" | "sessionId">,
  currentTime: string
) {
  const entries = await ctx.db
    .query("documentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", actor.sessionId))
    .collect()
  const currentTimeMs = Date.parse(currentTime)
  const ownsActiveLease = entries.some(
    (entry) =>
      entry.documentId === documentId &&
      entry.userId === actor.currentUserId &&
      entry.editing === true &&
      isDocumentPresenceActive(entry.lastSeenAt, currentTimeMs)
  )

  if (!ownsActiveLease) {
    throw new Error("Work item edit session is no longer active")
  }
}

async function deleteDuplicatePresenceEntries(
  ctx: MutationCtx,
  entries: DocumentPresenceDoc[],
  existingPresence: DocumentPresenceDoc,
  actor: PresenceActor
) {
  for (const duplicateEntry of entries) {
    if (
      duplicateEntry._id !== existingPresence._id &&
      presenceEntryMatchesActor(duplicateEntry, actor)
    ) {
      await ctx.db.delete(duplicateEntry._id)
    }
  }
}

export async function upsertDocumentPresenceForActor(
  ctx: MutationCtx,
  documentId: string,
  actor: PresenceActor,
  currentTime: string
) {
  const existingPresenceEntries = await ctx.db
    .query("documentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", actor.sessionId))
    .collect()

  const existingPresence = getLatestPresenceForActor(
    existingPresenceEntries,
    actor
  )

  assertPresenceSessionOwnedByActor(existingPresenceEntries, actor)

  if (existingPresence) {
    await ctx.db.patch(existingPresence._id, {
      ...getPresenceWriteFields(documentId, actor, currentTime),
    })
    await deleteDuplicatePresenceEntries(
      ctx,
      existingPresenceEntries,
      existingPresence,
      actor
    )
    return
  }

  await ctx.db.insert("documentPresence", {
    ...getPresenceWriteFields(documentId, actor, currentTime),
    sessionId: actor.sessionId,
    createdAt: currentTime,
  })
}

export async function clearDocumentPresenceForActor(
  ctx: MutationCtx,
  documentId: string,
  actor: PresenceClearActor
) {
  const existingPresenceEntries = await ctx.db
    .query("documentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", actor.sessionId))
    .collect()

  if (existingPresenceEntries.length === 0) {
    return { ok: true }
  }

  assertPresenceSessionOwnedByActor(existingPresenceEntries, actor)

  for (const existingPresence of existingPresenceEntries) {
    if (existingPresence.documentId === documentId) {
      await ctx.db.delete(existingPresence._id)
    }
  }

  return { ok: true }
}
