"use client"

import { ArrowRight, X } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchSnapshotState } from "@/lib/convex/client"
import { useAppStore } from "@/lib/store/app-store"

const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024
const DEFAULT_AVATAR_SIZE = 56
const DEFAULT_WORKSPACE_NAME = "Product Development"
const DEFAULT_WORKSPACE_DESCRIPTION =
  "Roadmaps, priorities, and release planning for the core product team."

function getWorkspaceBadge(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "PD"
  )
}

async function uploadWorkspaceLogo(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file")
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }

  const uploadUrlResponse = await fetch("/api/settings-images/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind: "workspace-logo" }),
  })
  const uploadUrlPayload = (await uploadUrlResponse
    .json()
    .catch(() => null)) as {
    error?: string
    uploadUrl?: string
  } | null

  if (!uploadUrlResponse.ok || !uploadUrlPayload?.uploadUrl) {
    throw new Error(
      uploadUrlPayload?.error ?? "Failed to prepare the logo upload"
    )
  }

  const storageResponse = await fetch(uploadUrlPayload.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })
  const storagePayload = (await storageResponse.json().catch(() => null)) as {
    storageId?: string
  } | null

  if (!storageResponse.ok || !storagePayload?.storageId) {
    throw new Error("Logo upload failed")
  }

  return storagePayload.storageId
}

export function OnboardingWorkspaceForm() {
  const router = useRouter()
  const [name, setName] = useState(DEFAULT_WORKSPACE_NAME)
  const [description, setDescription] = useState(DEFAULT_WORKSPACE_DESCRIPTION)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const nameFieldRef = useRef<HTMLDivElement | null>(null)
  const [avatarSize, setAvatarSize] = useState(DEFAULT_AVATAR_SIZE)

  useEffect(() => {
    if (!logoPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    const field = nameFieldRef.current

    if (!field) {
      return
    }

    const updateAvatarSize = () => {
      setAvatarSize(
        Math.max(DEFAULT_AVATAR_SIZE, Math.round(field.getBoundingClientRect().height))
      )
    }

    updateAvatarSize()

    const observer = new ResizeObserver(() => {
      updateAvatarSize()
    })

    observer.observe(field)

    return () => {
      observer.disconnect()
    }
  }, [])

  async function handleCreateWorkspace() {
    const normalizedName = name.trim()
    const normalizedDescription = description.trim()

    if (!normalizedName || !normalizedDescription) {
      toast.error("Enter a workspace name and description")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          description: normalizedDescription,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create workspace")
      }

      if (logoFile) {
        try {
          const logoImageStorageId = await uploadWorkspaceLogo(logoFile)
          const brandingResponse = await fetch("/api/workspace/current", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: normalizedName,
              description: normalizedDescription,
              logoUrl: getWorkspaceBadge(normalizedName),
              logoImageStorageId,
              accent: "emerald",
            }),
          })
          const brandingPayload = (await brandingResponse
            .json()
            .catch(() => null)) as {
            error?: string
          } | null

          if (!brandingResponse.ok) {
            throw new Error(
              brandingPayload?.error ?? "Failed to save workspace branding"
            )
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `${error.message}. You can retry from workspace settings.`
              : "Workspace created, but the logo upload failed."
          )
        }
      }

      toast.success("Workspace created")
      try {
        const snapshotState = await fetchSnapshotState()

        if (snapshotState) {
          useAppStore.getState().replaceDomainData(snapshotState.snapshot)
          router.replace("/workspace/projects")
          return
        }
      } catch (error) {
        console.error(
          "Failed to refresh app snapshot after workspace creation",
          error
        )
      }

      window.location.replace("/workspace/projects")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null

          if (!file) {
            return
          }

          if (!file.type.startsWith("image/")) {
            toast.error("Choose an image file")
            event.target.value = ""
            return
          }

          if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
            toast.error("Images must be 10 MB or smaller")
            event.target.value = ""
            return
          }

          if (logoPreviewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(logoPreviewUrl)
          }

          setLogoFile(file)
          setLogoPreviewUrl(URL.createObjectURL(file))
          event.target.value = ""
        }}
      />

      <FieldGroup className="gap-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-4">
          <button
            type="button"
            className="group relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-black text-xl font-semibold tracking-[0.18em] text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-black"
            onClick={() => fileInputRef.current?.click()}
            style={{
              height: avatarSize,
              width: avatarSize,
            }}
          >
            {logoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Workspace logo preview"
                className="h-full w-full object-cover"
                src={logoPreviewUrl}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                {getWorkspaceBadge(name)}
              </span>
            )}
          </button>

          <div ref={nameFieldRef} className="min-w-0 flex-1">
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <FieldContent>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={DEFAULT_WORKSPACE_NAME}
                />
              </FieldContent>
            </Field>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="workspace-description">Description</FieldLabel>
          <FieldContent>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 resize-none"
              placeholder={DEFAULT_WORKSPACE_DESCRIPTION}
            />
          </FieldContent>
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-9 items-center gap-3 text-xs text-muted-foreground">
            {logoFile ? <span>{logoFile.name}</span> : null}
            {logoFile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  if (logoPreviewUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(logoPreviewUrl)
                  }

                  setLogoFile(null)
                  setLogoPreviewUrl(null)
                }}
              >
                <X className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>

          <Button
            disabled={submitting}
            className="w-full sm:w-auto"
            onClick={() => void handleCreateWorkspace()}
          >
            {submitting ? "Creating..." : "Create workspace"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </FieldGroup>
    </section>
  )
}
