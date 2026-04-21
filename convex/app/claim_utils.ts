export const DIGEST_CLAIM_TTL_MS = 15 * 60 * 1000

export function getDigestClaimRemainingMs(
  notification: {
    digestClaimId?: string | null
    digestClaimedAt?: string | null
  },
  nowMs: number
) {
  if (!notification.digestClaimId || !notification.digestClaimedAt) {
    return null
  }

  const claimedAtMs = Date.parse(notification.digestClaimedAt)

  if (Number.isNaN(claimedAtMs)) {
    return null
  }

  const remainingMs = DIGEST_CLAIM_TTL_MS - (nowMs - claimedAtMs)

  return remainingMs > 0 ? remainingMs : null
}

export function isActiveDigestClaim(
  notification: {
    digestClaimId?: string | null
    digestClaimedAt?: string | null
  },
  nowMs: number
) {
  return getDigestClaimRemainingMs(notification, nowMs) !== null
}
