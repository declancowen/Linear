import { contextBridge } from "electron"

contextBridge.exposeInMainWorld("electronApp", {
  isElectron: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
})
