"use client"

import { useRef } from "react"

import { getTeamBySlug } from "@/lib/domain/selectors"
import type { Team } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

export function useRetainedTeamBySlug(teamSlug: string) {
  const liveTeam = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const retainedTeamRef = useRef<{
    slug: string
    team: Team
  } | null>(null)

  if (liveTeam) {
    retainedTeamRef.current = {
      slug: teamSlug,
      team: liveTeam,
    }
  }

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
