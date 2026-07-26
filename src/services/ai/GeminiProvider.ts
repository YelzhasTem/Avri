import { ApiError, GoogleGenAI, type Content } from '@google/genai'
import type { AIProvider } from './AIProvider'
import { AIServiceError } from './errors'
import type {
  AIStructuredRequest,
  AIProviderStreamRequest,
  ChatMessage,
} from './types'

const GENERATION_TIMEOUT_MS = 90_000
const CONNECTION_TEST_TIMEOUT_MS = 60_000
const STRUCTURED_RESPONSE_TIMEOUT_MS = 30_000

function redactSensitiveText(value: string, apiKey: string): string {
  let redacted = value

  if (apiKey) {
    redacted = redacted.split(apiKey).join('[REDACTED]')
  }

  return redacted
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/AIza[\w-]{20,}/g, '[REDACTED]')
}

function logGeminiSdkError(
  context: string,
  error: unknown,
  apiKey: string,
  timedOut: boolean,
  elapsedMs: number,
): void {
  const cause =
    error instanceof Error && 'cause' in error ? error.cause : undefined

  console.error(`[Avri AI] ${context}`, {
    name: error instanceof Error ? error.name : typeof error,
    status: error instanceof ApiError ? error.status : undefined,
    message:
      error instanceof Error
        ? redactSensitiveText(error.message, apiKey)
        : redactSensitiveText(String(error), apiKey),
    stack:
      error instanceof Error && error.stack
        ? redactSensitiveText(error.stack, apiKey)
        : undefined,
    causeName: cause instanceof Error ? cause.name : undefined,
    causeMessage:
      cause instanceof Error
        ? redactSensitiveText(cause.message, apiKey)
        : undefined,
    timedOut,
    elapsedMs,
  })
}

