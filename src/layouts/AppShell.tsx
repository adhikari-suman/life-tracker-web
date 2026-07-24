import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../auth/useSession'
import { useTheme, type Theme } from '../theme/useTheme'
import styles from './AppShell.module.css'

/**
 * Chrome for the authenticated ledger routes.
 *
 * Two destinations, and that is the whole of the navigation. A third would imply the app does
 * three things, and it does not — everything else is support for recording a transaction. There
 * is no sidebar, no breadcrumb and no bottom tab bar: at two levels deep the back affordance is
 * the browser's, and on a screen whose purpose is a numeric keypad a permanent tab bar spends
 * thumb-space on navigation nobody needed.
 *
 * Deliberately absent from /setup, which is chrome-free so there is nothing to navigate away to
 * before the Book can work at all.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        {/* The wordmark is a link home, but it is NOT one of the two destinations — it is hidden
            from assistive technology as a duplicate, since "Ledger" beside it goes to the same
            place with a better name. */}
        <NavLink to="/" className={styles.wordmark} aria-hidden="true" tabIndex={-1}>
          Life&nbsp;Tracker
        </NavLink>

        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navLinkClass}>
            Ledger
          </NavLink>
          <NavLink to="/accounts" className={navLinkClass}>
            Accounts
          </NavLink>
        </nav>

        <ProfileMenu />
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

/** NavLink hands us the active state; aria-current is what actually announces it. */
function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
}

/**
 * The utility menu. Called "Profile", never "Account" — in this domain the word *account* belongs
 * to the Ledger, where it means a place a balance lives. The context map calls that collision out
 * as deliberate, so the UI does not get to blur it.
 */
const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function ProfileMenu() {
  const { state, signOut } = useSession()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape must put focus back where it came from, or a keyboard user is dropped at the top
      // of the document with no idea what they just closed.
      triggerRef.current?.focus()
    }

    function onPointerDown(event: PointerEvent) {
      if (wrapperRef.current?.contains(event.target as Node) === false) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  if (state.status !== 'authenticated') return null

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    // The guard would send an anonymous user to /login on the next render anyway; navigating
    // explicitly means the address bar is right immediately rather than after a bounce.
    void navigate('/login', { replace: true })
  }

  return (
    <div className={styles.profile} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.profileTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Profile
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <p className={styles.email} role="menuitem" tabIndex={-1}>
            {state.user.email}
          </p>

          {/* A quiet marker, not a banner. An unverified user can record transactions perfectly
              well — verification gates sharing, which is out of scope — so interrupting them
              about it on every screen would be nagging about something that is not in their way. */}
          {!state.user.emailVerified && (
            <p className={styles.unverified}>Email not verified</p>
          )}

          <hr className={styles.menuRule} />

          {/* Theme choice. A segmented control, labelled, so the current choice is announced and
              the manual override reads clearly against "System". */}
          <div className={styles.themeRow} role="radiogroup" aria-label="Theme">
            <span className={styles.themeLabel}>Theme</span>
            <div className={styles.themeOptions}>
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  className={theme === option.value ? `${styles.themeOption} ${styles.themeOptionOn}` : styles.themeOption}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <hr className={styles.menuRule} />

          <button
            type="button"
            className={styles.signOut}
            role="menuitem"
            onClick={() => void handleSignOut()}
            aria-disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
