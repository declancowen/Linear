"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  type Icon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
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
import { ToastCard, type ToastCardTone } from "@/components/ui/toast-card"

const DESKTOP_UPDATE_TOAST_ID = "desktop-update-status"
const DESKTOP_UPDATE_DIALOG_CLASS =
  "w-[min(28rem,calc(100%-2rem))] max-w-none sm:max-w-none"

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

type DesktopUpdateToastDescriptor = {
  action?: {
    label: string
    onClick: () => void
  }
  description?: string | null
  dismissible: boolean
  duration: number
  icon: Icon
  title: string
  tone: ToastCardTone
}

function getAutomaticDesktopUpdateToastDescriptor(
  state: DesktopUpdateState
): DesktopUpdateToastDescriptor | null {
  switch (state.status) {
    case "available":
      return {
        action: {
          label: "Download update",
          onClick: () => {
            void window.electronApp?.downloadUpdate?.()
          },
        },
        description: state.availableVersion
          ? `Version ${state.availableVersion} is ready to download.`
          : "A new version is ready to download.",
        dismissible: true,
        duration: Infinity,
        icon: DownloadSimpleIcon,
        title: "New desktop update available",
        tone: "accent",
      }
    case "downloading":
      return {
        description: "The update is downloading in the background.",
        dismissible: false,
        duration: Infinity,
        icon: CircleNotchIcon,
        title: "Downloading desktop update",
        tone: "progress",
      }
    case "downloaded":
      return {
        action: {
          label: "Restart to update",
          onClick: () => {
            void window.electronApp?.installUpdate?.()
          },
        },
        description: state.downloadedVersion
          ? `Version ${state.downloadedVersion} is ready to install.`
          : "Restart Recipe Room to install the downloaded update.",
        dismissible: true,
        duration: Infinity,
        icon: ArrowClockwiseIcon,
        title: "Desktop update ready",
        tone: "neutral",
      }
    case "installing":
      return {
        description: "Recipe Room will restart to finish installing.",
        dismissible: false,
        duration: Infinity,
        icon: CircleNotchIcon,
        title: "Installing desktop update",
        tone: "progress",
      }
    default:
      return null
  }
}

function getForcedDesktopUpdateToastDescriptor(
  state: DesktopUpdateState,
  downloadUrl: string
): DesktopUpdateToastDescriptor | null {
  switch (state.status) {
    case "disabled":
      return {
        action: {
          label: "Download latest",
          onClick: () => openDownloadUrl(downloadUrl),
        },
        description:
          state.disabledReason ?? "Automatic updates are unavailable.",
        dismissible: true,
        duration: Infinity,
        icon: WarningCircleIcon,
        title: "Desktop updates unavailable",
        tone: "warning",
      }
    case "error":
      return {
        action: {
          label: "Download latest",
          onClick: () => openDownloadUrl(downloadUrl),
        },
        description:
          state.message ?? "Recipe Room could not check for updates.",
        dismissible: true,
        duration: Infinity,
        icon: WarningCircleIcon,
        title: "Update check failed",
        tone: "error",
      }
    case "idle":
      return {
        description: state.message ?? "Recipe Room is up to date.",
        dismissible: true,
        duration: 4000,
        icon: CheckCircleIcon,
        title: "You're on the latest version",
        tone: "success",
      }
    default:
      return null
  }
}

function getDesktopUpdateToastDescriptor({
  downloadUrl,
  force,
  state,
}: {
  downloadUrl: string
  force: boolean
  state: DesktopUpdateState
}): DesktopUpdateToastDescriptor | null {
  return (
    getAutomaticDesktopUpdateToastDescriptor(state) ??
    (force ? getForcedDesktopUpdateToastDescriptor(state, downloadUrl) : null)
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
  const descriptor = getDesktopUpdateToastDescriptor({
    downloadUrl,
    force,
    state,
  })

  if (!descriptor) {
    if (!force) {
      toast.dismiss(DESKTOP_UPDATE_TOAST_ID)
    }
    return
  }

  const dismiss = () => toast.dismiss(DESKTOP_UPDATE_TOAST_ID)
  const { action } = descriptor

  toast.custom(
    () => (
      <ToastCard
        action={
          action ? (
            <Button size="sm" onClick={() => action.onClick()}>
              {action.label}
            </Button>
          ) : undefined
        }
        closeLabel="Dismiss desktop update"
        description={descriptor.description}
        icon={descriptor.icon}
        onClose={descriptor.dismissible ? dismiss : undefined}
        title={descriptor.title}
        tone={descriptor.tone}
      />
    ),
    { duration: descriptor.duration, id: DESKTOP_UPDATE_TOAST_ID }
  )
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
      <DialogContent
        className={DESKTOP_UPDATE_DIALOG_CLASS}
        showCloseButton={false}
      >
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
        className={DESKTOP_UPDATE_DIALOG_CLASS}
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
