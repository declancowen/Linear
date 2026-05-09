function getMockWorkOSRawData(error: unknown) {
  return "rawData" in Object(error) &&
    typeof Object(error).rawData === "object" &&
    Object(error).rawData !== null
    ? Object(error).rawData
    : null
}

function getStringField(source: object | null, key: string) {
  const value = source ? (source as Record<string, unknown>)[key] : null

  return typeof value === "string"
    ? value
    : null
}

export function getMockWorkOSAuthErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const rawData = getMockWorkOSRawData(error)

  return getStringField(rawData, "error") ?? getStringField(error, "error")
}

export function getMockWorkOSAuthErrorMessage(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const rawData = getMockWorkOSRawData(error)

  return getStringField(rawData, "message") ?? getStringField(error, "message")
}

export function getMockWorkOSPendingAuthentication(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const rawData = getMockWorkOSRawData(error)
  const pendingAuthenticationToken =
    getStringField(rawData, "pending_authentication_token") ??
    getStringField(error, "pendingAuthenticationToken")

  if (!pendingAuthenticationToken) {
    return null
  }

  return {
    email: getStringField(rawData, "email"),
    pendingAuthenticationToken,
  }
}
