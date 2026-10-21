import { describe, expect, it } from 'vitest'
import { getApiKeyStatus, hasConfiguredApiKey } from '../src/services/settings'

describe('API key status', () => {
  it('is missing when neither a saved nor an environment key exists', () => {
    const settings = { hasUserApiKey: false, hasEnvironmentApiKey: false }

    expect(hasConfiguredApiKey(settings)).toBe(false)
    expect(getApiKeyStatus(settings)).toBe('missing')
  })

  it.each([
    { hasUserApiKey: true, hasEnvironmentApiKey: false },
    { hasUserApiKey: false, hasEnvironmentApiKey: true },
    { hasUserApiKey: true, hasEnvironmentApiKey: true },
  ])('is ready with any configured key: %o', (settings) => {
    expect(getApiKeyStatus(settings)).toBe('ready')
  })
})
