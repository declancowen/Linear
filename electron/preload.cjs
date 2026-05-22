/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronApp", {
  clearDesktopAuthToken: () => ipcRenderer.invoke("desktop-auth:clear-token"),
  getDesktopAuthToken: () => ipcRenderer.invoke("desktop-auth:get-token"),
  isElectron: true,
  platform: process.platform,
  setDesktopAuthToken: (token) =>
    ipcRenderer.invoke("desktop-auth:set-token", token),
  showNotification: (payload) =>
    ipcRenderer.invoke("desktop-notifications:show", payload),
  writeClipboardText: (value) =>
    ipcRenderer.invoke("desktop-clipboard:write-text", value),
  submitDesktopPasswordLogin: (payload) =>
    ipcRenderer.invoke("desktop-auth:submit-password-login", payload),
  submitDesktopPasswordSignup: (payload) =>
    ipcRenderer.invoke("desktop-auth:submit-password-signup", payload),
  getDesktopAppInfo: () => ipcRenderer.invoke("desktop-updates:get-app-info"),
  getUpdateState: () => ipcRenderer.invoke("desktop-updates:get-state"),
  checkForUpdate: () => ipcRenderer.invoke("desktop-updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("desktop-updates:download"),
  installUpdate: () => ipcRenderer.invoke("desktop-updates:install"),
  onUpdateState: (listener) => {
    const wrappedListener = (_event, payload) => listener(payload)
    ipcRenderer.on("desktop-updates:state", wrappedListener)

    return () => {
      ipcRenderer.removeListener("desktop-updates:state", wrappedListener)
    }
  },
})
