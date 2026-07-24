import styles from './FullPageWait.module.css'

/**
 * Shown while the session is being read, which is the one moment the app cannot yet know which
 * route the user belongs on.
 *
 * Deliberately not a spinner. This resolves in one request against a warm connection, and a
 * spinner that appears and vanishes inside 200ms reads as a flicker rather than as progress —
 * Rams would call it decoration for a state nobody sees. What it is instead is a live region, so
 * that a screen reader is told the page is working rather than left on a silent blank document.
 */
export function FullPageWait() {
  return (
    <div className={styles.wait} role="status" aria-live="polite">
      <span className="sr-only">Loading your session…</span>
    </div>
  )
}
