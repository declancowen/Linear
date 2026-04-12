"use client"

import { useParams } from "next/navigation"

import { DocsScreen } from "@/components/app/screens"
import { getTeamBySlug } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function TeamDocsPage() {
  const params = useParams<{ teamSlug: string }>()
  const data = useAppStore()
  const team = getTeamBySlug(data, params.teamSlug)

  if (!team) {
    return null
  }

  return (
    <DocsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title="Docs"
      description="Free-standing team documents with workspace aggregation."
    />
  )
}
