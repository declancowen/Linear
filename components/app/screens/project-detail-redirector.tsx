"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { ProjectDetailScreen } from "@/components/app/screens"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import { getProjectHref } from "@/lib/domain/selectors"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

/**
 * Renders {@link ProjectDetailScreen} for the top-level `/projects/[projectId]`
 * route. Mirrors the prior client-only behavior: when the project's canonical
 * href differs from the current route (e.g. it's actually a team project),
 * push the user to the canonical href. Otherwise render the screen.
 *
 * Lives in components/app/screens/ because the redirect logic is part of the
 * presentation/routing concern, not a server-side data acquisition concern.
 */
export function ProjectDetailRedirector({
  projectId,
  initialSeed,
}: {
  projectId: string
  initialSeed: ReadModelFetchResult<Partial<AppSnapshot>> | null
}) {
  const router = useRouter()
  const href = useAppStore((state) => getProjectHref(state, projectId))

  useEffect(() => {
    if (!href || href === `/projects/${projectId}`) {
      return
    }

    router.replace(href)
  }, [href, projectId, router])

  if (href && href !== `/projects/${projectId}`) {
    return null
  }

  return (
    <ProjectDetailScreen projectId={projectId} initialSeed={initialSeed} />
  )
}
