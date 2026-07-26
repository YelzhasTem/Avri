import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../services/ai'
import type { MemoryEntity, UpdateMemoryInput } from '../services/memory'
import {
  MemoryProposalCard,
  type MemoryProposalDisplayState,
} from './MemoryProposalCard'
import { PromptComposer } from './PromptComposer'

interface ChatViewProps {
  messages: ChatMessage[]
  input: string
  error: string | null
  isGenerating: boolean
  isWaitingForFirstToken: boolean
  memoryProposals: MemoryEntity[]
  onInputChange(value: string): void
  onSend(): void
  onStop(): void
  onConfirmMemory(id: string): Promise<MemoryEntity>
  onUpdateMemory(id: string, input: UpdateMemoryInput): Promise<MemoryEntity>
  onDismissMemory(id: string): Promise<void>
}

export function ChatView({
  messages,
  input,
  error,
  isGenerating,
  isWaitingForFirstToken,
  memoryProposals,
  onInputChange,
  onSend,
  onStop,
  onConfirmMemory,
  onUpdateMemory,
  onDismissMemory,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLElement>(null)
  const feedbackTimersRef = useRef<number[]>([])
  const [proposalStates, setProposalStates] = useState<
    Record<string, 'saving' | 'remembered' | 'exiting'>
  >({})
  const visibleMessages = messages.filter(
    (message) => message.role !== 'system' && message.content,
  )
  const displayedProposals = memoryProposals.filter(
    (memory) => memory.status === 'proposed' || proposalStates[memory.id],
  )
  const visibleProposalSignature = displayedProposals
    .map((memory) => `${memory.id}:${proposalStates[memory.id] ?? 'proposal'}`)
    .sort()
    .join(':')

  useEffect(
    () => () => {
      feedbackTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  const confirmMemory = useCallback(
    async (id: string) => {
      setProposalStates((current) => ({ ...current, [id]: 'saving' }))
      try {
        const confirmed = await onConfirmMemory(id)
        setProposalStates((current) => ({ ...current, [id]: 'remembered' }))

        feedbackTimersRef.current.push(
          window.setTimeout(() => {
            setProposalStates((current) => ({ ...current, [id]: 'exiting' }))
          }, 1_750),
          window.setTimeout(() => {
            setProposalStates((current) => {
              const next = { ...current }
              delete next[id]
              return next
            })
          }, 2_000),
        )
        return confirmed
      } catch (error) {
        setProposalStates((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        throw error
      }
    },
    [onConfirmMemory],
  )

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, isWaitingForFirstToken, visibleProposalSignature])

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {visibleMessages.length === 0 && !isGenerating ? (
        <section className="flex min-h-[210px] flex-1 items-center justify-center overflow-y-auto px-6 pb-10 pt-20 max-[760px]:pb-8 max-[760px]:pt-14">
          <div className="avri-enter max-w-xl text-center">
            <h2 className="text-[31px] font-[550] leading-tight tracking-[-0.036em] max-[760px]:text-[28px]">
              Hi, I&apos;m Avri.
            </h2>
            <p className="avri-secondary mt-3.5 text-[16.5px] font-[400] tracking-[-0.015em] max-[760px]:text-[15px]">
              What can I help with today?
            </p>
          </div>
        </section>
      ) : (
        <section
          ref={scrollRef}
          className="avri-chat-scroll min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-10 max-[760px]:px-5"
        >
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-7">
            {visibleMessages.map((message) => (
              <Fragment key={message.id}>
                <article
                  data-role={message.role}
                  className="avri-message avri-enter text-[14.5px] leading-7"
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </article>
                {message.role === 'assistant' &&
                  displayedProposals
                    .filter(
                      (memory) =>
                        memory.sourceMessageId === message.id,
                    )
                    .map((memory) => (
                      <MemoryProposalCard
                        key={memory.id}
                        memory={memory}
                        displayState={
                          (proposalStates[memory.id] === 'remembered' ||
                          proposalStates[memory.id] === 'exiting'
                            ? proposalStates[memory.id]
                            : 'proposal') as MemoryProposalDisplayState
                        }
                        onConfirm={confirmMemory}
                        onUpdate={onUpdateMemory}
                        onDismiss={onDismissMemory}
                      />
                    ))}
              </Fragment>
            ))}

            {isWaitingForFirstToken && (
              <div className="avri-typing" role="status" aria-label="Avri is thinking">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="avri-error mx-auto mb-3 w-[calc(100%-64px)] max-w-[760px] rounded-[12px] px-3.5 py-2.5 text-[12.5px] max-[760px]:w-[calc(100%-40px)]">
          {error}
        </div>
      )}

      <PromptComposer
        value={input}
        isGenerating={isGenerating}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
      />
    </main>
  )
}
