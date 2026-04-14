"use client"

import { useParams } from "next/navigation"

import { ProjectDetailScreen } from "@/components/app/screens"

export default function WorkspaceProjectPage() {
  const params = useParams<{ projectId: string }>()

  return <ProjectDetailScreen projectId={params.projectId} />
}
