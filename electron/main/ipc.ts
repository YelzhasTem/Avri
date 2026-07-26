import { ipcMain, type IpcMainEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  AIServiceError,
  type AIStreamEvent,
  type AIStreamRequest,
  type ChatMessage,
} from '../../src/services/ai'
import type {
  ChatConversation,
  ChatRepository,
  CreateChatInput,
} from '../../src/services/chat'
import type {
  TestConnectionInput,
  UpdateAISettingsInput,
} from '../../src/services/settings'
import {
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCE_LEVELS,
  MEMORY_STATUSES,
  type MemoryListQuery,
  type MemoryProposalEvent,
  type UpdateMemoryInput,
} from '../../src/services/memory'
import { IPC_CHANNELS } from '../shared/channels'
import type { AIService } from './AIService'
import type { MemoryService } from './memory/MemoryService'
import type { SettingsRepository } from './storage/SettingsRepository'

interface IpcDependencies {
  ai: AIService
  chats: ChatRepository
  settings: SettingsRepository
  memory: MemoryService
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(
  value: unknown,
  name: string,
  maxLength = 10_000,
): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new AIServiceError(
      'configuration',
      `Invalid ${name}.`,
      false,
    )
  }

  return value
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new AIServiceError('configuration', 'Invalid conversation.', false)
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIServiceError('configuration', 'Invalid message.', false)
    }

    const role = item.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      throw new AIServiceError('configuration', 'Invalid message role.', false)
    }

    return {
      id: requireString(item.id, 'message id', 100),
      role,
      content: requireString(item.content, 'message content', 1_000_000),
      createdAt: requireString(item.createdAt, 'message date', 100),
    }
  })
}

function parseAIRequest(value: unknown): AIStreamRequest {
  if (!isRecord(value)) {
    throw new AIServiceError('configuration', 'Invalid AI request.', false)
  }

  return {
    requestId: requireString(value.requestId, 'request id', 100),
    chatId: requireString(value.chatId, 'chat id', 100),
    assistantMessageId: requireString(
      value.assistantMessageId,
      'assistant message id',
      100,
    ),
    model: requireString(value.model, 'model', 100),
    messages: parseMessages(value.messages),
  }
}

function parseMemoryQuery(value: unknown): MemoryListQuery | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isRecord(value)) {
    throw new Error('Invalid memory query.')
  }

  const category = value.category
  const status = value.status
  if (
    category !== undefined &&
    category !== 'all' &&
    !MEMORY_CATEGORIES.includes(category as (typeof MEMORY_CATEGORIES)[number])
  ) {
    throw new Error('Invalid memory category.')
  }
  if (
    status !== undefined &&
    status !== 'all' &&
    !MEMORY_STATUSES.includes(status as (typeof MEMORY_STATUSES)[number])
  ) {
    throw new Error('Invalid memory status.')
  }

  return {
    search:
      value.search === undefined
        ? undefined
        : requireString(value.search, 'memory search', 200),
    category: category as MemoryListQuery['category'],
    status: status as MemoryListQuery['status'],
  }
}

function parseMemoryUpdate(value: unknown): UpdateMemoryInput {
  if (!isRecord(value)) {
    throw new Error('Invalid memory update.')
  }

  if (
    value.category !== undefined &&
    !MEMORY_CATEGORIES.includes(
      value.category as (typeof MEMORY_CATEGORIES)[number],
    )
  ) {
    throw new Error('Invalid memory category.')
  }
  if (
    value.importance !== undefined &&
    !MEMORY_IMPORTANCE_LEVELS.includes(
      value.importance as (typeof MEMORY_IMPORTANCE_LEVELS)[number],
    )
  ) {
    throw new Error('Invalid memory importance.')
  }
  if (
    value.keywords !== undefined &&
    (!Array.isArray(value.keywords) ||
      value.keywords.length > 8 ||
      !value.keywords.every(
        (keyword) => typeof keyword === 'string' && keyword.length <= 40,
      ))
  ) {
    throw new Error('Invalid memory keywords.')
  }

  return {
    content:
      value.content === undefined
        ? undefined
        : requireString(value.content, 'memory content', 500),
    category: value.category as UpdateMemoryInput['category'],
    importance: value.importance as UpdateMemoryInput['importance'],
    keywords: value.keywords as string[] | undefined,
  }
}

function parseCreateChat(value: unknown): CreateChatInput {
  if (!isRecord(value)) {
    throw new Error('Invalid chat.')
  }

  return {
    id: requireString(value.id, 'chat id', 100),
    model: requireString(value.model, 'model', 100),
  }
}

function parseChat(value: unknown): ChatConversation {
  if (!isRecord(value)) {
    throw new Error('Invalid chat.')
  }

  return {
    id: requireString(value.id, 'chat id', 100),
    title: requireString(value.title, 'chat title', 80),
    model: requireString(value.model, 'model', 100),
    messages: parseMessages(value.messages),
    createdAt: requireString(value.createdAt, 'creation date', 100),
    updatedAt: requireString(value.updatedAt, 'update date', 100),
  }
}

