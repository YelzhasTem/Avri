import type { ChatMessage } from '../ai'

export interface ChatConversation {
  id: string
  title: string
  model: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChatSummary {
  id: string
  title: string
  model: string
  createdAt: string
  updatedAt: string
}

export type CreateChatInput = Pick<ChatConversation, 'id' | 'model'>
export type SaveChatInput = ChatConversation

