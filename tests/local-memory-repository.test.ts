import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalMemoryRepository } from '../electron/main/memory/LocalMemoryRepository'

const temporaryDirectories: string[] = []

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'avri-memory-test-'))
  temporaryDirectories.push(directory)
  const filePath = join(directory, 'memories.json')
  return { directory, filePath, repository: new LocalMemoryRepository(filePath) }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('local memory lifecycle', () => {
  it('confirms proposals and supports archive and delete behavior', async () => {
    const { repository } = await createRepository()
    const proposal = await repository.createProposal({
      content: 'I am building Avri with Electron and React.',
      category: 'project',
      importance: 'high',
      keywords: ['avri', 'electron', 'react'],
      sourceChatId: 'chat-1',
      sourceMessageId: 'message-1',
    })

    expect(proposal.status).toBe('proposed')
    expect((await repository.confirm(proposal.id)).status).toBe('confirmed')
    expect((await repository.archive(proposal.id)).status).toBe('archived')

    await repository.delete(proposal.id)
    expect(await repository.get(proposal.id)).toBeNull()
  })

  it('dismisses a proposal without retaining it', async () => {
    const { repository } = await createRepository()
    const proposal = await repository.createProposal({
      content: 'I prefer concise answers.',
      category: 'preference',
      importance: 'medium',
      keywords: ['concise'],
      sourceChatId: 'chat-1',
    })

    await repository.dismiss(proposal.id)
    expect(await repository.list()).toEqual([])
  })
})

describe('local memory storage recovery', () => {
  it('backs up a corrupted file and recovers with an empty store', async () => {
    const { directory, filePath, repository } = await createRepository()
    await writeFile(filePath, '{invalid-json', 'utf8')

    expect(await repository.list()).toEqual([])
    const files = await readdir(directory)
    expect(
      files.some((file) =>
        file.startsWith('memories.json.corrupt-') && file.endsWith('.bak'),
      ),
    ).toBe(true)
  })
})
