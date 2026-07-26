import { describe, expect, it, vi } from 'vitest'
import type { AIProvider, AIProviderFactory } from '../src/services/ai/AIProvider'
import type {
  MemoryEntity,
  MemoryProposalInput,
  MemoryRepository,
} from '../src/services/memory'
import { MemoryService } from '../electron/main/memory/MemoryService'
import type { SettingsRepository } from '../electron/main/storage/SettingsRepository'

function createRepository() {
  const memories: MemoryEntity[] = []
  const createProposal = vi.fn(async (input: MemoryProposalInput) => {
    const memory: MemoryEntity = {
      id: 'memory-1',
      ...input,
      status: 'proposed',
      createdAt: '2026-07-26T00:00:00.000Z',
      updatedAt: '2026-07-26T00:00:00.000Z',
    }
    memories.push(memory)
    return memory
  })

  const repository: MemoryRepository = {
    list: vi.fn(async () => memories),
    get: vi.fn(async (id) => memories.find((memory) => memory.id === id) ?? null),
    createProposal,
    update: vi.fn(async () => {
      throw new Error('Not used in this test.')
    }),
    confirm: vi.fn(async () => {
      throw new Error('Not used in this test.')
    }),
    dismiss: vi.fn(async () => undefined),
    archive: vi.fn(async () => {
      throw new Error('Not used in this test.')
    }),
    delete: vi.fn(async () => undefined),
    clearAll: vi.fn(async () => undefined),
  }

  return { repository, createProposal }
}

function createService(structuredOutput: unknown) {
  const { repository, createProposal } = createRepository()
  const generateStructured = vi.fn(async () => structuredOutput)
  const provider: AIProvider = {
    id: 'test',
    stream: vi.fn(),
    testConnection: vi.fn(async () => undefined),
    generateStructured,
  }
  const createProvider: AIProviderFactory = () => provider
  const settings = {
    getResolvedApiKey: vi.fn(async () => 'test-key'),
  } as unknown as SettingsRepository

  return {
    service: new MemoryService(repository, settings, createProvider),
    createProposal,
    generateStructured,
  }
}

function extractionRequest(content: string) {
  return {
    model: 'gemini-test',
    messages: [
      {
        id: 'user-1',
        role: 'user' as const,
        content,
        createdAt: '2026-07-26T00:00:00.000Z',
      },
    ],
    assistantResponse: 'Thanks for sharing that.',
    sourceChatId: 'chat-1',
    sourceMessageId: 'assistant-1',
  }
}

describe('post-response memory extraction', () => {
  it('sends ordinary durable statements to structured extraction', async () => {
    const { service, generateStructured, createProposal } = createService({
      shouldPropose: true,
      content: "The user's favorite color is blue.",
      category: 'preference',
      importance: 'low',
      confidence: 'high',
      reason: 'A stable personal preference.',
      keywords: ['favorite color', 'blue'],
    })

    const proposal = await service.extractProposal(
      extractionRequest('My favorite color is blue.'),
    )

    expect(generateStructured).toHaveBeenCalledOnce()
    expect(createProposal).toHaveBeenCalledOnce()
    expect(proposal).toMatchObject({
      status: 'proposed',
      sourceChatId: 'chat-1',
      sourceMessageId: 'assistant-1',
    })
  })

  it('lets Gemini reject temporary requests instead of skipping extraction locally', async () => {
    const { service, generateStructured, createProposal } = createService({
      shouldPropose: false,
      content: 'No durable memory',
      category: 'other',
      importance: 'low',
      confidence: 'low',
      reason: 'This is a temporary question.',
      keywords: [],
    })

    const proposal = await service.extractProposal(
      extractionRequest('What is the best Electron version?'),
    )

    expect(generateStructured).toHaveBeenCalledOnce()
    expect(createProposal).not.toHaveBeenCalled()
    expect(proposal).toBeNull()
  })

  it('suppresses low-confidence proposals unless importance is high', async () => {
    const { service, createProposal } = createService({
      shouldPropose: true,
      content: 'The user plans to eat pasta tonight.',
      category: 'other',
      importance: 'low',
      confidence: 'low',
      reason: 'This is likely temporary.',
      keywords: ['pasta', 'tonight'],
    })

    expect(
      await service.extractProposal(
        extractionRequest('I plan to eat pasta tonight.'),
      ),
    ).toBeNull()
    expect(createProposal).not.toHaveBeenCalled()
  })

  it('keeps high-importance proposals even when confidence is low', async () => {
    const { service, createProposal } = createService({
      shouldPropose: true,
      content: 'The user has an important deadline tomorrow.',
      category: 'goal',
      importance: 'high',
      confidence: 'low',
      reason: 'This may be important for immediate follow-up.',
      keywords: ['deadline'],
    })

    expect(
      await service.extractProposal(
        extractionRequest('I have an important deadline tomorrow.'),
      ),
    ).toMatchObject({ status: 'proposed' })
    expect(createProposal).toHaveBeenCalledOnce()
  })
})
