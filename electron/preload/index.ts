import { contextBridge, ipcRenderer } from 'electron'
import type { AIStreamEvent, AIStreamRequest } from '../../src/services/ai'
import type { AvriBridge } from '../../src/services/bridge'
import type {
  ChatConversation,
  ChatSummary,
  CreateChatInput,
  SaveChatInput,
} from '../../src/services/chat'
import type {
  AISettingsSummary,
  TestConnectionInput,
  UpdateAISettingsInput,
} from '../../src/services/settings'
import type {
  MemoryEntity,
  MemoryListQuery,
  MemoryProposalEvent,
  UpdateMemoryInput,
} from '../../src/services/memory'
import { IPC_CHANNELS } from '../shared/channels'

const bridge: AvriBridge = {
  ai: {
    start(request: AIStreamRequest): void {
      ipcRenderer.send(IPC_CHANNELS.aiStart, request)
    },
    cancel(requestId: string): void {
      ipcRenderer.send(IPC_CHANNELS.aiCancel, requestId)
    },
    onEvent(listener: (event: AIStreamEvent) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, payload: AIStreamEvent) => {
        listener(payload)
      }

      ipcRenderer.on(IPC_CHANNELS.aiEvent, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiEvent, handler)
    },
  },
  chats: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.chatsList) as Promise<ChatSummary[]>,
    get: (id: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.chatsGet,
        id,
      ) as Promise<ChatConversation | null>,
    create: (input: CreateChatInput) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.chatsCreate,
        input,
      ) as Promise<ChatConversation>,
    save: (input: SaveChatInput) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.chatsSave,
        input,
      ) as Promise<ChatConversation>,
    rename: (id: string, title: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.chatsRename,
        id,
        title,
      ) as Promise<ChatConversation>,
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.chatsDelete, id) as Promise<void>,
  },
  settings: {
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<AISettingsSummary>,
    update: (input: UpdateAISettingsInput) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.settingsUpdate,
        input,
      ) as Promise<AISettingsSummary>,
    test: (input: TestConnectionInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsTest, input),
  },
  memory: {
    list: (query?: MemoryListQuery) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.memoryList,
        query,
      ) as Promise<MemoryEntity[]>,
    get: (id: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.memoryGet,
        id,
      ) as Promise<MemoryEntity | null>,
    update: (id: string, input: UpdateMemoryInput) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.memoryUpdate,
        id,
        input,
      ) as Promise<MemoryEntity>,
    confirm: (id: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.memoryConfirm,
        id,
      ) as Promise<MemoryEntity>,
    dismiss: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.memoryDismiss, id) as Promise<void>,
    archive: (id: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.memoryArchive,
        id,
      ) as Promise<MemoryEntity>,
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.memoryDelete, id) as Promise<void>,
    clearAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.memoryClearAll) as Promise<void>,
    onProposal(listener: (event: MemoryProposalEvent) => void): () => void {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: MemoryProposalEvent,
      ) => {
        console.debug('[Avri Memory] Preload received proposal IPC event.', {
          memoryId: payload.memory.id,
          sourceChatId: payload.memory.sourceChatId,
          sourceMessageId: payload.memory.sourceMessageId,
        })
        listener(payload)
      }

      ipcRenderer.on(IPC_CHANNELS.memoryEvent, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.memoryEvent, handler)
    },
  },
}

contextBridge.exposeInMainWorld('avri', bridge)
