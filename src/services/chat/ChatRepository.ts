import type {
  ChatConversation,
  ChatSummary,
  CreateChatInput,
  SaveChatInput,
} from './types'

export interface ChatRepository {
  list(): Promise<ChatSummary[]>
  get(id: string): Promise<ChatConversation | null>
  create(input: CreateChatInput): Promise<ChatConversation>
  save(input: SaveChatInput): Promise<ChatConversation>
  rename(id: string, title: string): Promise<ChatConversation>
  delete(id: string): Promise<void>
}

