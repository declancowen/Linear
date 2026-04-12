"use client"

import { useParams } from "next/navigation"

import { ViewsScreen } from "@/components/app/screens"
import { getTeamBySlug, teamHasFeature } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function TeamViewsPage() {
  const params = useParams<{ teamSlug: string }>()
  const data = useAppStore()
  const team = getTeamBySlug(data, params.teamSlug)

  if (!team) {
    return null
  }

  if (!teamHasFeature(team, "views")) {
    return <div className="p-6 text-sm text-muted-foreground">Views are disabled for this team.</div>
  }

  return (
    <ViewsScreen
      scopeId={team.id}
      scopeType="team"
      title={`${team.name} views`}
      description="Saved work views with list, board, and timeline layouts."
    />
  )
}
