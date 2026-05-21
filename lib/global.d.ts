export {}

declare global {
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
        title: string
      }) => Promise<boolean>
      submitDesktopPasswordLogin?: (payload: {
        email: string
        nextPath: string
        password: string
      }) => Promise<{
        error?: string
        ok: boolean
      }>
    }
  }
}
