import { useCallback, useEffect, useState } from 'react'
import type {
  MemoryEntity,
  MemoryListQuery,
  UpdateMemoryInput,
} from '../services/memory'

function sortMemories(memories: MemoryEntity[]): MemoryEntity[] {
  return [...memories].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

export function useMemory() {
  const [memories, setMemories] = useState<MemoryEntity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setMemories(await window.avri.memory.list())
      setError(null)
    } catch {
      setError('Avri could not load local memories.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(
    () =>
      window.avri.memory.onProposal((event) => {
        if (event.type === 'proposed') {
          console.debug('[Avri Memory] Renderer received proposal event.', {
            memoryId: event.memory.id,
            sourceChatId: event.memory.sourceChatId,
            sourceMessageId: event.memory.sourceMessageId,
          })
          setMemories((current) => {
            const next = sortMemories([
              event.memory,
              ...current.filter((memory) => memory.id !== event.memory.id),
            ])
            console.debug('[Avri Memory] React memory state updated.', {
              memoryId: event.memory.id,
              memoryCount: next.length,
            })
            return next
          })
        }
      }),
    [],
  )

  const replaceMemory = useCallback((memory: MemoryEntity) => {
    setMemories((current) =>
      sortMemories(
        current.map((item) => (item.id === memory.id ? memory : item)),
      ),
    )
    return memory
  }, [])

  const search = useCallback((query: MemoryListQuery) => {
    return window.avri.memory.list(query)
  }, [])

  const update = useCallback(
    async (id: string, input: UpdateMemoryInput) => {
      const memory = await window.avri.memory.update(id, input)
      return replaceMemory(memory)
    },
    [replaceMemory],
  )

  const confirm = useCallback(
    async (id: string) => replaceMemory(await window.avri.memory.confirm(id)),
    [replaceMemory],
  )

  const dismiss = useCallback(async (id: string) => {
    await window.avri.memory.dismiss(id)
    setMemories((current) => current.filter((memory) => memory.id !== id))
  }, [])

  const archive = useCallback(
    async (id: string) => replaceMemory(await window.avri.memory.archive(id)),
    [replaceMemory],
  )

  const remove = useCallback(async (id: string) => {
    await window.avri.memory.delete(id)
    setMemories((current) => current.filter((memory) => memory.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    await window.avri.memory.clearAll()
    setMemories([])
  }, [])

  return {
    memories,
    isLoading,
    error,
    refresh,
    search,
    update,
    confirm,
    dismiss,
    archive,
    remove,
    clearAll,
  }
}
