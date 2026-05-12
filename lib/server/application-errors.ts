type ApplicationErrorDetails = Record<string, unknown>

type ApplicationErrorOptions = {
  code: string
  retryable?: boolean | null
  details?: ApplicationErrorDetails | null
}

type ApplicationErrorMatch = string | RegExp | ((message: string) => boolean)

export type ApplicationErrorMapping = {
  match: ApplicationErrorMatch
  code: string
  status: number
  message?: string
  retryable?: boolean | null
  details?: ApplicationErrorDetails | null
}

export class ApplicationError extends Error {
  status: number
  code: string
  retryable: boolean | null
  details: ApplicationErrorDetails | null

  constructor(
    message: string,
    status: number,
    options: ApplicationErrorOptions
  ) {
    super(message)
    this.name = "ApplicationError"
    this.status = status
    this.code = options.code
    this.retryable = options.retryable ?? null
    this.details = options.details ?? null
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError
}

export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error
  }

  return null
}

function getErrorCause(error: unknown) {
  if (typeof error === "object" && error !== null && "cause" in error) {
    return error.cause
  }

  return null
}

function normalizeErrorMessageVariants(message: string) {
  const variants = new Set<string>()
  const trimmedMessage = message.trim()

  if (trimmedMessage.length === 0) {
    return variants
  }

  const candidates = [
    trimmedMessage,
    ...trimmedMessage
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  ]

  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue
    }

    variants.add(candidate)

    const withoutRequestPrefix = candidate
      .replace(/^\[Request ID:[^\]]+\]\s*Server Error\s*/i, "")
      .trim()

    if (withoutRequestPrefix.length > 0) {
      variants.add(withoutRequestPrefix)
      variants.add(
        withoutRequestPrefix.replace(/^Uncaught Error:\s*/i, "").trim()
      )
      variants.add(withoutRequestPrefix.replace(/^Error:\s*/i, "").trim())
    }
  }

  return variants
}

function collectErrorMessages(
  error: unknown,
  depth = 0,
  messages = new Set<string>()
) {
  if (depth >= 4) {
    return messages
  }

  const message = getUnknownErrorMessage(error)

  if (message) {
    for (const variant of normalizeErrorMessageVariants(message)) {
      messages.add(variant)
    }
  }

  const cause = getErrorCause(error)

  if (cause) {
    collectErrorMessages(cause, depth + 1, messages)
  }

  return messages
}

function matchesApplicationErrorMessage(
  message: string,
  match: ApplicationErrorMatch
) {
  if (typeof match === "string") {
    return message === match
  }

  if (match instanceof RegExp) {
    return match.test(message)
  }

  return match(message)
}

export function coerceApplicationError(
  error: unknown,
  mappings: ApplicationErrorMapping[]
) {
  if (isApplicationError(error)) {
    return error
  }

  const candidateMessages = [...collectErrorMessages(error)]

  if (candidateMessages.length === 0) {
    return null
  }

  const matchedCandidate = candidateMessages.find((message) =>
    mappings.some((entry) =>
      matchesApplicationErrorMessage(message, entry.match)
    )
  )

  if (!matchedCandidate) {
    return null
  }

  const mapping = mappings.find((entry) =>
    matchesApplicationErrorMessage(matchedCandidate, entry.match)
  )

  if (!mapping) {
    return null
  }

  return new ApplicationError(
    mapping.message ?? matchedCandidate,
    mapping.status,
    {
      code: mapping.code,
      retryable: mapping.retryable ?? null,
      details: mapping.details ?? null,
    }
  )
}
