import {
  Archive,
  Check,
  ChevronDown,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryEntity,
  type MemoryStatus,
  type UpdateMemoryInput,
} from '../services/memory'
import {
  HighlightedText,
  MEMORY_CATEGORY_PRESENTATION,
  memoryDisplayTitle,
} from './MemoryPresentation'

interface MemoryViewProps {
  memories: MemoryEntity[]
  isLoading: boolean
  error: string | null
  onUpdate(id: string, input: UpdateMemoryInput): Promise<MemoryEntity>
  onConfirm(id: string): Promise<MemoryEntity>
  onDismiss(id: string): Promise<void>
  onArchive(id: string): Promise<MemoryEntity>
  onDelete(id: string): Promise<void>
  onClearAll(): Promise<void>
}

interface EditDraft {
  content: string
  category: MemoryCategory
}

const statusOptions: Array<{ value: MemoryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'proposed', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'archived', label: 'Archived' },
]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function labelFor(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function waitForRemoval(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 170))
}

export function MemoryView({
  memories,
  isLoading,
  error,
  onUpdate,
  onConfirm,
  onDismiss,
  onArchive,
  onDelete,
  onClearAll,
}: MemoryViewProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MemoryCategory | 'all'>('all')
  const [status, setStatus] = useState<MemoryStatus | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [operationError, setOperationError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return memories.filter((memory) => {
      if (category !== 'all' && memory.category !== category) {
        return false
      }
      if (status !== 'all' && memory.status !== status) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      return `${memory.content} ${memory.reason ?? ''} ${memory.category} ${memory.keywords.join(' ')}`
        .toLocaleLowerCase()
        .includes(normalizedSearch)
    })
  }, [category, memories, search, status])

  const groups = useMemo(
    () =>
      MEMORY_CATEGORIES.map((groupCategory) => ({
        category: groupCategory,
        memories: filtered.filter(
          (memory) => memory.category === groupCategory,
        ),
      })).filter((group) => group.memories.length > 0),
    [filtered],
  )

  const setExpanded = (id: string, expanded: boolean) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (expanded) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const beginEdit = (memory: MemoryEntity) => {
    setExpanded(memory.id, true)
    setEditingId(memory.id)
    setDraft({ content: memory.content, category: memory.category })
    setOperationError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }

  const perform = async (id: string, operation: () => Promise<unknown>) => {
    setWorkingId(id)
    setOperationError(null)
    try {
      await operation()
    } catch {
      setOperationError('The memory operation could not be completed.')
    } finally {
      setWorkingId(null)
    }
  }

  const removeWithMotion = async (
    id: string,
    operation: () => Promise<void>,
  ) => {
    setWorkingId(id)
    setOperationError(null)
    setRemovingIds((current) => new Set(current).add(id))
    await waitForRemoval()

    try {
      await operation()
      setExpandedIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      if (editingId === id) {
        cancelEdit()
      }
    } catch {
      setRemovingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setOperationError('The memory operation could not be completed.')
    } finally {
      setWorkingId(null)
    }
  }

  const saveEdit = async (id: string) => {
    if (!draft?.content.trim()) {
      return
    }
    await perform(id, async () => {
      await onUpdate(id, {
        content: draft.content,
        category: draft.category,
      })
      cancelEdit()
    })
  }

  return (
    <main className="avri-view-scroll min-h-0 flex-1 overflow-y-auto px-8 py-10 max-[760px]:px-5">
      <div className="avri-enter mx-auto w-full max-w-[760px]">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[24px] font-[550] tracking-[-0.03em]">Memory</h2>
            <p className="avri-secondary mt-2 text-[13.5px]">
              Review what Avri can remember for future conversations.
            </p>
          </div>

          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="avri-secondary text-[11.5px]">
                Clear all memories?
              </span>
              <button
                type="button"
                className="avri-danger-button rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                onClick={() =>
                  void perform('clear-all', async () => {
                    await onClearAll()
                    setConfirmClear(false)
                    setExpandedIds(new Set())
                  })
                }
              >
                Clear all
              </button>
              <button
                type="button"
                className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                aria-label="Cancel clearing memories"
                onClick={() => setConfirmClear(false)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={memories.length === 0}
              className="avri-secondary-button rounded-[10px] px-3 py-2 text-[12px] font-[550]"
              onClick={() => setConfirmClear(true)}
            >
              Clear memories
            </button>
          )}
        </div>

        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_150px] gap-2 max-[680px]:grid-cols-1">
          <label className="avri-field flex items-center gap-2.5 rounded-[11px] px-3">
            <Search
              size={14.5}
              strokeWidth={1.7}
              aria-hidden="true"
              className="avri-secondary"
            />
            <input
              value={search}
              type="search"
              aria-label="Search memories"
              placeholder="Search memories"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[12.5px] outline-none"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            value={category}
            aria-label="Filter memories by category"
            className="avri-field rounded-[11px] px-3 py-2.5 text-[12.5px] outline-none"
            onChange={(event) =>
              setCategory(event.target.value as MemoryCategory | 'all')
            }
          >
            <option value="all">All categories</option>
            {MEMORY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {MEMORY_CATEGORY_PRESENTATION[item].label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="mb-6 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Memory status filter"
        >
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              data-active={status === option.value}
              className="avri-filter-button rounded-[9px] px-3 py-1.5 text-[11.5px] font-[550]"
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {(error || operationError) && (
          <div
            className="avri-error mb-4 rounded-[12px] px-3.5 py-2.5 text-[12.5px]"
            role="alert"
          >
            {operationError ?? error}
          </div>
        )}

        {isLoading ? (
          <div className="avri-secondary py-12 text-center text-[13.5px]">
            Loading memories…
          </div>
        ) : filtered.length === 0 ? (
          <div className="avri-empty-panel rounded-[16px] px-6 py-14 text-center">
            <p className="text-[14px] font-[500]">No memories found</p>
            <p className="avri-secondary mt-1.5 text-[12.5px]">
              Memory suggestions appear when Avri notices useful long-term context.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => {
              const presentation = MEMORY_CATEGORY_PRESENTATION[group.category]
              const GroupIcon = presentation.icon
              const headingId = `memory-group-${group.category}`

              return (
                <section key={group.category} aria-labelledby={headingId}>
                  <div className="avri-memory-group-heading mb-2.5 flex items-center gap-2 px-1">
                    <GroupIcon size={13.5} strokeWidth={1.7} aria-hidden="true" />
                    <h3
                      id={headingId}
                      className="text-[11px] font-[600] uppercase tracking-[0.065em]"
                    >
                      {presentation.label}
                    </h3>
                    <span className="avri-secondary text-[10.5px]">
                      {group.memories.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.memories.map((memory) => {
                      const isExpanded = expandedIds.has(memory.id)
                      const isEditing = editingId === memory.id && draft
                      const isWorking = workingId === memory.id
                      const isRemoving = removingIds.has(memory.id)
                      const rowId = `memory-details-${memory.id}`
                      const Icon = MEMORY_CATEGORY_PRESENTATION[memory.category].icon

                      return (
                        <article
                          key={memory.id}
                          className="avri-memory-row overflow-hidden rounded-[14px]"
                          data-removing={isRemoving}
                        >
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={rowId}
                            className="avri-memory-row-trigger flex min-h-[62px] w-full items-center gap-3 px-4 py-3 text-left outline-none"
                            onClick={() => setExpanded(memory.id, !isExpanded)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape' && isExpanded) {
                                event.stopPropagation()
                                setExpanded(memory.id, false)
                              }
                            }}
                          >
                            <span className="avri-memory-category-icon flex size-8 shrink-0 items-center justify-center rounded-[10px]">
                              <Icon size={14.5} strokeWidth={1.7} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-[550]">
                                <HighlightedText
                                  text={memoryDisplayTitle(memory)}
                                  query={search}
                                />
                              </span>
                              <time
                                dateTime={memory.updatedAt}
                                className="avri-secondary mt-1 block text-[10.5px]"
                              >
                                Updated {dateFormatter.format(new Date(memory.updatedAt))}
                              </time>
                            </span>
                            <span
                              className="avri-memory-status"
                              data-status={memory.status}
                            >
                              {memory.status === 'proposed'
                                ? 'Pending'
                                : labelFor(memory.status)}
                            </span>
                            <ChevronDown
                              size={14}
                              strokeWidth={1.8}
                              aria-hidden="true"
                              className="avri-memory-chevron"
                              data-expanded={isExpanded}
                            />
                          </button>

                          {isExpanded && (
                            <div
                              id={rowId}
                              className="avri-memory-details px-4 pb-4 pt-1"
                            >
                              {isEditing ? (
                                <form
                                  className="space-y-2.5"
                                  onSubmit={(event) => {
                                    event.preventDefault()
                                    void saveEdit(memory.id)
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                      event.stopPropagation()
                                      cancelEdit()
                                    }
                                  }}
                                >
                                  <textarea
                                    autoFocus
                                    rows={3}
                                    maxLength={500}
                                    value={draft.content}
                                    aria-label="Memory content"
                                    className="avri-field w-full resize-none rounded-[10px] px-3 py-2.5 text-[12.5px] leading-5 outline-none"
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        content: event.target.value,
                                      })
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        void saveEdit(memory.id)
                                      }
                                    }}
                                  />
                                  <select
                                    value={draft.category}
                                    aria-label="Memory category"
                                    className="avri-field w-full rounded-[10px] px-3 py-2.5 text-[12px] outline-none"
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        category: event.target.value as MemoryCategory,
                                      })
                                    }
                                  >
                                    {MEMORY_CATEGORIES.map((item) => (
                                      <option key={item} value={item}>
                                        {MEMORY_CATEGORY_PRESENTATION[item].label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="submit"
                                      disabled={isWorking || !draft.content.trim()}
                                      className="avri-primary-button rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      className="avri-secondary-button rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                      onClick={cancelEdit}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="avri-memory-detail-copy rounded-[11px] px-3 py-2.5">
                                    <p className="text-[12.5px] leading-5.5">
                                      <HighlightedText
                                        text={memory.content}
                                        query={search}
                                      />
                                    </p>
                                    {memory.reason && (
                                      <p className="avri-secondary mt-2 text-[11.5px] leading-5">
                                        <HighlightedText
                                          text={memory.reason}
                                          query={search}
                                        />
                                      </p>
                                    )}
                                  </div>

                                  <div className="avri-secondary mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px]">
                                    <span>{labelFor(memory.importance)} importance</span>
                                    {memory.keywords.length > 0 && (
                                      <>
                                        <span aria-hidden="true">•</span>
                                        <span>
                                          <HighlightedText
                                            text={memory.keywords.join(', ')}
                                            query={search}
                                          />
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {memory.status === 'proposed' && (
                                      <button
                                        type="button"
                                        disabled={isWorking}
                                        className="avri-primary-button inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                        onClick={() =>
                                          void perform(memory.id, () =>
                                            onConfirm(memory.id),
                                          )
                                        }
                                      >
                                        <Check size={13} aria-hidden="true" />
                                        Remember
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      className="avri-secondary-button inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                      onClick={() => beginEdit(memory)}
                                    >
                                      <Pencil size={12.5} aria-hidden="true" />
                                      Edit
                                    </button>
                                    {memory.status === 'proposed' ? (
                                      <button
                                        type="button"
                                        disabled={isWorking}
                                        className="avri-memory-dismiss rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                        onClick={() =>
                                          void removeWithMotion(memory.id, () =>
                                            onDismiss(memory.id),
                                          )
                                        }
                                      >
                                        Dismiss
                                      </button>
                                    ) : memory.status === 'confirmed' ? (
                                      <button
                                        type="button"
                                        disabled={isWorking}
                                        className="avri-secondary-button inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                                        onClick={() =>
                                          void perform(memory.id, () =>
                                            onArchive(memory.id),
                                          )
                                        }
                                      >
                                        <Archive size={12.5} aria-hidden="true" />
                                        Archive
                                      </button>
                                    ) : null}
                                    {memory.status !== 'proposed' && (
                                      <button
                                        type="button"
                                        disabled={isWorking}
                                        aria-label={`Delete ${memoryDisplayTitle(memory)}`}
                                        className="avri-control inline-flex size-8 items-center justify-center rounded-[9px]"
                                        onClick={() =>
                                          void removeWithMotion(memory.id, () =>
                                            onDelete(memory.id),
                                          )
                                        }
                                      >
                                        <Trash2 size={13.5} aria-hidden="true" />
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
