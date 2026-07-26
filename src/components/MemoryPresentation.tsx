import {
  Brain,
  FolderKanban,
  Languages,
  ListChecks,
  Palette,
  SlidersHorizontal,
  Target,
  UserRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { MemoryCategory, MemoryEntity } from '../services/memory'

export const MEMORY_CATEGORY_PRESENTATION: Record<
  MemoryCategory,
  { label: string; icon: LucideIcon }
> = {
  personal: { label: 'Personal', icon: UserRound },
  preference: { label: 'Preferences', icon: SlidersHorizontal },
  project: { label: 'Projects', icon: FolderKanban },
  goal: { label: 'Goals', icon: Target },
  workflow: { label: 'Workflows', icon: Workflow },
  instruction: { label: 'Instructions', icon: ListChecks },
  other: { label: 'Other', icon: Brain },
}

export interface StructuredMemoryPreview {
  label: string
  value: string
  icon: LucideIcon
}

function cleanValue(value: string): string {
  const cleaned = value.trim().replace(/[.!?]+$/, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

function matchValue(content: string, pattern: RegExp): string | null {
  const match = content.trim().match(pattern)
  return match?.[1] ? cleanValue(match[1]) : null
}

export function getStructuredMemoryPreview(
  memory: Pick<MemoryEntity, 'content'>,
): StructuredMemoryPreview | null {
  const content = memory.content
  const name = matchValue(
    content,
    /^(?:the user(?:'s|’s)|your|my)\s+name\s+is\s+(.+?)[.!?]*$/i,
  )
  if (name) {
    return { label: 'Name', value: name, icon: UserRound }
  }

  const favoriteColor = matchValue(
    content,
    /^(?:the user(?:'s|’s)|your|my)\s+favorite\s+colou?r\s+is\s+(.+?)[.!?]*$/i,
  )
  if (favoriteColor) {
    return { label: 'Favorite color', value: favoriteColor, icon: Palette }
  }

  const language =
    matchValue(
      content,
      /^(?:the user(?:'s|’s)|your|my)\s+preferred\s+language\s+is\s+(.+?)[.!?]*$/i,
    ) ??
    matchValue(
      content,
      /^(?:the user|you|i)\s+prefers?\s+to\s+(?:speak|communicate in)\s+(.+?)[.!?]*$/i,
    )
  if (language) {
    return { label: 'Preferred language', value: language, icon: Languages }
  }

  const project =
    matchValue(
      content,
      /^(?:the user(?:'s|’s)|your|my)\s+(?:current|ongoing)\s+project\s+is\s+(.+?)[.!?]*$/i,
    ) ??
    matchValue(
      content,
      /^(?:the user is|you are|i am|i'm)\s+(?:building|developing|working on)\s+(.+?)[.!?]*$/i,
    )
  if (project) {
    return { label: 'Current project', value: project, icon: FolderKanban }
  }

  const answerStyle =
    matchValue(
      content,
      /^(?:the user(?:'s|’s)|your|my)\s+preferred\s+answer\s+style\s+is\s+(.+?)[.!?]*$/i,
    ) ??
    matchValue(
      content,
      /^(?:the user|you|i)\s+prefers?\s+(.+?)[.!?]*$/i,
    )?.replace(/\s+(?:answers?|responses?)$/i, '') ?? null
  if (answerStyle) {
    return {
      label: 'Preferred answer style',
      value: cleanValue(answerStyle),
      icon: SlidersHorizontal,
    }
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}): ReactNode {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))]
  if (terms.length === 0) {
    return text
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  const normalizedTerms = new Set(terms.map((term) => term.toLocaleLowerCase()))

  return text.split(pattern).map((part, index) =>
    normalizedTerms.has(part.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`} className="avri-memory-highlight">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function memoryDisplayTitle(memory: MemoryEntity): string {
  const preview = getStructuredMemoryPreview(memory)
  return preview ? `${preview.label}: ${preview.value}` : memory.content
}

export function MemoryPreview({
  memory,
  query = '',
}: {
  memory: MemoryEntity
  query?: string
}) {
  const preview = getStructuredMemoryPreview(memory)

  if (!preview) {
    return (
      <p className="avri-memory-preview-fallback text-[13px] leading-5.5">
        <HighlightedText text={memory.content} query={query} />
      </p>
    )
  }

  const Icon = preview.icon
  return (
    <div className="avri-memory-preview flex items-center gap-3 rounded-[12px] px-3 py-2.5">
      <span className="avri-memory-preview-icon flex size-8 shrink-0 items-center justify-center rounded-[10px]">
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="avri-secondary text-[10.5px] font-[550]">
          <HighlightedText text={preview.label} query={query} />
        </p>
        <p className="mt-0.5 truncate text-[13px] font-[550]">
          <HighlightedText text={preview.value} query={query} />
        </p>
      </div>
    </div>
  )
}
