import { describe, expect, it } from 'vitest'
import { isAppNavigation, isSafeExternalUrl } from '../src/services/links'

describe('external links', () => {
  it.each(['https://ai.google.dev/', 'http://example.com/path?q=1'])(
    'opens web links in the system browser: %s',
    (url) => {
      expect(isSafeExternalUrl(url)).toBe(true)
    },
  )

  it.each([
    'javascript:alert(1)',
    'file:///Users/me/.ssh/id_rsa',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'avri://settings',
    '/relative/path',
    'not a url',
    '',
  ])('refuses everything else: %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false)
  })
})

describe('in-app navigation', () => {
  it('allows navigation within the dev server origin', () => {
    expect(
      isAppNavigation('http://localhost:5173/', 'http://localhost:5173/#/chat'),
    ).toBe(true)
  })

  it('allows reloading the bundled page', () => {
    expect(
      isAppNavigation(
        'file:///app/out/renderer/index.html',
        'file:///app/out/renderer/index.html#settings',
      ),
    ).toBe(true)
  })

  it('blocks navigation to other sites and other files', () => {
    expect(isAppNavigation('http://localhost:5173/', 'https://evil.example/')).toBe(false)
    expect(
      isAppNavigation('file:///app/out/renderer/index.html', 'file:///etc/hosts'),
    ).toBe(false)
    expect(
      isAppNavigation('file:///app/out/renderer/index.html', 'https://example.com'),
    ).toBe(false)
  })
})
