type ContentSecurityPolicyOptions = {
  isProduction: boolean
  nonce: string
}

function readEnvString(key: string) {
  const value = process.env[key]

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function buildConnectSrcDirective(isProduction: boolean) {
  const values = ["'self'", "https:", "wss:"]
  const localServiceUrl =
    readEnvString("NEXT_PUBLIC_PARTYKIT_URL") ??
    readEnvString("PARTYKIT_URL") ??
    readEnvString("NEXT_PUBLIC_COLLABORATION_SERVICE_URL") ??
    readEnvString("COLLABORATION_SERVICE_URL")

  if (!isProduction && localServiceUrl) {
    try {
      const parsed = new URL(localServiceUrl)
      const isLoopback =
        /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(parsed.hostname)

      if (isLoopback) {
        values.push(parsed.origin)
        values.push(
          `${parsed.protocol === "https:" ? "wss" : "ws"}://${parsed.host}`
        )
      }
    } catch {
      // Ignore invalid local collaboration URL configuration in CSP generation.
    }
  }

  return `connect-src ${Array.from(new Set(values)).join(" ")}`
}

export function generateCspNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export function buildContentSecurityPolicy({
  isProduction,
  nonce,
}: ContentSecurityPolicyOptions) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(isProduction ? [] : ["'unsafe-eval'"]),
  ].join(" ")

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data: blob:",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    buildConnectSrcDirective(isProduction),
    "worker-src 'self' blob:",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}
