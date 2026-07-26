import type { AIProviderFactory } from '../../src/services/ai/AIProvider'
import {
  AIServiceError,
  toAIErrorPayload,
  type AIStreamEvent,
  type AIStreamRequest,
  type ConnectionTestResult,
} from '../../src/services/ai'
import type { TestConnectionInput } from '../../src/services/settings'
import type { MemoryProposalEvent } from '../../src/services/memory'
import type { MemoryService } from './memory/MemoryService'
import type { SettingsRepository } from './storage/SettingsRepository'

const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 450

function abortableDelay(duration: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }
    const timeout = setTimeout(finish, duration)
    const handleAbort = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', handleAbort)
      reject(new AIServiceError('cancelled', 'Generation stopped.', false))
    }

    if (signal.aborted) {
      handleAbort()
      return
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export class AIService {
  private readonly controllers = new Map<string, AbortController>()

  constructor(
    private readonly settings: SettingsRepository,
    private readonly createProvider: AIProviderFactory,
    private readonly memory: MemoryService,
  ) {}

  async stream(
    request: AIStreamRequest,
    emit: (event: AIStreamEvent) => void,
    emitMemory: (event: MemoryProposalEvent) => void,
  ): Promise<void> {
    this.cancel(request.requestId)

    const controller = new AbortController()
    this.controllers.set(request.requestId, controller)
    emit({ requestId: request.requestId, type: 'started' })

    try {
      const apiKey = await this.settings.getResolvedApiKey()
      if (!apiKey) {
        throw new AIServiceError(
          'configuration',
          'Add a Gemini API key in Settings before sending a message.',
          false,
        )
      }

      const latestUserMessage = [...request.messages]
        .reverse()
        .find((message) => message.role === 'user')
      const relevantContext = latestUserMessage
        ? await this.memory.getRelevantContext(latestUserMessage.content)
        : { memories: [], systemContext: '' }
      const providerMessages = relevantContext.systemContext
        ? [
            {
              id: `memory-context-${request.requestId}`,
              role: 'system' as const,
              content: relevantContext.systemContext,
              createdAt: new Date().toISOString(),
            },
            ...request.messages,
          ]
        : request.messages

      let deliveredContent = false
      let assistantResponse = ''

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const provider = this.createProvider(apiKey)

          for await (const text of provider.stream(
            { model: request.model, messages: providerMessages },
            controller.signal,
          )) {
            deliveredContent = true
            assistantResponse += text
            emit({ requestId: request.requestId, type: 'chunk', text })
          }

          if (!deliveredContent) {
            throw new AIServiceError(
              'empty_response',
              'Gemini returned an empty response. Please try again.',
              true,
            )
          }

          emit({ requestId: request.requestId, type: 'completed' })
          console.info('[Avri Memory] Starting post-response extraction.', {
            requestId: request.requestId,
            chatId: request.chatId,
            sourceMessageId: request.assistantMessageId,
          })
          void this.memory
            .extractProposal({
              model: request.model,
              messages: request.messages,
              assistantResponse,
              sourceChatId: request.chatId,
              sourceMessageId: request.assistantMessageId,
            })
            .then((proposal) => {
              if (proposal) {
                console.info('[Avri Memory] Forwarding proposal to IPC.', {
                  memoryId: proposal.id,
                  sourceChatId: proposal.sourceChatId,
                  sourceMessageId: proposal.sourceMessageId,
                })
                emitMemory({ type: 'proposed', memory: proposal })
              }
            })
          return
        } catch (error) {
          const payload = toAIErrorPayload(error)
          const canRetry =
            payload.retryable && !deliveredContent && attempt < MAX_ATTEMPTS

          if (!canRetry) {
            throw error
          }

          await abortableDelay(RETRY_DELAY_MS, controller.signal)
        }
      }
    } catch (error) {
      const payload = toAIErrorPayload(error)
      emit(
        payload.code === 'cancelled' || controller.signal.aborted
          ? { requestId: request.requestId, type: 'cancelled' }
          : { requestId: request.requestId, type: 'error', error: payload },
      )
    } finally {
      if (this.controllers.get(request.requestId) === controller) {
        this.controllers.delete(request.requestId)
      }
    }
  }

  cancel(requestId: string): void {
    this.controllers.get(requestId)?.abort()
    this.controllers.delete(requestId)
  }

  cancelAll(): void {
    this.controllers.forEach((controller) => controller.abort())
    this.controllers.clear()
  }

  async testConnection(
    input: TestConnectionInput,
  ): Promise<ConnectionTestResult> {
    const candidateKey = input.apiKey?.trim()
    const settingsSummary = candidateKey
      ? null
      : await this.settings.getSummary()
    const apiKey = candidateKey || (await this.settings.getResolvedApiKey())

    console.info('[Avri AI] Connection key resolution.', {
      keyConfigured: Boolean(apiKey),
      source: candidateKey
        ? 'settings input'
        : settingsSummary?.hasUserApiKey
          ? 'saved settings override'
          : settingsSummary?.hasEnvironmentApiKey
            ? 'development environment'
            : 'missing',
    })

    if (!apiKey) {
      return {
        ok: false,
        error: new AIServiceError(
          'configuration',
          'Add a Gemini API key before testing the connection.',
          false,
        ).toPayload(),
      }
    }

    const controller = new AbortController()

    try {
      await this.createProvider(apiKey).testConnection(input.model, controller.signal)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: toAIErrorPayload(error) }
    }
  }
}
