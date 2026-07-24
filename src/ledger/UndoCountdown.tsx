import { useEffect, useState } from 'react'
import styles from './UndoCountdown.module.css'

// The visible half of the undo window: a shrinking bar, a count of seconds, and Cancel. The
// countdown is announced politely (role="status") so a screen-reader user knows the entry is
// holding and can still be recalled, and Cancel is a real focusable button reachable by keyboard
// without a mouse-only hover target.
//
// prefers-reduced-motion is honoured by the CSS — the bar stops animating — but the WINDOW itself
// never shortens: --duration-undo-window is a product timeout, not decoration, and collapsing it
// would remove the very chance to cancel that this exists to give (a WCAG 2.2.1 concern).

type UndoCountdownProps = {
  /** Epoch ms when the commit fires. Undefined once committing has begun. */
  deadline: number | undefined
  onCancel: () => void
  committing: boolean
}

export function UndoCountdown({ deadline, onCancel, committing }: UndoCountdownProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === undefined) return
    // A quarter-second tick is enough to move the seconds count and the bar smoothly without
    // spinning the CPU. It stops as soon as the deadline passes.
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [deadline])

  if (committing || deadline === undefined) {
    return (
      <div className={styles.wrap}>
        <span className={styles.status} role="status">
          Saving…
        </span>
      </div>
    )
  }

  const remainingMs = Math.max(0, deadline - now)
  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div className={styles.wrap}>
      {/* Polite, not assertive: it should not interrupt, only be available. The count is the
          content, so a screen reader announces "3 seconds to undo" as it changes. */}
      <span className={styles.status} role="status">
        {seconds}s to undo
      </span>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
