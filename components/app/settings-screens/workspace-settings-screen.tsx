"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  canAdminWorkspace,
  getCurrentWorkspace,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { ImageUploadControl, SettingsScaffold, SummaryCard } from "./shared"
import { uploadSettingsImage } from "./utils"

export function WorkspaceSettingsScreen() {
  const router = useRouter()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const canManageWorkspace = workspace
    ? canAdminWorkspace(data, workspace.id)
    : false
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

  useEffect(() => {
    if (!logoPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    setName(workspace?.name ?? "")
    setLogoUrl(workspace?.logoUrl ?? "")
    setLogoPreviewUrl(
      resolveImageAssetSource(workspace?.logoImageUrl, workspace?.logoUrl) ??
        null
    )
    setLogoImageStorageId(undefined)
    setClearLogoImage(false)
    setAccent(workspace?.settings.accent ?? "emerald")
    setDescription(workspace?.settings.description ?? "")
  }, [workspace?.id])

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
      const response = await fetch("/api/workspace/current", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          logoUrl,
          ...(logoImageStorageId ? { logoImageStorageId } : {}),
          ...(clearLogoImage ? { clearLogoImage: true } : {}),
          accent,
          description,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update workspace")
      }

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
      subtitle=""
      footer={
        <Button
          disabled={!canManageWorkspace || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving..." : "Save workspace"}
        </Button>
      }
    >
      <div className="space-y-6">
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

        <SummaryCard
          description={description || "No description set."}
          eyebrow="Workspace"
          notes={[]}
          preview={
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
              {logoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={workspace.name}
                  className="size-full object-cover"
                  src={logoPreviewUrl}
                />
              ) : (
                <span className="text-base font-semibold text-muted-foreground">
                  {logoUrl}
                </span>
              )}
            </div>
          }
          title={name}
        />

        <ImageUploadControl
          description="Replace the fallback badge anywhere the workspace mark appears."
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
              {logoUrl}
            </span>
          }
          shape="square"
          title="Workspace logo"
          uploading={uploadingLogo}
        />

        <div className="grid grid-cols-[4fr_1fr] gap-4">
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
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="workspace-description">Description</FieldLabel>
          <FieldContent>
            <Textarea
              id="workspace-description"
              className="min-h-24 resize-none"
              disabled={!canManageWorkspace}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FieldContent>
        </Field>
      </div>
    </SettingsScaffold>
  )
}
