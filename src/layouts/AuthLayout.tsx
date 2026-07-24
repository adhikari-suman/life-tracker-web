import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import styles from './AuthLayout.module.css'

/**
 * Chrome for the five unauthenticated routes. There is no navigation here on purpose: nothing in
 * the app is reachable without a session, so a nav bar would offer only destinations that bounce
 * straight back. Each page supplies its own links to its siblings instead.
 *
 * Takes `children` as well as rendering an `Outlet` so it can wrap the catch-all 404, which is
 * not a child route of anything — a 404 has no session to check and belongs under no guard.
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <header className={styles.masthead}>
          {/* The h1 of every unauthenticated page. The page's own title is an h2 below it —
              these are the app's front door, so the app is what is being announced. */}
          <h1 className={styles.wordmark}>Life Tracker</h1>
          <p className={styles.tagline}>Money in, money out, and where it actually went.</p>
        </header>

        <hr className={styles.rule} />

        {children ?? <Outlet />}
      </div>
    </main>
  )
}