function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages
    .filter((message) => message.role !== 'system' && message.content.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

function getSystemInstruction(messages: ChatMessage[]): string | undefined {
  const instruction = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')

  return instruction || undefined
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function classifyGeminiError(error: unknown, timedOut: boolean): AIServiceError {
  if (timedOut) {
    return new AIServiceError(
      'timeout',
      'Avri took too long to respond. Please try again.',
      true,
    )
  }

  if (isAbortError(error)) {
    return new AIServiceError('cancelled', 'Generation stopped.', false)
  }

  if (error instanceof ApiError) {
    const message = error.message.toLowerCase()
    if (
      error.status === 401 ||
      error.status === 403 ||
      (error.status === 400 && /api.?key|credential/.test(message))
    ) {
      return new AIServiceError(
        'invalid_key',
        'Gemini could not authenticate. Check your API key in Settings.',
        false,
      )
    }

    if (error.status === 408 || error.status === 504) {
      return new AIServiceError(
        'timeout',
        'Avri took too long to respond. Please try again.',
        true,
      )
    }

    if (error.status === 429) {
      return new AIServiceError(
        'rate_limited',
        'Gemini is receiving too many requests. Please wait a moment and try again.',
        true,
      )
    }

    if (error.status >= 500) {
      return new AIServiceError(
        'api_error',
        'Gemini is temporarily unavailable. Please try again.',
        true,
      )
    }

    if (error.status === 400 || error.status === 404) {
      return new AIServiceError(
        'api_error',
        'Gemini rejected this request. Check the selected model and try again.',
        false,
      )
    }
  }

  if (error instanceof TypeError) {
    return new AIServiceError(
      'offline',
      'Avri cannot reach Gemini. Check your internet connection and try again.',
      true,
    )
  }

  return new AIServiceError(
    'api_error',
    'Something went wrong while contacting Gemini. Please try again.',
    true,
  )
}

interface TimedAbort {
  signal: AbortSignal
  didTimeOut(): boolean
  cleanup(): void
}

function createTimedAbort(signal: AbortSignal, timeoutMs: number): TimedAbort {
  const controller = new AbortController()
  let timedOut = false

  const handleAbort = () => controller.abort()
  if (signal.aborted) {
    controller.abort()
  } else {
    signal.addEventListener('abort', handleAbort, { once: true })
  }

  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', handleAbort)
    },
  }
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini'
  private readonly client: GoogleGenAI

  constructor(private readonly apiKey: string) {
    this.client = new GoogleGenAI({ apiKey: this.apiKey })
    console.info('[Avri AI] @google/genai client initialized.', {
      keyConfigured: Boolean(this.apiKey.trim()),
    })
  }

  async *stream(
    request: AIProviderStreamRequest,
    signal: AbortSignal,
  ): AsyncIterable<string> {
    const contents = toGeminiContents(request.messages)

    if (contents.length === 0) {
      throw new AIServiceError(
        'configuration',
        'There is no message to send.',
        false,
      )
    }

    const timedAbort = createTimedAbort(signal, GENERATION_TIMEOUT_MS)
    const startedAt = Date.now()

    try {
      const response = await this.client.models.generateContentStream({
        model: request.model,
        contents,
        config: {
          abortSignal: timedAbort.signal,
          systemInstruction: getSystemInstruction(request.messages),
        },
      })

      for await (const chunk of response) {
        if (signal.aborted) {
          throw new AIServiceError('cancelled', 'Generation stopped.', false)
        }

        if (chunk.text) {
          yield chunk.text
        }
      }
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error
      }

      if (signal.aborted) {
        throw new AIServiceError('cancelled', 'Generation stopped.', false)
      }

      logGeminiSdkError(
        'Gemini streaming request failed.',
        error,
        this.apiKey,
        timedAbort.didTimeOut(),
        Date.now() - startedAt,
      )
      throw classifyGeminiError(error, timedAbort.didTimeOut())
    } finally {
      timedAbort.cleanup()
    }
  }

  async testConnection(model: string, signal: AbortSignal): Promise<void> {
    const timedAbort = createTimedAbort(signal, CONNECTION_TEST_TIMEOUT_MS)
    const startedAt = Date.now()

    console.info('[Avri AI] Gemini connection test started.', {
      model,
      timeoutMs: CONNECTION_TEST_TIMEOUT_MS,
    })

    try {
      const modelInfo = await this.client.models.get({
        model,
        config: { abortSignal: timedAbort.signal },
      })

      console.info('[Avri AI] Gemini connection test succeeded.', {
        requestedModel: model,
        resolvedModel: modelInfo.name,
        googleApiReached: true,
        elapsedMs: Date.now() - startedAt,
      })
    } catch (error) {
      logGeminiSdkError(
        'Gemini connection test failed.',
        error,
        this.apiKey,
        timedAbort.didTimeOut(),
        Date.now() - startedAt,
      )

      if (signal.aborted) {
        throw new AIServiceError('cancelled', 'Connection test stopped.', false)
      }

      throw classifyGeminiError(error, timedAbort.didTimeOut())
    } finally {
      timedAbort.cleanup()
    }
  }

  async generateStructured(
    request: AIStructuredRequest,
    signal: AbortSignal,
  ): Promise<unknown> {
    const timedAbort = createTimedAbort(signal, STRUCTURED_RESPONSE_TIMEOUT_MS)
    const startedAt = Date.now()

    try {
      const response = await this.client.models.generateContent({
        model: request.model,
        contents: request.prompt,
        config: {
          abortSignal: timedAbort.signal,
          systemInstruction: request.systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: request.responseSchema,
        },
      })

      if (!response.text?.trim()) {
        throw new AIServiceError(
          'empty_response',
          'Gemini returned an empty structured response.',
          false,
        )
      }

      return JSON.parse(response.text) as unknown
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error
      }

      logGeminiSdkError(
        'Gemini structured request failed.',
        error,
        this.apiKey,
        timedAbort.didTimeOut(),
        Date.now() - startedAt,
      )

      if (signal.aborted) {
        throw new AIServiceError('cancelled', 'Structured request stopped.', false)
      }

      throw classifyGeminiError(error, timedAbort.didTimeOut())
    } finally {
      timedAbort.cleanup()
    }
  }
}
