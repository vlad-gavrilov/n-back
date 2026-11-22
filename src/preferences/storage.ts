type PreferenceKey = 'nback-locale' | 'nback-theme'

export function readPreference(key: PreferenceKey): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePreference(key: PreferenceKey, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Preferences still apply to this page when storage is unavailable.
  }
}
