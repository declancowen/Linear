function formatDisplayName(name) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return ""
  }

  const escapedName = trimmedName
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')

  if (/[",<>]/.test(trimmedName)) {
    return `"${escapedName}"`
  }

  return trimmedName
}

export function normalizeResendFrom(fromEmail, fromName) {
  const trimmedFromEmail = fromEmail.trim()

  if (trimmedFromEmail.includes("<") && trimmedFromEmail.includes(">")) {
    return trimmedFromEmail
  }

  const trimmedFromName =
    typeof fromName === "string" ? formatDisplayName(fromName) : ""

  if (!trimmedFromName) {
    return trimmedFromEmail
  }

  return `${trimmedFromName} <${trimmedFromEmail}>`
}
