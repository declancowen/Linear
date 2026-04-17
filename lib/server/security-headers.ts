type ContentSecurityPolicyOptions = {
  isProduction: boolean
  nonce: string
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
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}
