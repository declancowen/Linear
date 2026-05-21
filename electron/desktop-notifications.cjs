const MAX_NOTIFICATION_TITLE_LENGTH = 120
const MAX_NOTIFICATION_BODY_LENGTH = 500

function normalizeString(value, maxLength) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null
}

function normalizeNotificationPath(value) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null
  }

  return trimmed
}

function normalizeDesktopNotificationPayload(value) {
  if (!value || typeof value !== "object") {
    return null
  }

  const title = normalizeString(value.title, MAX_NOTIFICATION_TITLE_LENGTH)

  if (!title) {
    return null
  }

  return {
    title,
    body: normalizeString(value.body, MAX_NOTIFICATION_BODY_LENGTH) ?? "",
    path: normalizeNotificationPath(value.path),
  }
}

function isNotificationSupported(NativeNotification) {
  try {
    return NativeNotification?.isSupported?.() === true
  } catch {
    return false
  }
}

function createDesktopNotificationBridge({
  createWindow,
  focusWindow,
  getMainWindow,
  getRendererOrigin,
  NativeNotification,
}) {
  async function openNotificationPath(targetPath) {
    const rendererOrigin = getRendererOrigin()

    if (!rendererOrigin) {
      return
    }

    const window = getMainWindow() ?? (await createWindow())

    if (!window || window.isDestroyed?.()) {
      return
    }

    await window.loadURL(new URL(targetPath, rendererOrigin).toString())
    focusWindow(window)
  }

  return {
    show(input) {
      const payload = normalizeDesktopNotificationPayload(input)

      if (!payload || !isNotificationSupported(NativeNotification)) {
        return false
      }

      const notification = new NativeNotification({
        title: payload.title,
        body: payload.body,
      })

      if (payload.path) {
        notification.on("click", () => {
          void openNotificationPath(payload.path)
        })
      }

      notification.show()

      return true
    },
  }
}

module.exports = {
  createDesktopNotificationBridge,
  normalizeDesktopNotificationPayload,
  normalizeNotificationPath,
}
