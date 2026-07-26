import { Check, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryEntity,
  type UpdateMemoryInput,
} from '../services/memory'
import { MemoryPreview } from './MemoryPresentation'

export type MemoryProposalDisplayState =
  | 'proposal'
  | 'remembered'
  | 'exiting'

interface MemoryProposalCardProps {
  memory: MemoryEntity
  displayState?: MemoryProposalDisplayState
  onConfirm(id: string): Promise<MemoryEntity>
  onUpdate(id: string, input: UpdateMemoryInput): Promise<MemoryEntity>
  onDismiss(id: string): Promise<void>
}

function labelFor(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function waitForExit(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 170))
}

export function MemoryProposalCard({
  memory,
  displayState = 'proposal',
  onConfirm,
  onUpdate,
  onDismiss,
}: MemoryProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(memory.content)
  const [category, setCategory] = useState<MemoryCategory>(memory.category)
  const [isWorking, setIsWorking] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) {
      setContent(memory.content)
      setCategory(memory.category)
    }
  }, [isEditing, memory.category, memory.content])

  const cancelEdit = () => {
    setContent(memory.content)
    setCategory(memory.category)
    setIsEditing(false)
    setError(null)
  }

  const saveEdit = async () => {
    if (!content.trim()) {
      return
    }

    setIsWorking(true)
    setError(null)
    try {
      await onUpdate(memory.id, { content, category })
      setIsEditing(false)
    } catch {
      setError('I couldn’t update this memory suggestion.')
    } finally {
      setIsWorking(false)
    }
  }

  const remember = async () => {
    setIsWorking(true)
    setError(null)
    try {
      await onConfirm(memory.id)
    } catch {
      setError('I couldn’t remember this right now.')
    } finally {
      setIsWorking(false)
    }
  }

  const dismiss = async () => {
    setIsWorking(true)
    setIsDismissing(true)
    setError(null)
    await waitForExit()
    try {
      await onDismiss(memory.id)
    } catch {
      setError('I couldn’t dismiss this suggestion.')
      setIsDismissing(false)
      setIsWorking(false)
    }
  }

  if (displayState === 'remembered' || displayState === 'exiting') {
    return (
      <aside
        className="avri-memory-proposal avri-memory-remembered ml-0 max-w-[620px] rounded-[14px] px-4 py-3.5"
        data-state={displayState}
        role="status"
        aria-live="polite"
        aria-label="Memory remembered"
      >
        <span className="avri-memory-success-icon flex size-7 items-center justify-center rounded-full">
          <Check size={15} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="text-[12.5px] font-[600]">Remembered</span>
      </aside>
    )
  }

  const previewMemory = { ...memory, content, category }

  return (
    <aside
      className="avri-memory-proposal ml-0 max-w-[620px] rounded-[14px] p-4"
      data-state={isDismissing ? 'exiting' : 'proposal'}
      aria-label="Memory proposal"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isEditing) {
          event.stopPropagation()
          cancelEdit()
        }
      }}
    >
      <p className="text-[12.5px] font-[600] tracking-[-0.01em]">
        Would you like me to remember this?
      </p>

      {isEditing ? (
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(event) => {
            event.preventDefault()
            void saveEdit()
          }}
        >
          <textarea
            autoFocus
            rows={2}
            value={content}
            maxLength={500}
            aria-label="Edit memory content"
            className="avri-field w-full resize-none rounded-[10px] px-3 py-2.5 text-[12.5px] leading-5 outline-none"
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void saveEdit()
              }
            }}
          />
          <select
            value={category}
            aria-label="Memory category"
            className="avri-field w-full rounded-[10px] px-3 py-2.5 text-[12px] outline-none"
            onChange={(event) =>
              setCategory(event.target.value as MemoryCategory)
            }
          >
            {MEMORY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {labelFor(item)}
              </option>
            ))}
          </select>
          {error && (
            <p className="avri-status-error text-[11.5px]" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={isWorking || !content.trim()}
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
          <div className="mt-3">
            <MemoryPreview memory={previewMemory} />
          </div>

          {memory.reason && (
            <p className="avri-secondary mt-2.5 text-[11.5px] leading-[1.55]">
              {memory.reason}
            </p>
          )}

          {error && (
            <p className="avri-status-error mt-2 text-[11.5px]" role="alert">
              {error}
            </p>
          )}

          <div className="mt-3.5 flex items-center gap-1.5">
            <button
              type="button"
              disabled={isWorking}
              className="avri-primary-button inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
              onClick={() => void remember()}
            >
              <Check size={13} strokeWidth={2} aria-hidden="true" />
              Remember
            </button>
            <button
              type="button"
              disabled={isWorking}
              className="avri-secondary-button inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
              onClick={() => {
                setError(null)
                setIsEditing(true)
              }}
            >
              <Pencil size={12.5} strokeWidth={1.8} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              disabled={isWorking}
              className="avri-memory-dismiss inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
              onClick={() => void dismiss()}
            >
              <X size={13} strokeWidth={1.9} aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
