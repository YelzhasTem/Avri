import {
  Check,
  Clock3,
  Library,
  Monitor,
  Moon,
  Settings,
  SquarePen,
  Sun,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatView } from './components/ChatView'
import { HistoryView } from './components/HistoryView'
import { MemoryView } from './components/MemoryView'
import { SettingsView } from './components/SettingsView'
import { useAIStream } from './hooks/useAIStream'
import { useChats } from './hooks/useChats'
import { useMemory } from './hooks/useMemory'
import {
  DEFAULT_GEMINI_MODEL,
  type ChatMessage,
} from './services/ai'
import type { ChatConversation } from './services/chat'
import {
  getApiKeyStatus,
  type AISettingsSummary,
  type ApiKeyStatus,
} from './services/settings'
import { type ThemePreference, useTheme } from './theme'

type AppView = 'chat' | 'history' | 'memory' | 'settings'

const themeOptions = [
  { label: 'System', value: 'system', icon: Monitor },
  { label: 'Dark', value: 'dark', icon: Moon },
  { label: 'Light', value: 'light', icon: Sun },
] satisfies Array<{
  label: string
  value: ThemePreference
  icon: typeof Monitor
}>

const controlClassName =
  'avri-control inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] focus-visible:outline-none'

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function createChatTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim()
  return singleLine.length > 46 ? `${singleLine.slice(0, 46).trim()}…` : singleLine
}

function removeEmptyAssistantMessages(chat: ChatConversation): ChatConversation {
  return {
    ...chat,
    messages: chat.messages.filter(
      (message) => message.role !== 'assistant' || message.content.trim(),
    ),
  }
}

