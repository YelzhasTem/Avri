import type {
  ChatConversation,
  ChatRepository,
  ChatSummary,
  CreateChatInput,
  SaveChatInput,
} from '../../../src/services/chat'
import { JsonFileStore } from './JsonFileStore'

interface ChatStoreData {
  version: 1
  chats: ChatConversation[]
}

function createEmptyStore(): ChatStoreData {
  return { version: 1, chats: [] }
}

function toSummary(chat: ChatConversation): ChatSummary {
  const { id, title, model, createdAt, updatedAt } = chat
  return { id, title, model, createdAt, updatedAt }
}

function normalizeTitle(title: string): string {
  return title.trim().slice(0, 80) || 'New chat'
}

export class LocalChatRepository implements ChatRepository {
  private readonly store: JsonFileStore<ChatStoreData>

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath, createEmptyStore)
  }

  async list(): Promise<ChatSummary[]> {
    const data = await this.store.read()
    return [...data.chats]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(toSummary)
  }

  async get(id: string): Promise<ChatConversation | null> {
    const data = await this.store.read()
    return data.chats.find((chat) => chat.id === id) ?? null
  }

  async create(input: CreateChatInput): Promise<ChatConversation> {
    const now = new Date().toISOString()
    const chat: ChatConversation = {
      id: input.id,
      title: 'New chat',
      model: input.model,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }

    await this.store.update((data) => ({
      ...data,
      chats: [chat, ...data.chats.filter((item) => item.id !== chat.id)],
    }))

    return chat
  }

  async save(input: SaveChatInput): Promise<ChatConversation> {
    const chat: ChatConversation = {
      ...input,
      title: normalizeTitle(input.title),
      updatedAt: new Date().toISOString(),
    }

    await this.store.update((data) => ({
      ...data,
      chats: [chat, ...data.chats.filter((item) => item.id !== chat.id)],
    }))

    return chat
  }

  async rename(id: string, title: string): Promise<ChatConversation> {
    let renamedChat: ChatConversation | undefined

    await this.store.update((data) => ({
      ...data,
      chats: data.chats.map((chat) => {
        if (chat.id !== id) {
          return chat
        }

        renamedChat = {
          ...chat,
          title: normalizeTitle(title),
          updatedAt: new Date().toISOString(),
        }
        return renamedChat
      }),
    }))

    if (!renamedChat) {
      throw new Error('Chat not found.')
    }

    return renamedChat
  }

  async delete(id: string): Promise<void> {
    await this.store.update((data) => ({
      ...data,
      chats: data.chats.filter((chat) => chat.id !== id),
    }))
  }
}

