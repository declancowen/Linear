"use client"

import { useParams } from "next/navigation"

import { TeamChannelsScreen } from "@/components/app/collaboration-screens"

export default function TeamChannelsPage() {
  const params = useParams<{ teamSlug: string }>()
  return <TeamChannelsScreen teamSlug={params.teamSlug} />
}
