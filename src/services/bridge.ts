import type {
  AIStreamEvent,
  AIStreamRequest,
  ConnectionTestResult,
} from './ai'
import type {
  ChatConversation,
  ChatSummary,
  CreateChatInput,
  SaveChatInput,
} from './chat'
import type {
  AISettingsSummary,
  TestConnectionInput,
  UpdateAISettingsInput,
} from './settings'
import type {
  MemoryEntity,
  MemoryListQuery,
  MemoryProposalEvent,
  UpdateMemoryInput,
} from './memory'

export interface AvriBridge {
  ai: {
    start(request: AIStreamRequest): void
    cancel(requestId: string): void
    onEvent(listener: (event: AIStreamEvent) => void): () => void
  }
  chats: {
    list(): Promise<ChatSummary[]>
    get(id: string): Promise<ChatConversation | null>
    create(input: CreateChatInput): Promise<ChatConversation>
    save(input: SaveChatInput): Promise<ChatConversation>
    rename(id: string, title: string): Promise<ChatConversation>
    delete(id: string): Promise<void>
  }
  settings: {
    get(): Promise<AISettingsSummary>
    update(input: UpdateAISettingsInput): Promise<AISettingsSummary>
    test(input: TestConnectionInput): Promise<ConnectionTestResult>
  }
  memory: {
    list(query?: MemoryListQuery): Promise<MemoryEntity[]>
    get(id: string): Promise<MemoryEntity | null>
    update(id: string, input: UpdateMemoryInput): Promise<MemoryEntity>
    confirm(id: string): Promise<MemoryEntity>
    dismiss(id: string): Promise<void>
    archive(id: string): Promise<MemoryEntity>
    delete(id: string): Promise<void>
    clearAll(): Promise<void>
    onProposal(listener: (event: MemoryProposalEvent) => void): () => void
  }
}

declare global {
  interface Window {
    avri: AvriBridge
  }
}
