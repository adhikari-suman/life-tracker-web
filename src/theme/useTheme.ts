import { useCallback, useEffect, useState } from 'react'

// Theme choice: light, dark, or follow the system. The tokens support both a [data-theme]
// attribute (manual) and prefers-color-scheme (system), and this is the control over which wins.
//
// 'system' removes the attribute entirely, so prefers-color-scheme decides — which is why the
// tokens gate their media-query block on :root:not([data-theme='light']): a manual choice always
// overrides the system preference, in both directions. The saved choice is applied before first
// paint by the inline script in index.html; this hook keeps it in step at runtime.

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'lt.theme'

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // ignore
  }
  return 'system'
}

function apply(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(read)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Persistence is best-effort; the in-memory choice still governs this session.
    }
  }, [])

  return { theme, setTheme }
}
