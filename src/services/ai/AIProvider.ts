import type { AIStructuredRequest, AIProviderStreamRequest } from './types'

export interface AIProvider {
  readonly id: string

  stream(
    request: AIProviderStreamRequest,
    signal: AbortSignal,
  ): AsyncIterable<string>

  testConnection(model: string, signal: AbortSignal): Promise<void>

  generateStructured(
    request: AIStructuredRequest,
    signal: AbortSignal,
  ): Promise<unknown>
}

export type AIProviderFactory = (apiKey: string) => AIProvider
