"use client"

import { useParams } from "next/navigation"

import { PeopleProfileScreen } from "@/components/app/people-screen"

export default function WorkspacePersonPage() {
  const params = useParams<{ userId: string }>()

  return <PeopleProfileScreen userId={params.userId} />
}
