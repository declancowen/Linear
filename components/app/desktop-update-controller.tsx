"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle, DownloadSimple, Warning } from "@phosphor-icons/react"
import { toast } from "sonner"

import { buildPublicApiUrl } from "@/lib/api/public-url"
import {
  DEFAULT_DESKTOP_MAC_DOWNLOAD_URL,
  isDesktopVersionUnsupported,
} from "@/lib/desktop/update-policy"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DESKTOP_UPDATE_TOAST_ID = "desktop-update-status"

type DesktopAppInfo = {
  apiBaseUrl?: string | null
  isPackaged: boolean
  platform: string
  version: string
}

type DesktopUpdatePolicy = {
  latestDownloadUrl?: string | null
  minSupportedVersion?: string | null
  unsupportedMessage?: string | null
}

function getDesktopMacDownloadUrl(policy?: DesktopUpdatePolicy | null) {
  return (
    policy?.latestDownloadUrl?.trim() ||
    process.env.NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL ||
    DEFAULT_DESKTOP_MAC_DOWNLOAD_URL
  )
}

function isDesktopRuntimeAvailable() {
  return (
    typeof window !== "undefined" &&
    window.electronApp?.isElectron === true &&
    typeof window.electronApp.getUpdateState === "function"
  )
}

async function fetchDesktopUpdatePolicy(apiBaseUrl?: string | null) {
  const updatePolicyPath = "/api/desktop/update-policy"
  const trimmedApiBaseUrl = apiBaseUrl?.trim()
  const updatePolicyUrl = trimmedApiBaseUrl
    ? buildPublicApiUrl(updatePolicyPath, { baseUrl: trimmedApiBaseUrl })
    : buildPublicApiUrl(updatePolicyPath)

  const response = await fetch(updatePolicyUrl, {
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as DesktopUpdatePolicy
}

async function readDesktopAppInfo(
  electronApp: Window["electronApp"]
): Promise<DesktopAppInfo | null> {
  return (await electronApp?.getDesktopAppInfo?.().catch(() => null)) ?? null
}

async function readDesktopUpdateState(
  electronApp: Window["electronApp"]
): Promise<DesktopUpdateState | null> {
  return (await electronApp?.getUpdateState?.().catch(() => null)) ?? null
}

function shouldBlockForUnsupportedPolicy({
  appInfo,
  policy,
}: {
  appInfo: DesktopAppInfo | null
  policy: DesktopUpdatePolicy | null
}) {
  if (!policy?.minSupportedVersion) {
    return false
  }

  if (!appInfo) {
    return true
  }

  return isDesktopVersionUnsupported({
    currentVersion: appInfo.version,
    minSupportedVersion: policy.minSupportedVersion,
  })
}

function openDownloadUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

function DesktopUpdateToastContent({
  actionLabel,
  description,
  icon,
  onAction,
  onDismiss,
  title,
}: {
  actionLabel?: string
  description?: string | null
  icon: "download" | "success" | "warning"
  onAction?: () => void
  onDismiss?: () => void
  title: string
}) {
  const Icon =
    icon === "success"
      ? CheckCircle
      : icon === "download"
        ? DownloadSimple
        : Warning

  return (
    <div className="flex w-[320px] gap-3 rounded-lg border border-line/60 bg-background/95 p-3 text-foreground shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl">
      <Icon className="text-brand mt-0.5 size-4 shrink-0" weight="fill" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-5 font-medium">{title}</div>
        {description ? (
          <div className="mt-0.5 text-[12px] leading-4 text-fg-3">
            {description}
          </div>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          {onDismiss ? (
            <Button size="xs" variant="outline" onClick={onDismiss}>
              Close
            </Button>
          ) : null}
          {actionLabel && onAction ? (
            <Button size="xs" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function showDesktopUpdateToast({
  downloadUrl,
  force,
  state,
}: {
  downloadUrl: string
  force: boolean
  state: DesktopUpdateState
}) {
  const dismiss = () => toast.dismiss(DESKTOP_UPDATE_TOAST_ID)

  if (state.status === "available") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          actionLabel="Download"
          description={
            state.availableVersion
              ? `Version ${state.availableVersion} is ready to download.`
              : "A new version is ready to download."
          }
          icon="download"
          onAction={() => {
            void window.electronApp?.downloadUpdate?.()
          }}
          onDismiss={dismiss}
          title="New desktop update available"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (state.status === "downloading") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          description="The update is downloading in the background."
          icon="download"
          title="Downloading desktop update"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (state.status === "downloaded") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          actionLabel="Restart"
          description={
            state.downloadedVersion
              ? `Version ${state.downloadedVersion} is ready to install.`
              : "Restart Recipe Room to install the downloaded update."
          }
          icon="success"
          onAction={() => {
            void window.electronApp?.installUpdate?.()
          }}
          onDismiss={dismiss}
          title="Desktop update ready"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (state.status === "installing") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          description="Recipe Room will restart to finish installing."
          icon="success"
          title="Installing desktop update"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (force && state.status === "disabled") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          actionLabel="Download latest"
          description={
            state.disabledReason ?? "Automatic updates are unavailable."
          }
          icon="warning"
          onAction={() => openDownloadUrl(downloadUrl)}
          onDismiss={dismiss}
          title="Desktop updates unavailable"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (force && state.status === "error") {
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          actionLabel="Download latest"
          description={
            state.message ?? "Recipe Room could not check for updates."
          }
          icon="warning"
          onAction={() => openDownloadUrl(downloadUrl)}
          onDismiss={dismiss}
          title="Update check failed"
        />
      ),
      { duration: Infinity, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (force && state.status === "idle") {
    toast.success("Recipe Room is up to date", {
      duration: 4000,
      id: DESKTOP_UPDATE_TOAST_ID,
    })
    return
  }

  if (!force) {
    toast.dismiss(DESKTOP_UPDATE_TOAST_ID)
  }
}

export function DesktopUpdateController() {
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null)
  const [policy, setPolicy] = useState<DesktopUpdatePolicy | null>(null)
  const [unsupportedPolicy, setUnsupportedPolicy] =
    useState<DesktopUpdatePolicy | null>(null)
  const policyRef = useRef<DesktopUpdatePolicy | null>(null)

  useEffect(() => {
    if (!isDesktopRuntimeAvailable()) {
      return
    }

    let cancelled = false
    const electronApp = window.electronApp

    async function loadInitialState() {
      const [nextAppInfo, updateState] = await Promise.all([
        readDesktopAppInfo(electronApp),
        readDesktopUpdateState(electronApp),
      ])

      if (cancelled) {
        return
      }

      setAppInfo(nextAppInfo)

      const nextPolicy = await fetchDesktopUpdatePolicy(
        nextAppInfo?.apiBaseUrl
      ).catch(() => null)

      if (cancelled) {
        return
      }

      policyRef.current = nextPolicy
      setPolicy(nextPolicy)

      if (
        shouldBlockForUnsupportedPolicy({
          appInfo: nextAppInfo,
          policy: nextPolicy,
        })
      ) {
        setUnsupportedPolicy(nextPolicy)
      }

      if (updateState) {
        showDesktopUpdateToast({
          downloadUrl: getDesktopMacDownloadUrl(nextPolicy),
          force: false,
          state: updateState,
        })
      }
    }

    void loadInitialState()

    const unsubscribe = electronApp?.onUpdateState?.((payload) => {
      showDesktopUpdateToast({
        downloadUrl: getDesktopMacDownloadUrl(policyRef.current),
        force: payload.showToast === true,
        state: payload.state,
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  if (!unsupportedPolicy) {
    return null
  }

  const downloadUrl = getDesktopMacDownloadUrl(policy)
  const minSupportedVersion = unsupportedPolicy.minSupportedVersion

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Update Recipe Room to continue</DialogTitle>
          <DialogDescription>
            {unsupportedPolicy.unsupportedMessage}{" "}
            {appInfo
              ? `You are running version ${appInfo.version}`
              : "Recipe Room could not verify this desktop app version"}
            {minSupportedVersion
              ? ` and version ${minSupportedVersion} or newer is required.`
              : "."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void window.electronApp?.checkForUpdate?.()
            }}
          >
            Check for updates
          </Button>
          <Button asChild>
            <a href={downloadUrl} rel="noreferrer" target="_blank">
              Download latest
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
