// this is moved from the @bnk/router package, maybe I should extend it or something?
// but this issue is I want to use this on both the server and the client but I don't want to have to
// install @bnk/router on the client
export class ApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown

  constructor(status = 500, message: string, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details

    // Maintain proper stack trace (for V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }
}

// ParseError is defined in domain-error.ts
