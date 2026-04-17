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

export function isApplicationError(
  error: unknown
): error is ApplicationError {
  return error instanceof ApplicationError
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error
  }

  return null
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

  const message = getErrorMessage(error)

  if (!message) {
    return null
  }

  const mapping = mappings.find((entry) =>
    matchesApplicationErrorMessage(message, entry.match)
  )

  if (!mapping) {
    return null
  }

  return new ApplicationError(mapping.message ?? message, mapping.status, {
    code: mapping.code,
    retryable: mapping.retryable ?? null,
    details: mapping.details ?? null,
  })
}
