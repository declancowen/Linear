import { expect, vi } from "vitest"

export function createTestNotificationRecord(
  userId: string,
  actorId: string,
  message: string,
  entityType: string,
  entityId: string,
  type: string
) {
  return {
    id: `notification_${userId}`,
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
  }
}

export function getTestWorkItemAudienceUserIds(
  item: {
    assigneeId?: string | null
    creatorId?: string | null
    visibility?: "team" | "private" | null
  },
  teamMemberIds: string[]
) {
  if ((item.visibility ?? "team") !== "private") {
    return teamMemberIds
  }

  return [
    ...new Set(
      [item.creatorId, item.assigneeId].filter(
        (userId): userId is string => Boolean(userId)
      )
    ),
  ].filter((userId) => teamMemberIds.includes(userId))
}

export function mockEmptyQueryCollect(ctx: {
  db: {
    query: ReturnType<typeof vi.fn>
  }
}) {
  ctx.db.query.mockReturnValue({
    withIndex: vi.fn(() => ({
      collect: vi.fn().mockResolvedValue([]),
    })),
  })
}

export function expectEditableWorkItemAccessChecked({
  ctx,
  itemId,
  mock,
  userId,
}: {
  ctx: unknown
  itemId: string
  mock: ReturnType<typeof vi.fn>
  userId: string
}) {
  expect(mock).toHaveBeenCalledWith(
    ctx,
    expect.objectContaining({ id: itemId }),
    userId
  )
}

export async function expectPrivateWorkItemMutationDenied({
  ctx,
  itemId,
  mock,
  mutate,
  userId,
}: {
  ctx: {
    db: {
      patch: ReturnType<typeof vi.fn>
    }
  }
  itemId: string
  mock: ReturnType<typeof vi.fn>
  mutate: () => Promise<unknown>
  userId: string
}) {
  mock.mockRejectedValueOnce(new Error("Work item not found"))

  await expect(mutate()).rejects.toThrow("Work item not found")

  expectEditableWorkItemAccessChecked({
    ctx,
    itemId,
    mock,
    userId,
  })
  expect(ctx.db.patch).not.toHaveBeenCalled()
}
