import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'dark' | 'light'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

const THEME_STORAGE_KEY = 'avri-theme-preference'
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light'
}

function getStoredPreference(): ThemePreference {
  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(storedPreference) ? storedPreference : 'dark'
  } catch {
    return 'dark'
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light'
}

function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function initializeTheme(): void {
  applyResolvedTheme(resolveTheme(getStoredPreference(), getSystemTheme()))
}

export function useTheme() {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(getStoredPreference)
  const [systemTheme, setSystemTheme] =
    useState<ResolvedTheme>(getSystemTheme)

  const resolvedTheme = resolveTheme(preference, systemTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY)
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // The theme still works for the current session if storage is unavailable.
    }
  }, [preference, resolvedTheme])

  return {
    preference,
    resolvedTheme,
    setPreference: setPreferenceState,
  }
}
