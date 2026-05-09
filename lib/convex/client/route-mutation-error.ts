"use client"

export class RouteMutationError extends Error {
  status: number
  code: string | null
  retryable: boolean | null
  details: Record<string, unknown> | null

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string | null
      retryable?: boolean | null
      details?: Record<string, unknown> | null
    }
  ) {
    const { code = null, retryable = null, details = null } = options ?? {}

    super(message)
    this.name = "RouteMutationError"
    this.status = status
    this.code = code
    this.retryable = retryable
    this.details = details
  }
}
