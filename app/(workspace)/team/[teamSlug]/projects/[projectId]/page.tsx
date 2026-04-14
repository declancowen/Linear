"use client"

import { useParams } from "next/navigation"

import { ProjectDetailScreen } from "@/components/app/screens"

export default function TeamProjectPage() {
  const params = useParams<{ projectId: string }>()

  return <ProjectDetailScreen projectId={params.projectId} />
}
