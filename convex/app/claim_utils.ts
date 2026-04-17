export const DIGEST_CLAIM_TTL_MS = 15 * 60 * 1000

export function isActiveDigestClaim(
  notification: {
    digestClaimId?: string | null
    digestClaimedAt?: string | null
  },
  nowMs: number
) {
  if (!notification.digestClaimId || !notification.digestClaimedAt) {
    return false
  }

  const claimedAtMs = Date.parse(notification.digestClaimedAt)

  if (Number.isNaN(claimedAtMs)) {
    return false
  }

  return nowMs - claimedAtMs < DIGEST_CLAIM_TTL_MS
}
