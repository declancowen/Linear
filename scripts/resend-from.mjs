export function normalizeResendFrom(from) {
  const trimmedFrom = from.trim()

  if (trimmedFrom.includes("<") && trimmedFrom.includes(">")) {
    return trimmedFrom
  }

  return `${trimmedFrom} <${trimmedFrom}>`
}
