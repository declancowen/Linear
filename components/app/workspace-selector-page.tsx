"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

type WorkspaceSelectorWorkspace = {
  id: string
  name: string
  logoUrl?: string | null
}

function WorkspaceLogo({
  workspace,
}: {
  workspace: WorkspaceSelectorWorkspace
}) {
  if (workspace.logoUrl) {
    return (
      <Image
        alt=""
        src={workspace.logoUrl}
        width={56}
        height={56}
        unoptimized
        className="size-14 rounded-xl object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      className="grid size-14 place-items-center rounded-xl border border-line-soft bg-surface-2 text-lg font-semibold text-foreground"
    >
      {workspace.name.trim().slice(0, 1).toUpperCase() || "W"}
    </span>
  )
}

export function WorkspaceSelectorPage({
  workspaces,
}: {
  workspaces: WorkspaceSelectorWorkspace[]
}) {
  const router = useRouter()
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function selectWorkspace(workspaceId: string) {
    setError(null)
    setPendingWorkspaceId(workspaceId)
    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/current/selection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workspaceId }),
        })

        if (!response.ok) {
          throw new Error("Failed to select workspace")
        }

        router.push("/workspace/projects")
        router.refresh()
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to select workspace"
        )
        setPendingWorkspaceId(null)
      }
    })
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select where you want to continue.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {workspaces.map((workspace) => {
            const selected = pendingWorkspaceId === workspace.id

            return (
              <button
                key={workspace.id}
                type="button"
                disabled={isPending}
                aria-label={`Open ${workspace.name}`}
                className={cn(
                  "aspect-square rounded-xl border border-line-soft bg-surface px-4 py-5 text-center transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70",
                  selected && "border-ring bg-surface-2"
                )}
                onClick={() => selectWorkspace(workspace.id)}
              >
                <span className="flex h-full flex-col items-center justify-center gap-4">
                  <WorkspaceLogo workspace={workspace} />
                  <span className="line-clamp-2 text-sm font-medium text-foreground">
                    {workspace.name}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </main>
  )
}
