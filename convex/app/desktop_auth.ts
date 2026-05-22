import type { MutationCtx } from "../_generated/server"
import { assertServerToken } from "./core"

const DESKTOP_HANDOFF_CLEANUP_BATCH_SIZE = 25

async function deleteExpiredDesktopHandoffTickets(
  ctx: MutationCtx,
  consumedAt: number
) {
  const expiredTickets = await ctx.db
    .query("desktopHandoffTickets")
    .withIndex("by_expires_at", (q) => q.lt("expiresAt", consumedAt))
    .take(DESKTOP_HANDOFF_CLEANUP_BATCH_SIZE)

  await Promise.all(
    expiredTickets.map((ticket) => ctx.db.delete(ticket._id))
  )
}

export async function consumeDesktopHandoffTicketHandler(
  ctx: MutationCtx,
  args: {
    serverToken: string
    ticketId: string
    expiresAt: number
    consumedAt: number
  }
) {
  assertServerToken(args.serverToken)
  await deleteExpiredDesktopHandoffTickets(ctx, args.consumedAt)

  const [existingTicket] = await ctx.db
    .query("desktopHandoffTickets")
    .withIndex("by_ticket_id", (q) => q.eq("ticketId", args.ticketId))
    .take(1)

  if (existingTicket) {
    return {
      consumed: false,
    }
  }

  await ctx.db.insert("desktopHandoffTickets", {
    ticketId: args.ticketId,
    expiresAt: args.expiresAt,
    consumedAt: args.consumedAt,
  })

  return {
    consumed: true,
  }
}
