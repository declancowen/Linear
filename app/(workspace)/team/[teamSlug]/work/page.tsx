"use client"

import { useParams } from "next/navigation"

import { TeamWorkScreen } from "@/components/app/screens"

export default function TeamWorkPage() {
  const params = useParams<{ teamSlug: string }>()
  return <TeamWorkScreen teamSlug={params.teamSlug} />
}
