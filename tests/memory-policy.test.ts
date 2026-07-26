import { describe, expect, it } from 'vitest'
import {
  detectSecrets,
  redactSecrets,
  validateExtractionResult,
  validateMemoryDraft,
} from '../src/services/memory'

describe('memory secret detection', () => {
  it.each([
    'My password is hunter2',
    'GEMINI_API_KEY=AIzaSyExampleSecretValue1234567890',
    'CUSTOM_API_KEY=not-safe-to-store',
    'AWS key AKIAIOSFODNN7EXAMPLE',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
    '-----BEGIN PRIVATE KEY-----',
    'My seed phrase is alpha beta gamma delta epsilon zeta eta theta iota kappa lambda omega',
    'My card number is 4111 1111 1111 1111',
    'My social security number is 123-45-6789',
    'I was diagnosed with a private condition',
  ])('blocks sensitive content without storing it: %s', (content) => {
    expect(detectSecrets(content).detected).toBe(true)
  })

  it('allows ordinary durable project facts', () => {
    expect(
      detectSecrets('I am building Avri with Electron and React.').detected,
    ).toBe(false)
  })

  it('redacts detected values', () => {
    const redacted = redactSecrets(
      'My password is hunter2 and my card is 4111 1111 1111 1111.',
    )
    expect(redacted).not.toContain('hunter2')
    expect(redacted).not.toContain('4111')
    expect(redacted).toContain('[REDACTED]')
  })
})

describe('memory validation', () => {
  it('normalizes a valid memory proposal', () => {
    const result = validateMemoryDraft({
      content: '  I prefer concise   answers. ',
      category: 'preference',
      importance: 'high',
      reason: 'Useful response preference',
      keywords: ['Concise', 'answers', 'concise'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content).toBe('I prefer concise answers.')
      expect(result.value.keywords).toEqual(['concise', 'answers'])
    }
  })

  it('rejects secrets even when the structured shape is valid', () => {
    const result = validateMemoryDraft({
      content: 'My API key is AIzaSyExampleSecretValue1234567890',
      category: 'personal',
      importance: 'high',
      keywords: ['api'],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid structured extraction output', () => {
    expect(
      validateExtractionResult({
        shouldPropose: true,
        content: 'I prefer concise answers.',
        category: 'unknown',
        importance: 'high',
        reason: 'Useful later',
        keywords: ['concise'],
      }),
    ).toBeNull()
  })
})
