import type { Doc } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

type DocumentPresenceDoc = Doc<"documentPresence">

export type PresenceActor = {
  currentUserId: string
  workosUserId: string
  email: string
  name: string
  avatarUrl: string
  avatarImageUrl?: string | null
  activeBlockId?: string | null
  sessionId: string
}

function presenceEntryMatchesActor(
  entry: DocumentPresenceDoc,
  actor: PresenceActor
) {
  return (
    entry.workosUserId === actor.workosUserId ||
    (!entry.workosUserId && entry.userId === actor.currentUserId)
  )
}

function presenceEntryConflictsWithActor(
  entry: DocumentPresenceDoc,
  actor: PresenceActor
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
  actor: PresenceActor
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
    lastSeenAt: currentTime,
    name: actor.name,
    userId: actor.currentUserId,
    workosUserId: actor.workosUserId,
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
