"use client"

import { useParams } from "next/navigation"

import { ProjectsScreen } from "@/components/app/screens"
import { getTeamBySlug } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function TeamProjectsPage() {
  const params = useParams<{ teamSlug: string }>()
  const data = useAppStore()
  const team = getTeamBySlug(data, params.teamSlug)

  if (!team) {
    return null
  }

  return (
    <ProjectsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title={`${team.name} projects`}
      description="Project templates, health, dates, and linked work for the current team."
    />
  )
}
