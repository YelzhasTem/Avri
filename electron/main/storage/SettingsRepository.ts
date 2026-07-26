import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
} from '../../../src/services/ai'
import type {
  AISettingsSummary,
  UpdateAISettingsInput,
} from '../../../src/services/settings'
import { safeStorage } from 'electron'
import { JsonFileStore } from './JsonFileStore'

interface SettingsStoreData {
  version: 1
  model: string
  userApiKey?: string
}

function createDefaultSettings(): SettingsStoreData {
  return {
    version: 1,
    model: DEFAULT_GEMINI_MODEL,
  }
}

function normalizeModel(model: string): string {
  return GEMINI_MODELS.some((option) => option.id === model)
    ? model
    : DEFAULT_GEMINI_MODEL
}

export class SettingsRepository {
  private readonly store: JsonFileStore<SettingsStoreData>

  constructor(
    filePath: string,
    private readonly getEnvironmentApiKey: () => string | undefined,
  ) {
    this.store = new JsonFileStore(filePath, createDefaultSettings)
  }

  async getSummary(): Promise<AISettingsSummary> {
    const settings = await this.store.read()

    return {
      model: normalizeModel(settings.model),
      hasUserApiKey: Boolean(this.decryptApiKey(settings.userApiKey)),
      hasEnvironmentApiKey: Boolean(this.getEnvironmentApiKey()?.trim()),
    }
  }

  async getResolvedApiKey(): Promise<string | undefined> {
    const settings = await this.store.read()
    return (
      this.decryptApiKey(settings.userApiKey) ||
      this.getEnvironmentApiKey()?.trim()
    )
  }

  async update(input: UpdateAISettingsInput): Promise<AISettingsSummary> {
    await this.store.update((settings) => {
      const next: SettingsStoreData = {
        ...settings,
        model: normalizeModel(input.model),
      }

      if (input.clearApiKey) {
        delete next.userApiKey
      } else if (input.apiKey?.trim()) {
        next.userApiKey = this.encryptApiKey(input.apiKey.trim())
      }

      return next
    })

    return this.getSummary()
  }

  private encryptApiKey(apiKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable.')
    }

    return `encrypted:${safeStorage.encryptString(apiKey).toString('base64')}`
  }

  private decryptApiKey(value: string | undefined): string | undefined {
    if (!value) {
      return undefined
    }

    if (!value.startsWith('encrypted:')) {
      return value.trim() || undefined
    }

    try {
      const encrypted = Buffer.from(value.slice('encrypted:'.length), 'base64')
      return safeStorage.decryptString(encrypted).trim() || undefined
    } catch {
      return undefined
    }
  }
}