function parseSettings(value: unknown): UpdateAISettingsInput {
  if (!isRecord(value)) {
    throw new Error('Invalid settings.')
  }

  return {
    model: requireString(value.model, 'model', 100),
    apiKey:
      value.apiKey === undefined
        ? undefined
        : requireString(value.apiKey, 'API key', 500),
    clearApiKey: value.clearApiKey === true,
  }
}

function parseConnectionTest(value: unknown): TestConnectionInput {
  if (!isRecord(value)) {
    throw new Error('Invalid connection test.')
  }

  return {
    model: requireString(value.model, 'model', 100),
    apiKey:
      value.apiKey === undefined
        ? undefined
        : requireString(value.apiKey, 'API key', 500),
  }
}

function sendAIEvent(event: IpcMainEvent, payload: AIStreamEvent): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send(IPC_CHANNELS.aiEvent, payload)
  }
}

function sendMemoryEvent(
  event: IpcMainEvent,
  payload: MemoryProposalEvent,
): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send(IPC_CHANNELS.memoryEvent, payload)
    console.info('[Avri Memory] Proposal IPC event emitted.', {
      memoryId: payload.memory.id,
      sourceChatId: payload.memory.sourceChatId,
      sourceMessageId: payload.memory.sourceMessageId,
    })
  } else {
    console.warn('[Avri Memory] Proposal IPC event was not emitted because the renderer was destroyed.')
  }
}

export function registerIpcHandlers({
  ai,
  chats,
  settings,
  memory,
}: IpcDependencies): void {
  ipcMain.on(IPC_CHANNELS.aiStart, (event, input: unknown) => {
    try {
      const request = parseAIRequest(input)
      void ai.stream(
        request,
        (payload) => sendAIEvent(event, payload),
        (payload) => sendMemoryEvent(event, payload),
      )
    } catch (error) {
      const requestId =
        isRecord(input) && typeof input.requestId === 'string'
          ? input.requestId
          : randomUUID()

      sendAIEvent(event, {
        requestId,
        type: 'error',
        error:
          error instanceof AIServiceError
            ? error.toPayload()
            : {
                code: 'configuration',
                message: 'Avri could not start this request.',
                retryable: false,
              },
      })
    }
  })

  ipcMain.on(IPC_CHANNELS.aiCancel, (_event, requestId: unknown) => {
    if (typeof requestId === 'string') {
      ai.cancel(requestId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.chatsList, () => chats.list())
  ipcMain.handle(IPC_CHANNELS.chatsGet, (_event, id: unknown) =>
    chats.get(requireString(id, 'chat id', 100)),
  )
  ipcMain.handle(IPC_CHANNELS.chatsCreate, (_event, input: unknown) =>
    chats.create(parseCreateChat(input)),
  )
  ipcMain.handle(IPC_CHANNELS.chatsSave, (_event, input: unknown) =>
    chats.save(parseChat(input)),
  )
  ipcMain.handle(
    IPC_CHANNELS.chatsRename,
    (_event, id: unknown, title: unknown) =>
      chats.rename(
        requireString(id, 'chat id', 100),
        requireString(title, 'chat title', 80),
      ),
  )
  ipcMain.handle(IPC_CHANNELS.chatsDelete, (_event, id: unknown) =>
    chats.delete(requireString(id, 'chat id', 100)),
  )

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => settings.getSummary())
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, input: unknown) =>
    settings.update(parseSettings(input)),
  )
  ipcMain.handle(IPC_CHANNELS.settingsTest, (_event, input: unknown) =>
    ai.testConnection(parseConnectionTest(input)),
  )

  ipcMain.handle(IPC_CHANNELS.memoryList, (_event, query: unknown) =>
    memory.list(parseMemoryQuery(query)),
  )
  ipcMain.handle(IPC_CHANNELS.memoryGet, (_event, id: unknown) =>
    memory.get(requireString(id, 'memory id', 100)),
  )
  ipcMain.handle(
    IPC_CHANNELS.memoryUpdate,
    (_event, id: unknown, input: unknown) =>
      memory.update(
        requireString(id, 'memory id', 100),
        parseMemoryUpdate(input),
      ),
  )
  ipcMain.handle(IPC_CHANNELS.memoryConfirm, (_event, id: unknown) =>
    memory.confirm(requireString(id, 'memory id', 100)),
  )
  ipcMain.handle(IPC_CHANNELS.memoryDismiss, (_event, id: unknown) =>
    memory.dismiss(requireString(id, 'memory id', 100)),
  )
  ipcMain.handle(IPC_CHANNELS.memoryArchive, (_event, id: unknown) =>
    memory.archive(requireString(id, 'memory id', 100)),
  )
  ipcMain.handle(IPC_CHANNELS.memoryDelete, (_event, id: unknown) =>
    memory.delete(requireString(id, 'memory id', 100)),
  )
  ipcMain.handle(IPC_CHANNELS.memoryClearAll, () => memory.clearAll())
}
