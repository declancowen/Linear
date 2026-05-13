"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { SpinnerGap } from "@phosphor-icons/react"

import { cn, isImageAssetSource, resolveImageAssetSource } from "@/lib/utils"

type WorkspaceSelectorWorkspace = {
  id: string
  name: string
  logoUrl?: string | null
  logoImageUrl?: string | null
}

function WorkspaceLogo({
  workspace,
}: {
  workspace: WorkspaceSelectorWorkspace
}) {
  const [failedLogoImageSrc, setFailedLogoImageSrc] = useState<string | null>(
    null
  )
  const logoImageSrc = resolveImageAssetSource(
    workspace.logoImageUrl,
    workspace.logoUrl
  )
  const fallbackLogo = isImageAssetSource(workspace.logoUrl)
    ? workspace.name.charAt(0)
    : workspace.logoUrl?.trim() || workspace.name.charAt(0)

  if (logoImageSrc && logoImageSrc !== failedLogoImageSrc) {
    return (
      <Image
        alt=""
        src={logoImageSrc}
        width={32}
        height={32}
        unoptimized
        className="size-8 rounded-md object-cover"
        onError={() => setFailedLogoImageSrc(logoImageSrc)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-md bg-surface-3 text-[11.5px] font-semibold text-fg-2"
    >
      {fallbackLogo.slice(0, 2).toUpperCase() || "W"}
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
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Select where you want to continue.
          </p>
        </header>

        <div
          className="mx-auto grid w-full gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
            maxWidth: "calc(4 * 116px + 3 * 0.5rem)",
          }}
        >
          {workspaces.map((workspace) => {
            const selected = pendingWorkspaceId === workspace.id

            return (
              <button
                key={workspace.id}
                type="button"
                disabled={isPending}
                aria-label={`Open ${workspace.name}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-line-soft bg-surface px-2 py-3 text-center transition-colors hover:border-line hover:bg-surface-2 focus-visible:border-line focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-wait",
                  isPending && !selected && "opacity-50",
                  selected && "border-line bg-surface-2"
                )}
                onClick={() => selectWorkspace(workspace.id)}
              >
                {selected ? (
                  <SpinnerGap
                    className="size-4 animate-spin text-fg-3"
                    aria-hidden
                  />
                ) : (
                  <WorkspaceLogo workspace={workspace} />
                )}
                <span className="line-clamp-2 text-[12px] leading-tight font-medium text-foreground">
                  {workspace.name}
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
