export const MEMORY_CATEGORIES = [
  'personal',
  'preference',
  'project',
  'goal',
  'workflow',
  'instruction',
  'other',
] as const

export const MEMORY_STATUSES = ['proposed', 'confirmed', 'archived'] as const
export const MEMORY_IMPORTANCE_LEVELS = ['low', 'medium', 'high'] as const
export const MEMORY_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]
export type MemoryStatus = (typeof MEMORY_STATUSES)[number]
export type MemoryImportance = (typeof MEMORY_IMPORTANCE_LEVELS)[number]
export type MemoryConfidence = (typeof MEMORY_CONFIDENCE_LEVELS)[number]

export interface MemoryEntity {
  id: string
  content: string
  category: MemoryCategory
  createdAt: string
  updatedAt: string
  sourceChatId: string
  sourceMessageId?: string
  status: MemoryStatus
  importance: MemoryImportance
  keywords: string[]
  reason?: string
}

export interface MemoryProposalInput {
  content: string
  category: MemoryCategory
  importance: MemoryImportance
  keywords: string[]
  sourceChatId: string
  sourceMessageId?: string
  reason?: string
}

export interface UpdateMemoryInput {
  content?: string
  category?: MemoryCategory
  importance?: MemoryImportance
  keywords?: string[]
}

export interface MemoryListQuery {
  search?: string
  category?: MemoryCategory | 'all'
  status?: MemoryStatus | 'all'
}

export interface MemoryExtractionResult {
  shouldPropose: boolean
  content: string
  category: MemoryCategory
  importance: MemoryImportance
  confidence: MemoryConfidence
  reason: string
  keywords: string[]
}

export interface MemoryContextResult {
  memories: MemoryEntity[]
  systemContext: string
}

export interface MemoryProposalEvent {
  type: 'proposed'
  memory: MemoryEntity
}

export type SecretKind =
  | 'api-key'
  | 'authentication-token'
  | 'password'
  | 'private-key'
  | 'seed-phrase'
  | 'financial-credential'
  | 'government-identifier'
  | 'highly-sensitive-personal'

export interface SecretDetectionResult {
  detected: boolean
  kinds: SecretKind[]
}

export type MemoryValidationResult =
  | { ok: true; value: Omit<MemoryProposalInput, 'sourceChatId' | 'sourceMessageId'> }
  | { ok: false; reason: string }
