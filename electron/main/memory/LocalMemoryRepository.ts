import { randomUUID } from 'node:crypto'
import {
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCE_LEVELS,
  MEMORY_STATUSES,
  normalizeMemoryTerms,
  validateMemoryDraft,
  type MemoryEntity,
  type MemoryListQuery,
  type MemoryProposalInput,
  type MemoryRepository,
  type UpdateMemoryInput,
} from '../../../src/services/memory'
import { JsonFileStore } from '../storage/JsonFileStore'

interface MemoryStoreData {
  version: 1
  memories: MemoryEntity[]
}

function createEmptyStore(): MemoryStoreData {
  return { version: 1, memories: [] }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isMemoryEntity(value: unknown): value is MemoryEntity {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const memory = value as Record<string, unknown>
  return (
    typeof memory.id === 'string' &&
    typeof memory.content === 'string' &&
    MEMORY_CATEGORIES.includes(memory.category as MemoryEntity['category']) &&
    typeof memory.createdAt === 'string' &&
    typeof memory.updatedAt === 'string' &&
    typeof memory.sourceChatId === 'string' &&
    (memory.sourceMessageId === undefined || typeof memory.sourceMessageId === 'string') &&
    MEMORY_STATUSES.includes(memory.status as MemoryEntity['status']) &&
    MEMORY_IMPORTANCE_LEVELS.includes(
      memory.importance as MemoryEntity['importance'],
    ) &&
    isStringArray(memory.keywords) &&
    (memory.reason === undefined || typeof memory.reason === 'string') &&
    validateMemoryDraft({
      content: memory.content,
      category: memory.category,
      importance: memory.importance,
      keywords: memory.keywords,
      reason: memory.reason,
    }).ok
  )
}

function isMemoryStoreData(value: unknown): value is MemoryStoreData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const data = value as Record<string, unknown>
  return (
    data.version === 1 &&
    Array.isArray(data.memories) &&
    data.memories.every(isMemoryEntity)
  )
}

function matchesQuery(memory: MemoryEntity, query?: MemoryListQuery): boolean {
  if (!query) {
    return true
  }

  if (query.category && query.category !== 'all' && memory.category !== query.category) {
    return false
  }

  if (query.status && query.status !== 'all' && memory.status !== query.status) {
    return false
  }

  const searchTerms = normalizeMemoryTerms(query.search ?? '')
  if (searchTerms.length === 0) {
    return true
  }

  const memoryTerms = new Set(
    normalizeMemoryTerms(
      `${memory.content} ${memory.category} ${memory.keywords.join(' ')}`,
    ),
  )
  return searchTerms.every((term) => memoryTerms.has(term))
}

function validateSource(input: MemoryProposalInput): void {
  if (!input.sourceChatId.trim() || input.sourceChatId.length > 100) {
    throw new Error('Invalid memory source chat.')
  }

  if (input.sourceMessageId && input.sourceMessageId.length > 100) {
    throw new Error('Invalid memory source message.')
  }
}

export class LocalMemoryRepository implements MemoryRepository {
  private readonly store: JsonFileStore<MemoryStoreData>

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath, createEmptyStore, {
      validate: isMemoryStoreData,
      preserveCorruptedFile: true,
      onCorruption: (backupPath) => {
        console.error('[Avri Memory] Recovered corrupted local memory storage.', {
          backupCreated: Boolean(backupPath),
        })
      },
    })
  }

  async list(query?: MemoryListQuery): Promise<MemoryEntity[]> {
    const data = await this.store.read()
    return [...data.memories]
      .filter((memory) => matchesQuery(memory, query))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<MemoryEntity | null> {
    const data = await this.store.read()
    return data.memories.find((memory) => memory.id === id) ?? null
  }

  async createProposal(input: MemoryProposalInput): Promise<MemoryEntity> {
    validateSource(input)
    const validation = validateMemoryDraft(input)
    if (!validation.ok) {
      throw new Error(validation.reason)
    }

    const now = new Date().toISOString()
    const memory: MemoryEntity = {
      id: randomUUID(),
      ...validation.value,
      sourceChatId: input.sourceChatId,
      sourceMessageId: input.sourceMessageId,
      status: 'proposed',
      createdAt: now,
      updatedAt: now,
    }

    await this.store.update((data) => ({
      ...data,
      memories: [memory, ...data.memories],
    }))
    return memory
  }

  async update(id: string, input: UpdateMemoryInput): Promise<MemoryEntity> {
    return this.mutate(id, (memory) => {
      const validation = validateMemoryDraft({
        content: input.content ?? memory.content,
        category: input.category ?? memory.category,
        importance: input.importance ?? memory.importance,
        keywords: input.keywords ?? memory.keywords,
        reason: memory.reason,
      })

      if (!validation.ok) {
        throw new Error(validation.reason)
      }

      return {
        ...memory,
        ...validation.value,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async confirm(id: string): Promise<MemoryEntity> {
    return this.mutate(id, (memory) => {
      if (memory.status === 'archived') {
        throw new Error('Archived memories cannot be confirmed.')
      }

      return {
        ...memory,
        status: 'confirmed',
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async dismiss(id: string): Promise<void> {
    const memory = await this.get(id)
    if (!memory) {
      return
    }
    if (memory.status !== 'proposed') {
      throw new Error('Only pending memory proposals can be dismissed.')
    }
    await this.delete(id)
  }

  async archive(id: string): Promise<MemoryEntity> {
    return this.mutate(id, (memory) => ({
      ...memory,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    }))
  }

  async delete(id: string): Promise<void> {
    await this.store.update((data) => ({
      ...data,
      memories: data.memories.filter((memory) => memory.id !== id),
    }))
  }

  async clearAll(): Promise<void> {
    await this.store.update((data) => ({ ...data, memories: [] }))
  }

  private async mutate(
    id: string,
    mutator: (memory: MemoryEntity) => MemoryEntity,
  ): Promise<MemoryEntity> {
    let result: MemoryEntity | undefined

    await this.store.update((data) => ({
      ...data,
      memories: data.memories.map((memory) => {
        if (memory.id !== id) {
          return memory
        }
        result = mutator(memory)
        return result
      }),
    }))

    if (!result) {
      throw new Error('Memory not found.')
    }

    return result
  }
}
