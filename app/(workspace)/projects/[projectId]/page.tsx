"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

import { ProjectDetailScreen } from "@/components/app/screens"
import { getProjectHref } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const data = useAppStore()
  const href = getProjectHref(data, params.projectId)

  useEffect(() => {
    if (!href || href === `/projects/${params.projectId}`) {
      return
    }

    router.replace(href)
  }, [href, params.projectId, router])

  if (href && href !== `/projects/${params.projectId}`) {
    return null
  }

  return <ProjectDetailScreen projectId={params.projectId} />
}
