export {}

declare global {
  interface Window {
    electronApp?: {
      isElectron: boolean
      platform: string
      versions: {
        chrome: string
        electron: string
        node: string
      }
    }
  }
}
