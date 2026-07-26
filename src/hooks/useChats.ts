import { useCallback, useEffect, useState } from 'react'
import type {
  ChatConversation,
  ChatSummary,
} from '../services/chat'

export function useChats() {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setChats(await window.avri.chats.list())
      setStorageError(null)
    } catch {
      setStorageError('Avri could not load your local chats.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createChat = useCallback(async (model: string) => {
    const chat = await window.avri.chats.create({
      id: crypto.randomUUID(),
      model,
    })
    setActiveChat(chat)
    setChats((current) => [
      {
        id: chat.id,
        title: chat.title,
        model: chat.model,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      ...current.filter((item) => item.id !== chat.id),
    ])
    return chat
  }, [])

  const loadChat = useCallback(async (id: string) => {
    const chat = await window.avri.chats.get(id)
    if (chat) {
      setActiveChat(chat)
    }
    return chat
  }, [])

  const saveChat = useCallback(async (chat: ChatConversation) => {
    const saved = await window.avri.chats.save(chat)
    setActiveChat((current) =>
      current === null || current.id === saved.id ? saved : current,
    )
    setChats((current) => [
      {
        id: saved.id,
        title: saved.title,
        model: saved.model,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
      ...current.filter((item) => item.id !== saved.id),
    ])
    return saved
  }, [])

  const renameChat = useCallback(async (id: string, title: string) => {
    const renamed = await window.avri.chats.rename(id, title)
    setChats((current) =>
      current.map((chat) =>
        chat.id === id
          ? {
              id: renamed.id,
              title: renamed.title,
              model: renamed.model,
              createdAt: renamed.createdAt,
              updatedAt: renamed.updatedAt,
            }
          : chat,
      ),
    )
    setActiveChat((current) => (current?.id === id ? renamed : current))
    return renamed
  }, [])

  const deleteChat = useCallback(async (id: string) => {
    await window.avri.chats.delete(id)
    setChats((current) => current.filter((chat) => chat.id !== id))
    setActiveChat((current) => (current?.id === id ? null : current))
  }, [])

  return {
    chats,
    activeChat,
    isLoading,
    storageError,
    setActiveChat,
    createChat,
    loadChat,
    saveChat,
    renameChat,
    deleteChat,
    refresh,
  }
}
