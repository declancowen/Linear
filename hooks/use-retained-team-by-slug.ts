"use client"

import { useEffect, useRef, useState } from "react"

import { getTeamBySlug } from "@/lib/domain/selectors"
import type { Team } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

const RETAINED_TEAM_GRACE_PERIOD_MS = 1000

export function useRetainedTeamBySlug(teamSlug: string) {
  const liveTeam = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const [, forceRerender] = useState(0)
  const retainedTeamRef = useRef<{
    slug: string
    team: Team
  } | null>(null)
  const expiryTimeoutIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (expiryTimeoutIdRef.current !== null) {
      window.clearTimeout(expiryTimeoutIdRef.current)
      expiryTimeoutIdRef.current = null
    }

    if (liveTeam) {
      retainedTeamRef.current = {
        slug: teamSlug,
        team: liveTeam,
      }

      return
    }

    if (retainedTeamRef.current?.slug !== teamSlug) {
      retainedTeamRef.current = null
      return
    }

    expiryTimeoutIdRef.current = window.setTimeout(() => {
      retainedTeamRef.current = null
      forceRerender((current) => current + 1)
      expiryTimeoutIdRef.current = null
    }, RETAINED_TEAM_GRACE_PERIOD_MS)

    return () => {
      if (expiryTimeoutIdRef.current !== null) {
        window.clearTimeout(expiryTimeoutIdRef.current)
        expiryTimeoutIdRef.current = null
      }
    }
  }, [liveTeam, teamSlug])

  const team =
    liveTeam ??
    (retainedTeamRef.current?.slug === teamSlug
      ? retainedTeamRef.current.team
      : null)

  return {
    liveTeam,
    team,
  }
}
