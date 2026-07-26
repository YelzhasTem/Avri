import type { AIErrorCode, AIErrorPayload } from './types'

export class AIServiceError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }

  toPayload(): AIErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    }
  }
}

export function toAIErrorPayload(error: unknown): AIErrorPayload {
  if (error instanceof AIServiceError) {
    return error.toPayload()
  }

  return {
    code: 'api_error',
    message: 'Something went wrong while contacting Gemini. Please try again.',
    retryable: true,
  }
}

