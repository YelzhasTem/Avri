import type { AISettingsSummary } from './types'

export type ApiKeyStatus = 'checking' | 'missing' | 'ready'

export function hasConfiguredApiKey(
  settings: Pick<AISettingsSummary, 'hasUserApiKey' | 'hasEnvironmentApiKey'>,
): boolean {
  return settings.hasUserApiKey || settings.hasEnvironmentApiKey
}

export function getApiKeyStatus(
  settings: Pick<AISettingsSummary, 'hasUserApiKey' | 'hasEnvironmentApiKey'>,
): ApiKeyStatus {
  return hasConfiguredApiKey(settings) ? 'ready' : 'missing'
}
