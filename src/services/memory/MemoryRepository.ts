import type {
  MemoryEntity,
  MemoryListQuery,
  MemoryProposalInput,
  UpdateMemoryInput,
} from './types'

export interface MemoryRepository {
  list(query?: MemoryListQuery): Promise<MemoryEntity[]>
  get(id: string): Promise<MemoryEntity | null>
  createProposal(input: MemoryProposalInput): Promise<MemoryEntity>
  update(id: string, input: UpdateMemoryInput): Promise<MemoryEntity>
  confirm(id: string): Promise<MemoryEntity>
  dismiss(id: string): Promise<void>
  archive(id: string): Promise<MemoryEntity>
  delete(id: string): Promise<void>
  clearAll(): Promise<void>
}

