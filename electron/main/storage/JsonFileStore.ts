import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

interface JsonFileStoreOptions<T> {
  validate?(value: unknown): value is T
  preserveCorruptedFile?: boolean
  onCorruption?(backupPath: string | null): void
}

export class JsonFileStore<T> {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly createInitialValue: () => T,
    private readonly options: JsonFileStoreOptions<T> = {},
  ) {}

  async read(): Promise<T> {
    await this.writeQueue
    return this.readUnsafe()
  }

  async update(mutator: (value: T) => T): Promise<T> {
    let result: T | undefined

    const operation = this.writeQueue.then(async () => {
      const current = await this.readUnsafe()
      result = mutator(current)
      await this.writeUnsafe(result)
    })

    this.writeQueue = operation.catch(() => undefined)
    await operation

    if (result === undefined) {
      throw new Error('The local store could not be updated.')
    }

    return result
  }

  private async readUnsafe(): Promise<T> {
    let serialized: string

    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return this.createInitialValue()
      }

      throw error
    }

    try {
      const parsed: unknown = JSON.parse(serialized)
      if (this.options.validate && !this.options.validate(parsed)) {
        throw new SyntaxError('The local store has an invalid structure.')
      }

      return parsed as T
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }

      const backupPath = this.options.preserveCorruptedFile
        ? await this.preserveCorruptedFile()
        : null
      this.options.onCorruption?.(backupPath)
      return this.createInitialValue()
    }
  }

  private async preserveCorruptedFile(): Promise<string | null> {
    const backupPath = `${this.filePath}.corrupt-${Date.now()}.bak`

    try {
      await rename(this.filePath, backupPath)
      return backupPath
    } catch {
      return null
    }
  }

  private async writeUnsafe(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })

    const temporaryPath = `${this.filePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rename(temporaryPath, this.filePath)
  }
}
