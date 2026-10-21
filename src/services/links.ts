export const GEMINI_API_KEY_URL = 'https://aistudio.google.com/apikey'

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Only plain web links may leave the app. Anything else (javascript:, file:,
 * data:, custom schemes, relative paths) is refused.
 */
export function isSafeExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return EXTERNAL_PROTOCOLS.has(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

/**
 * True when a navigation stays inside the app itself: the dev server origin
 * during development, or the bundled file:// page in production.
 */
export function isAppNavigation(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl)
    const target = new URL(targetUrl)

    if (current.protocol === 'file:' || target.protocol === 'file:') {
      return (
        current.protocol === 'file:' &&
        target.protocol === 'file:' &&
        current.pathname === target.pathname
      )
    }

    return current.origin === target.origin
  } catch {
    return false
  }
}