export default function App() {
  const { preference, setPreference } = useTheme()
  const [view, setView] = useState<AppView>('chat')
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [defaultModel, setDefaultModel] = useState<string>(
    DEFAULT_GEMINI_MODEL,
  )
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('checking')
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const themeTriggerRef = useRef<HTMLButtonElement>(null)
  const activeChatRef = useRef<ChatConversation | null>(null)

  const {
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
  } = useChats()

  const { start, cancel, isGenerating, isWaitingForFirstToken } = useAIStream()
  const memory = useMemory()

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  useEffect(() => {
    void window.avri.settings
      .get()
      .then((settings) => {
        setDefaultModel(settings.model)
        setApiKeyStatus(getApiKeyStatus(settings))
      })
      .catch(() => {
        // Let the request itself report a configuration problem.
        setApiKeyStatus('ready')
      })
  }, [])

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsThemeMenuOpen(false)
        themeTriggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isThemeMenuOpen])

  const replaceActiveChat = useCallback(
    (chat: ChatConversation | null) => {
      activeChatRef.current = chat
      setActiveChat(chat)
    },
    [setActiveChat],
  )

  const persistFinishedChat = useCallback(
    (chatId: string) => {
      const current = activeChatRef.current
      if (!current || current.id !== chatId) {
        return
      }

      const cleaned = removeEmptyAssistantMessages(current)
      replaceActiveChat(cleaned)

      void saveChat(cleaned)
        .then((saved) => {
          if (activeChatRef.current?.id === saved.id) {
            activeChatRef.current = saved
          }
        })
        .catch(() => {
          setChatError('Avri could not save this conversation locally.')
        })
    },
    [replaceActiveChat, saveChat],
  )

  const startNewChat = useCallback(() => {
    if (isGenerating) {
      const current = activeChatRef.current
      cancel()
      if (current) {
        void window.avri.chats.save(removeEmptyAssistantMessages(current))
      }
    }

    replaceActiveChat(null)
    setInput('')
    setChatError(null)
    setView('chat')
  }, [cancel, isGenerating, replaceActiveChat])

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || isGenerating || apiKeyStatus === 'missing') {
      return
    }

    setInput('')
    setChatError(null)

    try {
      let chat = activeChatRef.current
      if (!chat) {
        chat = await createChat(defaultModel)
      }

      const existingMessages = removeEmptyAssistantMessages(chat).messages
      const userMessage = createMessage('user', content)
      const isFirstUserMessage = !existingMessages.some(
        (message) => message.role === 'user',
      )
      const pendingChat: ChatConversation = {
        ...chat,
        title: isFirstUserMessage ? createChatTitle(content) : chat.title,
        model: defaultModel,
        messages: [...existingMessages, userMessage],
        updatedAt: new Date().toISOString(),
      }

      const savedChat = await saveChat(pendingChat)
      const assistantMessage = createMessage('assistant', '')
      const streamingChat = {
        ...savedChat,
        messages: [...savedChat.messages, assistantMessage],
      }
      replaceActiveChat(streamingChat)

      const requestId = crypto.randomUUID()
      start(
        {
          requestId,
          chatId: savedChat.id,
          assistantMessageId: assistantMessage.id,
          model: savedChat.model,
          messages: savedChat.messages,
        },
        {
          onChunk: (text) => {
            const current = activeChatRef.current
            if (!current || current.id !== savedChat.id) {
              return
            }

            const updated: ChatConversation = {
              ...current,
              messages: current.messages.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: message.content + text }
                  : message,
              ),
              updatedAt: new Date().toISOString(),
            }
            replaceActiveChat(updated)
          },
          onComplete: () => persistFinishedChat(savedChat.id),
          onCancel: () => persistFinishedChat(savedChat.id),
          onError: (error) => {
            persistFinishedChat(savedChat.id)
            setChatError(error.message)
          },
        },
      )
    } catch {
      setInput(content)
      setChatError('Avri could not save this message locally.')
    }
  }, [
    apiKeyStatus,
    createChat,
    defaultModel,
    input,
    isGenerating,
    persistFinishedChat,
    replaceActiveChat,
    saveChat,
    start,
  ])

  const openChat = async (id: string) => {
    if (isGenerating) {
      cancel()
    }

    try {
      const chat = await loadChat(id)
      if (chat) {
        replaceActiveChat(chat)
        setChatError(null)
        setView('chat')
      }
    } catch {
      setChatError('Avri could not load this conversation.')
    }
  }

  const handleRename = async (id: string, title: string) => {
    try {
      await renameChat(id, title)
    } catch {
      setChatError('Avri could not rename this conversation.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteChat(id)
      if (activeChatRef.current?.id === id) {
        activeChatRef.current = null
      }
    } catch {
      setChatError('Avri could not delete this conversation.')
    }
  }

  const handleSettingsChange = useCallback((settings: AISettingsSummary) => {
    setDefaultModel(settings.model)
    setApiKeyStatus(getApiKeyStatus(settings))
  }, [])

  const selectTheme = (
    nextPreference: ThemePreference,
    shouldRestoreFocus: boolean,
  ) => {
    setPreference(nextPreference)
    setIsThemeMenuOpen(false)

    if (shouldRestoreFocus) {
      themeTriggerRef.current?.focus()
    }
  }

  const pageTitle =
    view === 'history'
      ? 'History'
      : view === 'memory'
        ? 'Memory'
      : view === 'settings'
        ? 'Settings'
        : activeChat?.title || 'New chat'

  return (
    <div className="avri-shell flex h-screen min-h-0 overflow-hidden">
      <aside className="avri-sidebar flex w-[232px] shrink-0 flex-col max-[760px]:w-[72px]">
        <div className="flex h-[68px] shrink-0 items-center gap-3 px-[18px] max-[760px]:justify-center max-[760px]:px-0">
          <div
            aria-hidden="true"
            className="avri-logo flex size-9 shrink-0 items-center justify-center rounded-[12px] text-[14px] font-[600] tracking-[-0.035em]"
          >
            A
          </div>
          <span className="text-[16px] font-[600] tracking-[-0.025em] max-[760px]:hidden">
            Avri
          </span>
        </div>

        <nav aria-label="Primary navigation" className="space-y-1 px-3 pt-1.5">
          <button
            type="button"
            aria-current={view === 'chat' ? 'page' : undefined}
            data-active={view === 'chat'}
            title="New Chat"
            className="avri-nav-item flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-[13.5px] font-[500] focus-visible:outline-none max-[760px]:justify-center max-[760px]:gap-0 max-[760px]:px-0"
            onClick={startNewChat}
          >
            <SquarePen size={16.5} strokeWidth={1.7} aria-hidden="true" />
            <span className="max-[760px]:sr-only">New Chat</span>
          </button>
          <button
            type="button"
            aria-current={view === 'history' ? 'page' : undefined}
            data-active={view === 'history'}
            title="History"
            className="avri-nav-item flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-[13.5px] font-[500] focus-visible:outline-none max-[760px]:justify-center max-[760px]:gap-0 max-[760px]:px-0"
            onClick={() => setView('history')}
          >
            <Clock3 size={16.5} strokeWidth={1.7} aria-hidden="true" />
            <span className="max-[760px]:sr-only">History</span>
          </button>
          <button
            type="button"
            aria-current={view === 'memory' ? 'page' : undefined}
            data-active={view === 'memory'}
            title="Library"
            className="avri-nav-item flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-[13.5px] font-[500] focus-visible:outline-none max-[760px]:justify-center max-[760px]:gap-0 max-[760px]:px-0"
            onClick={() => setView('memory')}
          >
            <Library size={16.5} strokeWidth={1.7} aria-hidden="true" />
            <span className="max-[760px]:sr-only">Library</span>
          </button>
        </nav>

        <div className="mt-auto px-3 pb-5">
          <button
            type="button"
            title="Settings"
            aria-current={view === 'settings' ? 'page' : undefined}
            data-active={view === 'settings'}
            className="avri-nav-item flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-[13.5px] font-[500] focus-visible:outline-none max-[760px]:justify-center max-[760px]:gap-0 max-[760px]:px-0"
            onClick={() => setView('settings')}
          >
            <Settings size={16.5} strokeWidth={1.7} aria-hidden="true" />
            <span className="max-[760px]:sr-only">Settings</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="avri-topbar flex h-[68px] shrink-0 items-center justify-between px-8 max-[760px]:px-5">
          <h1 className="max-w-[60%] truncate text-[13.5px] font-[550] tracking-[-0.01em]">
            {pageTitle}
          </h1>

          <div className="flex items-center gap-1.5">
            <div ref={themeMenuRef} className="relative">
              <button
                ref={themeTriggerRef}
                type="button"
                aria-label="Open appearance settings"
                aria-haspopup="menu"
                aria-expanded={isThemeMenuOpen}
                title="Appearance"
                className={controlClassName}
                onClick={() => setIsThemeMenuOpen((isOpen) => !isOpen)}
              >
                <Settings size={16.5} strokeWidth={1.7} aria-hidden="true" />
              </button>

              {isThemeMenuOpen && (
                <div
                  role="menu"
                  aria-label="Appearance"
                  className="avri-theme-menu absolute right-0 top-11 z-20 w-[176px] rounded-[14px] p-1.5"
                >
                  <p className="avri-theme-label px-2.5 pb-1.5 pt-1 text-[11px] font-[600] uppercase tracking-[0.08em]">
                    Appearance
                  </p>
                  {themeOptions.map(({ label, value, icon: Icon }) => {
                    const isSelected = preference === value

                    return (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        className="avri-theme-option flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-[500] focus-visible:outline-none"
                        onClick={(event) => selectTheme(value, event.detail === 0)}
                      >
                        <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                        <span>{label}</span>
                        <Check
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                          className={`avri-theme-check ml-auto ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        {view === 'chat' ? (
          <ChatView
            messages={activeChat?.messages ?? []}
            input={input}
            error={chatError}
            isGenerating={isGenerating}
            isWaitingForFirstToken={isWaitingForFirstToken}
            memoryProposals={memory.memories.filter(
              (item) => item.sourceChatId === activeChat?.id,
            )}
            needsApiKey={apiKeyStatus === 'missing'}
            onOpenSettings={() => setView('settings')}
            onInputChange={setInput}
            onSend={() => void sendMessage()}
            onStop={cancel}
            onConfirmMemory={memory.confirm}
            onUpdateMemory={memory.update}
            onDismissMemory={memory.dismiss}
          />
        ) : view === 'history' ? (
          <HistoryView
            chats={chats}
            isLoading={isLoading}
            error={storageError}
            onLoad={(id) => void openChat(id)}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ) : view === 'memory' ? (
          <MemoryView
            memories={memory.memories}
            isLoading={memory.isLoading}
            error={memory.error}
            onUpdate={memory.update}
            onConfirm={memory.confirm}
            onDismiss={memory.dismiss}
            onArchive={memory.archive}
            onDelete={memory.remove}
            onClearAll={memory.clearAll}
          />
        ) : (
          <SettingsView onSettingsChange={handleSettingsChange} />
        )}
      </div>
    </div>
  )
}
