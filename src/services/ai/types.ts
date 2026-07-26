export const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
] as const

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id

export type MessageRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface AIStreamRequest {
  requestId: string
  chatId: string
  assistantMessageId: string
  model: string
  messages: ChatMessage[]
}

export type AIProviderStreamRequest = Pick<
  AIStreamRequest,
  'model' | 'messages'
>

export interface AIStructuredRequest {
  model: string
  prompt: string
  systemInstruction: string
  responseSchema: Record<string, unknown>
}

export type AIErrorCode =
  | 'invalid_key'
  | 'timeout'
  | 'offline'
  | 'cancelled'
  | 'empty_response'
  | 'rate_limited'
  | 'configuration'
  | 'api_error'

export interface AIErrorPayload {
  code: AIErrorCode
  message: string
  retryable: boolean
}

export type AIStreamEvent =
  | { requestId: string; type: 'started' }
  | { requestId: string; type: 'chunk'; text: string }
  | { requestId: string; type: 'completed' }
  | { requestId: string; type: 'cancelled' }
  | { requestId: string; type: 'error'; error: AIErrorPayload }

export type ConnectionStatus =
  | 'not-tested'
  | 'testing'
  | 'connected'
  | 'error'

export interface ConnectionTestResult {
  ok: boolean
  error?: AIErrorPayload
}
