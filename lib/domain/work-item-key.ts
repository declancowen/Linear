const WORK_ITEM_KEY_PATTERN = /^(.+)-(\d+)$/

function formatWorkItemKeyNumber(value: number) {
  return String(value).padStart(3, "0")
}

export function formatWorkItemKey(prefix: string, value: number) {
  return `${prefix}-${formatWorkItemKeyNumber(value)}`
}

export function normalizeWorkItemKeyNumberPadding(key: string) {
  const match = WORK_ITEM_KEY_PATTERN.exec(key)

  if (!match) {
    return key
  }

  const [, prefix, number] = match

  if (!prefix || !number || number.length >= 3) {
    return key
  }

  return `${prefix}-${number.padStart(3, "0")}`
}
