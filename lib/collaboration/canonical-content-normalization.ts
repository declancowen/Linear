const ALLOWED_TEXT_ALIGN_VALUES = new Set([
  "left",
  "center",
  "right",
  "justify",
])
const LENGTH_STYLE_VALUE = /^\d+(\.\d+)?(px|%)$/
const LENGTH_STYLE_TAGS = new Set(["col", "td", "th"])
const LENGTH_STYLE_PROPERTIES = new Set(["width", "min-width"])
const TEXT_ALIGN_STYLE_TAGS = new Set(["p", "h1", "h2", "h3", "td", "th"])

function normalizeLengthStyleValue(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return LENGTH_STYLE_VALUE.test(normalizedValue) ? normalizedValue : null
}

function normalizeTextAlignValue(value: string | null) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return ALLOWED_TEXT_ALIGN_VALUES.has(normalizedValue) ? normalizedValue : null
}

export function normalizeCanonicalUrl(
  value: string | null,
  allowedSchemes: ReadonlySet<string>
) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim()

  if (normalizedValue.length === 0) {
    return null
  }

  const schemeMatch = normalizedValue.match(/^([a-z][a-z0-9+.-]*):/i)

  if (!schemeMatch) {
    return null
  }

  const scheme = schemeMatch[1]?.toLowerCase()

  if (!scheme || !allowedSchemes.has(scheme)) {
    return null
  }

  return normalizedValue
}

export function getNormalizedStyleValue(input: {
  propertyName: string
  propertyValue: string
  tagName: string
}) {
  if (
    LENGTH_STYLE_TAGS.has(input.tagName) &&
    LENGTH_STYLE_PROPERTIES.has(input.propertyName)
  ) {
    return normalizeLengthStyleValue(input.propertyValue)
  }

  if (
    TEXT_ALIGN_STYLE_TAGS.has(input.tagName) &&
    input.propertyName === "text-align"
  ) {
    return normalizeTextAlignValue(input.propertyValue)
  }

  return null
}
