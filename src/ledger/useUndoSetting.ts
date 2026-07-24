import { useCallback, useState } from 'react'

// The undo window is a product parameter, and WCAG 2.2.1 requires that a time limit like this be
// adjustable and able to be turned off. This persists the user's choice; the ledger exposes the
// control. The default matches --duration-undo-window in the tokens.
//
// 0 means OFF — entries commit immediately, with no recallable window. That is the accessible
// escape hatch for anyone for whom a timed action is a barrier; the trade is that a mistake is
// then corrected by reversal rather than recalled.

const KEY = 'lt.undoWindowMs'
export const DEFAULT_UNDO_WINDOW_MS = 5000

/** The choices offered in the UI. 0 is "Off". */
export const UNDO_WINDOW_CHOICES = [0, 3000, 5000, 10000] as const

function read(): number {
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY)
    if (raw === null) return DEFAULT_UNDO_WINDOW_MS
    // A duration in milliseconds, not money — the repo-wide ban on numeric coercion is about
    // amounts, and this reads a millisecond count from storage.
    /* oxlint-disable no-restricted-globals */
    const value = Number.parseInt(raw, 10)
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_UNDO_WINDOW_MS
    /* oxlint-enable no-restricted-globals */
  } catch {
    return DEFAULT_UNDO_WINDOW_MS
  }
}

export function useUndoSetting(): { windowMs: number; setWindowMs: (ms: number) => void } {
  const [windowMs, setWindowMsState] = useState(read)

  const setWindowMs = useCallback((ms: number) => {
    setWindowMsState(ms)
    try {
      localStorage.setItem(KEY, String(ms))
    } catch {
      // Persistence is best-effort; the in-memory value still governs this session.
    }
  }, [])

  return { windowMs, setWindowMs }
}
