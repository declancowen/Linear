"use client"

import { useParams } from "next/navigation"

import { TeamSettingsScreen } from "@/components/app/settings-screens/team-settings-screen"

export default function TeamSettingsPage() {
  const params = useParams<{ teamSlug: string }>()

  return <TeamSettingsScreen teamSlug={params.teamSlug} />
}
