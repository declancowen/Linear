"use client"

import { ArrowRight, X } from "@phosphor-icons/react"
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react"
import { toast } from "sonner"

import {
  getTextInputLimitState,
  workspaceDescriptionConstraints,
  workspaceSetupNameConstraints,
} from "@/lib/domain/input-constraints"
import { getDisplayInitials } from "@/lib/display-initials"
import {
  IMAGE_UPLOAD_MAX_SIZE,
  uploadSettingsImageStorage,
} from "@/components/app/settings-screens/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  syncCreateWorkspace,
  syncUpdateWorkspaceBranding,
} from "@/lib/convex/client"

const DEFAULT_AVATAR_SIZE = 56
const DEFAULT_WORKSPACE_NAME = "Product Development"
const DEFAULT_WORKSPACE_DESCRIPTION =
  "Roadmaps, priorities, and release planning for the core product team."

function getLogoUploadFailureMessage(error: unknown) {
  return error instanceof Error
    ? `${error.message}. You can retry from workspace settings.`
    : "Workspace created, but the logo upload failed."
}

async function uploadOnboardingWorkspaceLogo(input: {
  description: string
  logoFile: File
  name: string
}) {
  const logoImageStorageId = await uploadSettingsImageStorage(
    "workspace-logo",
    input.logoFile,
    {
      prepare: "Failed to prepare the logo upload",
      upload: "Logo upload failed",
    }
  )

  await syncUpdateWorkspaceBranding(
    "",
    input.name,
    getDisplayInitials(input.name, "PD"),
    "emerald",
    input.description,
    {
      logoImageStorageId,
    }
  )
}

function getWorkspaceLogoFileError(file: File) {
  if (!file.type.startsWith("image/")) {
    return "Choose an image file"
  }

  if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
    return "Images must be 10 MB or smaller"
  }

  return null
}

function getNormalizedWorkspaceFormValues(input: {
  description: string
  name: string
}) {
  const normalizedName = input.name.trim()
  const normalizedDescription = input.description.trim()

  if (!normalizedName || !normalizedDescription) {
    return null
  }

  return {
    description: normalizedDescription,
    name: normalizedName,
  }
}

async function createWorkspaceWithOptionalLogo(input: {
  description: string
  logoFile: File | null
  name: string
}) {
  await syncCreateWorkspace({
    name: input.name,
    description: input.description,
  })

  if (!input.logoFile) {
    return
  }

  try {
    await uploadOnboardingWorkspaceLogo({
      description: input.description,
      logoFile: input.logoFile,
      name: input.name,
    })
  } catch (error) {
    toast.error(getLogoUploadFailureMessage(error))
  }
}

function useBlobPreviewUrlCleanup(previewUrl: string | null) {
  useEffect(() => {
    if (!previewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
}

function useWorkspaceAvatarSize(nameFieldRef: RefObject<HTMLDivElement | null>) {
  const [avatarSize, setAvatarSize] = useState(DEFAULT_AVATAR_SIZE)

  useEffect(() => {
    const field = nameFieldRef.current

    if (!field) {
      return
    }

    const updateAvatarSize = () => {
      setAvatarSize(
        Math.max(
          DEFAULT_AVATAR_SIZE,
          Math.round(field.getBoundingClientRect().height)
        )
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
  }, [nameFieldRef])

  return avatarSize
}

async function submitOnboardingWorkspace(input: {
  description: string
  logoFile: File | null
  name: string
}) {
  const normalizedValues = getNormalizedWorkspaceFormValues({
    description: input.description,
    name: input.name,
  })

  if (!normalizedValues) {
    toast.error("Enter a workspace name and description")
    return
  }

  await createWorkspaceWithOptionalLogo({
    ...normalizedValues,
    logoFile: input.logoFile,
  })
  toast.success("Workspace created")
  window.location.replace("/workspace/projects")
}

function WorkspaceLogoPicker({
  avatarSize,
  fileInputRef,
  logoPreviewUrl,
  name,
  onLogoFileChange,
}: {
  avatarSize: number
  fileInputRef: RefObject<HTMLInputElement | null>
  logoPreviewUrl: string | null
  name: string
  onLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={onLogoFileChange}
      />

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
            {getDisplayInitials(name, "PD")}
          </span>
        )}
      </button>
    </>
  )
}

export function OnboardingWorkspaceForm() {
  const [name, setName] = useState(DEFAULT_WORKSPACE_NAME)
  const [description, setDescription] = useState(DEFAULT_WORKSPACE_DESCRIPTION)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const nameFieldRef = useRef<HTMLDivElement | null>(null)
  const avatarSize = useWorkspaceAvatarSize(nameFieldRef)
  const nameLimitState = getTextInputLimitState(name, workspaceSetupNameConstraints)
  const descriptionLimitState = getTextInputLimitState(
    description,
    workspaceDescriptionConstraints
  )
  const canSubmit = nameLimitState.canSubmit && descriptionLimitState.canSubmit

  useBlobPreviewUrlCleanup(logoPreviewUrl)

  async function handleCreateWorkspace() {
    if (!canSubmit) {
      return
    }

    setSubmitting(true)

    try {
      await submitOnboardingWorkspace({
        description,
        logoFile,
        name,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace"
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      return
    }

    const validationMessage = getWorkspaceLogoFileError(file)
    if (validationMessage) {
      toast.error(validationMessage)
      event.target.value = ""
      return
    }

    if (logoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreviewUrl)
    }

    setLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
    event.target.value = ""
  }

  return (
    <section className="space-y-6">
      <FieldGroup className="gap-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-4">
          <WorkspaceLogoPicker
            avatarSize={avatarSize}
            fileInputRef={fileInputRef}
            logoPreviewUrl={logoPreviewUrl}
            name={name}
            onLogoFileChange={handleLogoFileChange}
          />

          <div ref={nameFieldRef} className="min-w-0 flex-1">
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <FieldContent>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={DEFAULT_WORKSPACE_NAME}
                  maxLength={workspaceSetupNameConstraints.max}
                />
                <FieldCharacterLimit
                  state={nameLimitState}
                  limit={workspaceSetupNameConstraints.max}
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
              maxLength={workspaceDescriptionConstraints.max}
              className="min-h-24 resize-none"
              placeholder={DEFAULT_WORKSPACE_DESCRIPTION}
            />
            <FieldCharacterLimit
              state={descriptionLimitState}
              limit={workspaceDescriptionConstraints.max}
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
            disabled={submitting || !canSubmit}
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
