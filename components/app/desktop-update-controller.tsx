"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle, DownloadSimple, Warning } from "@phosphor-icons/react"
import { toast } from "sonner"

import { buildPublicApiUrl } from "@/lib/api/public-url"
import {
  DEFAULT_DESKTOP_MAC_DOWNLOAD_URL,
  getDesktopDownloadUrl,
  type DesktopDownloadArchitecture,
  type DesktopDownloadTarget,
  type DesktopDownloadUrlMap,
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
  arch?: string | null
  isPackaged: boolean
  platform: string
  version: string
}

type DesktopUpdatePolicy = {
  latestDownloadUrl?: string | null
  latestDownloadUrls?: Partial<DesktopDownloadUrlMap> | null
  minSupportedVersion?: string | null
  unsupportedMessage?: string | null
}

function normalizeDesktopAppArchitecture(
  arch: string | null | undefined
): DesktopDownloadArchitecture | null {
  const normalized = arch?.trim().toLowerCase()

  if (normalized === "arm64" || normalized === "aarch64") {
    return "arm64"
  }

  if (
    normalized === "x64" ||
    normalized === "x86_64" ||
    normalized === "amd64"
  ) {
    return "x64"
  }

  if (normalized === "ia32" || normalized === "x86") {
    return "ia32"
  }

  return null
}

function getDesktopDownloadTargetForAppInfo(
  appInfo: DesktopAppInfo | null
): DesktopDownloadTarget | null {
  const architecture = normalizeDesktopAppArchitecture(appInfo?.arch)

  if (appInfo?.platform === "win32") {
    return {
      architecture: architecture ?? "x64",
      platform: "windows",
    }
  }

  if (appInfo?.platform === "darwin") {
    return {
      architecture: architecture === "ia32" ? "x64" : (architecture ?? "arm64"),
      platform: "mac",
    }
  }

  return null
}

function getDesktopFallbackDownloadUrl({
  appInfo,
  policy,
}: {
  appInfo: DesktopAppInfo | null
  policy?: DesktopUpdatePolicy | null
}) {
  const target = getDesktopDownloadTargetForAppInfo(appInfo)

  if (target && policy?.latestDownloadUrls) {
    const configuredTargetUrl =
      policy.latestDownloadUrls[target.platform]?.[target.architecture]?.trim()

    if (configuredTargetUrl) {
      return configuredTargetUrl
    }
  }

  return (
    policy?.latestDownloadUrl?.trim() ||
    (target ? getDesktopDownloadUrl(null, target) : null) ||
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
    <div className="flex w-fit max-w-[calc(100vw-2rem)] gap-3 rounded-lg border border-line/60 bg-background/95 p-3 text-foreground shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl">
      <Icon className="text-brand mt-0.5 size-4 shrink-0" weight="fill" />
      <div className="max-w-[min(34rem,calc(100vw-5rem))] min-w-0">
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
    toast.custom(
      () => (
        <DesktopUpdateToastContent
          description={state.message ?? "Recipe Room is up to date."}
          icon="success"
          onDismiss={dismiss}
          title="You're on the latest version"
        />
      ),
      { duration: 4000, id: DESKTOP_UPDATE_TOAST_ID }
    )
    return
  }

  if (!force) {
    toast.dismiss(DESKTOP_UPDATE_TOAST_ID)
  }
}

type DesktopUpdateFeedbackAction = "download" | "downloadLatest" | "install"

function getDesktopUpdateFeedbackCopy(state: DesktopUpdateState): {
  action?: DesktopUpdateFeedbackAction
  actionLabel?: string
  description: string
  title: string
} {
  if (state.status === "available") {
    return {
      action: "download",
      actionLabel: "Download Update",
      description: state.availableVersion
        ? `Version ${state.availableVersion} is ready to download.`
        : "A new version is ready to download.",
      title: "A new update is available",
    }
  }

  if (state.status === "downloaded") {
    return {
      action: "install",
      actionLabel: "Restart to Update",
      description: state.downloadedVersion
        ? `Version ${state.downloadedVersion} is ready to install.`
        : "Restart Recipe Room to install the downloaded update.",
      title: "Restart to update Recipe Room",
    }
  }

  if (state.status === "downloading") {
    return {
      description: "The update is downloading in the background.",
      title: "Downloading update",
    }
  }

  if (state.status === "installing") {
    return {
      description: "Recipe Room will restart to finish installing.",
      title: "Installing update",
    }
  }

  if (state.status === "disabled") {
    return {
      action: "downloadLatest",
      actionLabel: "Download latest",
      description: state.disabledReason ?? "Automatic updates are unavailable.",
      title: "Desktop updates unavailable",
    }
  }

  if (state.status === "error") {
    return {
      action: "downloadLatest",
      actionLabel: "Download latest",
      description: state.message ?? "Recipe Room could not check for updates.",
      title: "Update check failed",
    }
  }

  if (state.status === "checking") {
    return {
      description: "Recipe Room is checking for updates.",
      title: "Checking for updates",
    }
  }

  return {
    description: state.message ?? "Recipe Room is up to date.",
    title: "You're on the latest version",
  }
}

function DesktopUpdateFeedbackDialog({
  downloadUrl,
  onClose,
  state,
}: {
  downloadUrl: string
  onClose: () => void
  state: DesktopUpdateState
}) {
  const copy = getDesktopUpdateFeedbackCopy(state)

  function handleAction() {
    if (copy.action === "download") {
      void window.electronApp?.downloadUpdate?.()
      onClose()
      return
    }

    if (copy.action === "install") {
      void window.electronApp?.installUpdate?.()
      onClose()
      return
    }

    if (copy.action === "downloadLatest") {
      openDownloadUrl(downloadUrl)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="w-fit max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {copy.action && copy.actionLabel ? (
            <Button onClick={handleAction}>{copy.actionLabel}</Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DesktopUpdateController() {
  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null)
  const [feedbackState, setFeedbackState] = useState<DesktopUpdateState | null>(
    null
  )
  const [policy, setPolicy] = useState<DesktopUpdatePolicy | null>(null)
  const [unsupportedPolicy, setUnsupportedPolicy] =
    useState<DesktopUpdatePolicy | null>(null)
  const appInfoRef = useRef<DesktopAppInfo | null>(null)
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
      appInfoRef.current = nextAppInfo

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
          downloadUrl: getDesktopFallbackDownloadUrl({
            appInfo: nextAppInfo,
            policy: nextPolicy,
          }),
          force: false,
          state: updateState,
        })
      }
    }

    void loadInitialState()

    const unsubscribe = electronApp?.onUpdateState?.((payload) => {
      if (payload.showToast === true) {
        toast.dismiss(DESKTOP_UPDATE_TOAST_ID)
        setFeedbackState(payload.state)
        return
      }

      showDesktopUpdateToast({
        downloadUrl: getDesktopFallbackDownloadUrl({
          appInfo: appInfoRef.current,
          policy: policyRef.current,
        }),
        force: false,
        state: payload.state,
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  if (!unsupportedPolicy) {
    return feedbackState ? (
      <DesktopUpdateFeedbackDialog
        downloadUrl={getDesktopFallbackDownloadUrl({ appInfo, policy })}
        onClose={() => setFeedbackState(null)}
        state={feedbackState}
      />
    ) : null
  }

  const downloadUrl = getDesktopFallbackDownloadUrl({ appInfo, policy })
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
