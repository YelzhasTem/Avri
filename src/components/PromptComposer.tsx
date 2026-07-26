import { ArrowUp, Mic, Paperclip, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface PromptComposerProps {
  value: string
  isGenerating: boolean
  onChange(value: string): void
  onSend(): void
  onStop(): void
}

const controlClassName =
  'avri-control inline-flex size-[34px] shrink-0 items-center justify-center rounded-[11px] focus-visible:outline-none'

export function PromptComposer({
  value,
  isGenerating,
  onChange,
  onSend,
  onStop,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [value])

  return (
    <div className="shrink-0 px-8 pb-7 max-[760px]:px-5 max-[760px]:pb-5">
      <div className="avri-prompt mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-[18px] p-2.5">
        <button
          type="button"
          aria-label="Attach a file"
          title="Attach"
          disabled
          className={controlClassName}
        >
          <Paperclip size={16.5} strokeWidth={1.7} aria-hidden="true" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          aria-label="Message Avri"
          placeholder="Ask Avri anything..."
          className="avri-textarea min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-2 text-[14.5px] leading-6 outline-none"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onSend()
            }
          }}
        />

        <button
          type="button"
          aria-label="Use microphone"
          title="Microphone"
          disabled
          className={controlClassName}
        >
          <Mic size={16.5} strokeWidth={1.7} aria-hidden="true" />
        </button>

        {isGenerating ? (
          <button
            type="button"
            aria-label="Stop generation"
            title="Stop"
            className="avri-send inline-flex size-[38px] shrink-0 items-center justify-center rounded-[13px] focus-visible:outline-none"
            onClick={onStop}
          >
            <Square size={13} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send message"
            title="Send"
            disabled={!value.trim()}
            className="avri-send inline-flex size-[38px] shrink-0 items-center justify-center rounded-[13px] focus-visible:outline-none"
            onClick={onSend}
          >
            <ArrowUp size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

