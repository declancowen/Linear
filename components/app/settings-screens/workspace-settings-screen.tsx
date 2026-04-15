"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "@phosphor-icons/react"
import { toast } from "sonner"

import { syncUpdateWorkspaceBranding } from "@/lib/convex/client"
import {
  canAdminWorkspace,
  getCurrentWorkspace,
  getWorkspaceUsers,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn, resolveImageAssetSource } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { ImageUploadControl, SettingsScaffold, SettingsSection } from "./shared"
import { getUserInitials, uploadSettingsImage } from "./utils"

const workspaceAccentOptions = [
  {
    value: "emerald",
    swatchClassName: "bg-emerald-500",
  },
  {
    value: "blue",
    swatchClassName: "bg-blue-500",
  },
  {
    value: "violet",
    swatchClassName: "bg-violet-500",
  },
  {
    value: "amber",
    swatchClassName: "bg-amber-500",
  },
  {
    value: "rose",
    swatchClassName: "bg-rose-500",
  },
  {
    value: "slate",
    swatchClassName: "bg-slate-500",
  },
] as const

export function WorkspaceSettingsScreen() {
  const router = useRouter()
  const workspace = useAppStore(getCurrentWorkspace)
  const workspaceId = workspace?.id ?? null
  const workspaceName = workspace?.name ?? ""
  const workspaceLogoUrl = workspace?.logoUrl ?? ""
  const workspaceResolvedLogoSrc =
    resolveImageAssetSource(workspace?.logoImageUrl, workspace?.logoUrl) ?? null
  const workspaceAccent = workspace?.settings.accent ?? "emerald"
  const workspaceDescription = workspace?.settings.description ?? ""
  const canManageWorkspace = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? canAdminWorkspace(state, currentWorkspace.id)
      : false
  })
  const workspaceUsersCount = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? getWorkspaceUsers(state, currentWorkspace.id).length
      : 0
  })
  const workspaceTeamsCount = useAppStore((state) => {
    if (!state.currentWorkspaceId) {
      return 0
    }

    return state.teams.filter(
      (team) => team.workspaceId === state.currentWorkspaceId
    ).length
  })
  const currentLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const [name, setName] = useState(workspace?.name ?? "")
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl ?? "")
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    currentLogoImageSrc ?? null
  )
  const [logoImageStorageId, setLogoImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearLogoImage, setClearLogoImage] = useState(false)
  const [accent, setAccent] = useState(workspace?.settings.accent ?? "emerald")
  const [description, setDescription] = useState(
    workspace?.settings.description ?? ""
  )
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fallbackBadge =
    logoUrl.trim() || getUserInitials(name || workspace?.name)
  const savedAccent = workspace?.settings.accent ?? "emerald"
  const savedAccentLabel =
    savedAccent.charAt(0).toUpperCase() + savedAccent.slice(1)

  useEffect(() => {
    if (!logoPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    setName(workspaceName)
    setLogoUrl(workspaceLogoUrl)
    setLogoPreviewUrl(workspaceResolvedLogoSrc)
    setLogoImageStorageId(undefined)
    setClearLogoImage(false)
    setAccent(workspaceAccent)
    setDescription(workspaceDescription)
  }, [
    workspaceAccent,
    workspaceDescription,
    workspaceId,
    workspaceLogoUrl,
    workspaceName,
    workspaceResolvedLogoSrc,
  ])

  if (!workspace) {
    return (
      <SettingsScaffold
        title="Workspace settings"
        subtitle="Current workspace not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Workspace unavailable</CardTitle>
            <CardDescription>
              Select a workspace before opening workspace settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  const currentWorkspace = workspace

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true)
      const uploaded = await uploadSettingsImage("workspace-logo", file)
      setLogoPreviewUrl(uploaded.previewUrl)
      setLogoImageStorageId(uploaded.storageId)
      setClearLogoImage(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo"
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      await syncUpdateWorkspaceBranding(
        currentWorkspace.id,
        name,
        logoUrl,
        accent,
        description,
        {
          ...(logoImageStorageId ? { logoImageStorageId } : {}),
          ...(clearLogoImage ? { clearLogoImage: true } : {}),
        }
      )

      toast.success("Workspace updated")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScaffold
      title="Workspace settings"
      subtitle="Branding, appearance, and administration"
      footer={
        <Button
          disabled={!canManageWorkspace || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving..." : "Save workspace"}
        </Button>
      }
    >
      <div className="max-w-3xl space-y-10">
        {!canManageWorkspace ? (
          <Card className="border-dashed shadow-none">
            <CardHeader>
              <CardTitle>Read-only access</CardTitle>
              <CardDescription>
                You need workspace admin access to change these settings.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="flex items-start gap-4 border-b pb-6">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {currentLogoImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={currentWorkspace.name}
                className="size-full object-cover"
                src={currentLogoImageSrc}
              />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {currentWorkspace.logoUrl ||
                  getUserInitials(currentWorkspace.name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{workspace.name}</div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {workspace.settings.description || "No description set."}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{workspaceUsersCount} members</span>
              <span>·</span>
              <span>{workspaceTeamsCount} teams</span>
              <span>·</span>
              <span>{savedAccentLabel}</span>
            </div>
          </div>
        </div>

        <SettingsSection
          title="Branding"
          description="Name, logo, and description for your workspace."
        >
          <ImageUploadControl
            description="Square image used across the workspace."
            disabled={!canManageWorkspace}
            imageSrc={logoPreviewUrl}
            onClear={() => {
              setLogoPreviewUrl(null)
              setLogoImageStorageId(undefined)
              setClearLogoImage(true)
            }}
            onSelect={handleLogoUpload}
            preview={
              <span className="text-base font-semibold text-muted-foreground">
                {fallbackBadge}
              </span>
            }
            shape="square"
            title="Workspace logo"
            uploading={uploadingLogo}
          />

          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
              <FieldContent>
                <Input
                  id="workspace-name"
                  disabled={!canManageWorkspace}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-logo">Fallback badge</FieldLabel>
              <FieldContent>
                <Input
                  id="workspace-logo"
                  disabled={!canManageWorkspace}
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                />
              </FieldContent>
              <FieldDescription>
                Used when no uploaded workspace image is available.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-description">
                Description
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id="workspace-description"
                  className="min-h-24 resize-none"
                  disabled={!canManageWorkspace}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </FieldContent>
              <FieldDescription>
                Shown in the workspace summary and any discovery surfaces.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Accent color</FieldLabel>
              <FieldContent>
                <div className="flex flex-wrap gap-3">
                  {workspaceAccentOptions.map((option) => {
                    const selected = accent === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-label={option.value}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          option.swatchClassName,
                          selected &&
                            "ring-2 ring-offset-2 ring-offset-background"
                        )}
                        disabled={!canManageWorkspace}
                        onClick={() => setAccent(option.value)}
                      >
                        {selected ? (
                          <Check
                            className="size-3.5 text-white"
                            weight="bold"
                          />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </FieldContent>
            </Field>
          </FieldGroup>
        </SettingsSection>

        <section className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Danger zone
            </h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Delete workspace</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Permanently remove this workspace and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button type="button" variant="destructive" disabled>
              Delete workspace
            </Button>
          </div>
        </section>
      </div>
    </SettingsScaffold>
  )
}
