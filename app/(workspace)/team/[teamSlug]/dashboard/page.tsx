"use client"

import { useParams } from "next/navigation"

import { TeamDashboardScreen } from "@/components/app/screens/team-dashboard-screen"

export default function TeamDashboardPage() {
  const params = useParams<{ teamSlug: string }>()
  return <TeamDashboardScreen teamSlug={params.teamSlug} />
}
