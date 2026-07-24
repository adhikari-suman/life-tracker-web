import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../auth/useSession'
import { FullPageWait } from '../components/FullPageWait'
import { safeReturnPath } from './returnPath'

// The redirect chain from the information architecture, in one file so that its ORDER is
// reviewable in one place rather than inferred from how the route tree happens to nest:
//
//   1. No valid session                  -> /login, preserving where they were going
//   2. Session valid, zero accounts      -> /setup, and no other authenticated route
//   3. Otherwise                         -> the requested route
//
// Each step is a layout route. Composing them in the route tree makes the order literal: a
// route sitting inside RequireAccounts is inside RequireSession too, so step 1 cannot be
// skipped by reaching step 2 first.
//
// This is the whole of the enforcement. There is no second check inside a page, because a guard
// that is also implemented in ten pages is a guard with ten places to forget it.

/**
 * Step 1. Beyond here a session exists — meaning `getMe` returned 200, not merely that a token
 * is in storage.
 */
export function RequireSession() {
  const { state } = useSession()
  const location = useLocation()

  // Neither render nor redirect while the answer is unknown. Redirecting here would bounce every
  // authenticated user through /login on a hard refresh, before their session had been read.
  if (state.status === 'loading') return <FullPageWait />

  if (state.status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        // Carried in history state rather than a ?next= query parameter. A redirect target in
        // the URL is a target an attacker can supply in a link; this one can only be put here
        // by this component. LoginPage still validates it before navigating.
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}

/**
 * Step 2. Beyond here the Book has at least one account, so an entry form has something to
 * offer. Sits INSIDE RequireSession — it assumes a session and does not re-check for one.
 */
export function RequireAccounts() {
  const { state } = useSession()

  if (state.status === 'loading') return <FullPageWait />
  // Only reachable inside RequireSession, which has already sent anonymous callers to /login.
  if (state.status === 'anonymous') return null

  if (state.accounts.length === 0) {
    // Unskippable on purpose. Recording a transaction is impossible without accounts, so
    // offering "skip for now" would strand the user on a form that cannot succeed.
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}

/**
 * Step 2, inverted — the guard for /setup itself. Onboarding is for a Book with no accounts, so
 * once accounts exist there is nothing here to do and re-running it would duplicate them
 * permanently (there is no delete endpoint).
 */
export function RequireSetupPending() {
  const { state } = useSession()

  if (state.status === 'loading') return <FullPageWait />
  if (state.status === 'anonymous') return null

  if (state.accounts.length > 0) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * The five unauthenticated routes that make no sense with a session open — /login and /register.
 * The other three (/forgot-password, /reset-password, /verify-email) deliberately do NOT use
 * this: a signed-in user can legitimately need all three, and /verify-email in particular is
 * reached from an emailed link by someone who is usually already signed in.
 */
export function RedirectIfSignedIn() {
  const { state } = useSession()
  const location = useLocation()

  if (state.status === 'loading') return <FullPageWait />

  if (state.status === 'authenticated') {
    // This is the ONE place a freshly-authenticated user leaves /login, whether they signed in
    // just now or arrived here with a live session already. Reading the return path here rather
    // than navigating from LoginPage matters: the moment the session flips to authenticated this
    // guard re-renders and redirects, and an explicit navigate in the page would be racing it —
    // and losing, sending the user to / instead of back to the page they were headed for. With
    // one authority there is no race. A plain visit to /login carries no `from`, so it resolves
    // to the ledger.
    return <Navigate to={safeReturnPath((location.state as { from?: unknown } | null)?.from)} replace />
  }

  return <Outlet />
}
