import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { ChatSummary } from '../services/chat'

interface HistoryViewProps {
  chats: ChatSummary[]
  isLoading: boolean
  error: string | null
  onLoad(id: string): void
  onRename(id: string, title: string): Promise<void>
  onDelete(id: string): Promise<void>
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function HistoryView({
  chats,
  isLoading,
  error,
  onLoad,
  onRename,
  onDelete,
}: HistoryViewProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const beginRename = (chat: ChatSummary) => {
    setDeleteId(null)
    setRenamingId(chat.id)
    setRenameValue(chat.title)
  }

  const finishRename = async () => {
    if (!renamingId || !renameValue.trim()) {
      return
    }

    await onRename(renamingId, renameValue)
    setRenamingId(null)
  }

  return (
    <main className="avri-view-scroll min-h-0 flex-1 overflow-y-auto px-8 py-10 max-[760px]:px-5">
      <div className="avri-enter mx-auto w-full max-w-[760px]">
        <div className="mb-8">
          <h2 className="text-[24px] font-[550] tracking-[-0.03em]">History</h2>
          <p className="avri-secondary mt-2 text-[13.5px]">
            Your conversations are stored locally on this device.
          </p>
        </div>

        {error && (
          <div className="avri-error mb-4 rounded-[12px] px-3.5 py-2.5 text-[12.5px]">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="avri-secondary py-12 text-center text-[13.5px]">
            Loading chats…
          </div>
        ) : chats.length === 0 ? (
          <div className="avri-empty-panel rounded-[16px] px-6 py-14 text-center">
            <p className="text-[14px] font-[500]">No conversations yet</p>
            <p className="avri-secondary mt-1.5 text-[12.5px]">
              Your chats will appear here after you send a message.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="avri-history-row flex min-h-[62px] items-center gap-3 rounded-[14px] px-4 py-2.5"
              >
                {renamingId === chat.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void finishRename()
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      aria-label="Chat title"
                      maxLength={80}
                      className="avri-field min-w-0 flex-1 rounded-[10px] px-3 py-2 text-[13.5px] outline-none"
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setRenamingId(null)
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                      aria-label="Save chat title"
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                      aria-label="Cancel rename"
                      onClick={() => setRenamingId(null)}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left outline-none"
                      onClick={() => onLoad(chat.id)}
                    >
                      <span className="block truncate text-[13.5px] font-[500]">
                        {chat.title}
                      </span>
                      <span className="avri-secondary mt-1 block text-[11.5px]">
                        {dateFormatter.format(new Date(chat.updatedAt))}
                      </span>
                    </button>

                    {deleteId === chat.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="avri-secondary mr-1 text-[11.5px]">Delete?</span>
                        <button
                          type="button"
                          className="avri-danger-button rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-[550]"
                          onClick={() => void onDelete(chat.id)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                          aria-label="Cancel delete"
                          onClick={() => setDeleteId(null)}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="avri-row-actions flex items-center gap-1">
                        <button
                          type="button"
                          className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                          aria-label={`Rename ${chat.title}`}
                          onClick={() => beginRename(chat)}
                        >
                          <Pencil size={14.5} strokeWidth={1.7} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="avri-control inline-flex size-8 items-center justify-center rounded-[10px]"
                          aria-label={`Delete ${chat.title}`}
                          onClick={() => {
                            setRenamingId(null)
                            setDeleteId(chat.id)
                          }}
                        >
                          <Trash2 size={14.5} strokeWidth={1.7} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

