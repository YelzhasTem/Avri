import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AIErrorPayload,
  AIStreamRequest,
} from '../services/ai'

interface StreamCallbacks {
  onChunk(text: string): void
  onComplete(): void
  onCancel(): void
  onError(error: AIErrorPayload): void
}

interface ActiveStream {
  requestId: string
  callbacks: StreamCallbacks
}

export function useAIStream() {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false)
  const activeStreamRef = useRef<ActiveStream | null>(null)
  const pendingTextRef = useRef('')
  const animationFrameRef = useRef<number | null>(null)

  const flushPendingText = useCallback(() => {
    const active = activeStreamRef.current
    const text = pendingTextRef.current
    pendingTextRef.current = ''
    animationFrameRef.current = null

    if (active && text) {
      active.callbacks.onChunk(text)
    }
  }, [])

  useEffect(() => {
    return window.avri.ai.onEvent((event) => {
      const active = activeStreamRef.current
      if (!active || active.requestId !== event.requestId) {
        return
      }

      if (event.type === 'chunk') {
        setIsWaitingForFirstToken(false)
        pendingTextRef.current += event.text

        if (animationFrameRef.current === null) {
          animationFrameRef.current = requestAnimationFrame(flushPendingText)
        }
        return
      }

      if (event.type === 'started') {
        return
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        flushPendingText()
      }

      activeStreamRef.current = null
      setActiveRequestId(null)
      setIsWaitingForFirstToken(false)

      if (event.type === 'completed') {
        active.callbacks.onComplete()
      } else if (event.type === 'cancelled') {
        active.callbacks.onCancel()
      } else {
        active.callbacks.onError(event.error)
      }
    })
  }, [flushPendingText])

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (activeStreamRef.current) {
        window.avri.ai.cancel(activeStreamRef.current.requestId)
      }
    },
    [],
  )

  const start = useCallback(
    (request: AIStreamRequest, callbacks: StreamCallbacks) => {
      if (activeStreamRef.current) {
        window.avri.ai.cancel(activeStreamRef.current.requestId)
      }

      pendingTextRef.current = ''
      activeStreamRef.current = { requestId: request.requestId, callbacks }
      setActiveRequestId(request.requestId)
      setIsWaitingForFirstToken(true)
      window.avri.ai.start(request)
    },
    [],
  )

  const cancel = useCallback(() => {
    const active = activeStreamRef.current
    if (active) {
      window.avri.ai.cancel(active.requestId)
    }
  }, [])

  return {
    start,
    cancel,
    isGenerating: activeRequestId !== null,
    isWaitingForFirstToken,
  }
}

