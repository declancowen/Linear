"use client"

import { useParams } from "next/navigation"

import { TeamChatScreen } from "@/components/app/collaboration-screens"

export default function TeamChatPage() {
  const params = useParams<{ teamSlug: string }>()
  return <TeamChatScreen teamSlug={params.teamSlug} />
}
