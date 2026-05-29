export {}

declare global {
  type DesktopUpdateState = {
    availableVersion?: string | null
    configured: boolean
    currentVersion?: string | null
    disabledReason?: string | null
    downloadedVersion?: string | null
    message?: string | null
    status: string
  }

  interface Window {
    electronApp?: {
      clearDesktopAuthToken?: () => Promise<boolean>
      getDesktopAuthToken?: () => Promise<string | null>
      isElectron: boolean
      platform: string
      setDesktopAuthToken?: (token: string) => Promise<boolean>
      showNotification?: (payload: {
        body?: string
        path?: string | null
        silent?: boolean
        title: string
      }) => Promise<boolean>
      writeClipboardText?: (value: string) => Promise<boolean>
      submitDesktopPasswordLogin?: (payload: {
        email: string
        nextPath: string
        password: string
      }) => Promise<{
        error?: string
        ok: boolean
      }>
      submitDesktopPasswordSignup?: (payload: {
        email: string
        firstName: string
        lastName: string
        nextPath: string
        password: string
      }) => Promise<{
        error?: string
        ok: boolean
      }>
      getDesktopAppInfo?: () => Promise<{
        apiBaseUrl?: string | null
        arch?: string | null
        isPackaged: boolean
        platform: string
        version: string
      } | null>
      getUpdateState?: () => Promise<DesktopUpdateState>
      checkForUpdate?: () => Promise<{
        checked: boolean
        error?: string
        reason?: string
        state: DesktopUpdateState
      }>
      downloadUpdate?: () => Promise<{
        accepted: boolean
        completed: boolean
        error?: string
        state?: DesktopUpdateState
      }>
      installUpdate?: () => Promise<{
        accepted: boolean
        completed: boolean
        error?: string
        state?: DesktopUpdateState
      }>
      onUpdateState?: (
        listener: (payload: {
          showToast?: boolean
          source?: string
          state: DesktopUpdateState
        }) => void
      ) => () => void
    }
  }
}
