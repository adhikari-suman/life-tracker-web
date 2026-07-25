import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { resendEmailVerification, verifyEmail } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { useSession } from '../auth/useSession'
import { ProblemBanner } from '../components/ProblemBanner'
import styles from './authForm.module.css'

// Opened from an emailed link, usually by someone who is already signed in — which is why the IA
// keeps this route outside RedirectIfSignedIn. Bouncing a signed-in user to the ledger would spend
// the token's single use and tell them nothing.
//
// The link IS the action, so this verifies on mount rather than presenting a button that asks the
// user to confirm what they already confirmed by clicking.

const VERIFY_MESSAGES = {
  INVALID_TOKEN: () =>
    'That link has expired or has already been used. Verification links last about a day.',
}

type Status = 'verifying' | 'verified' | 'failed' | 'no-token'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { state, refreshUser } = useSession()

  const [status, setStatus] = useState<Status>(token === null ? 'no-token' : 'verifying')
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)

  // A token is single-use, and React runs effects twice in development StrictMode. Without this
  // guard the second run would consume the token the first run just spent, and a perfectly good
  // link would report itself invalid — in development only, which is the worst place for a bug
  // that does not reproduce in production.
  const attempted = useRef(false)

  useEffect(() => {
    if (token === null || attempted.current) return
    attempted.current = true

    // There is deliberately NO `live` cleanup flag here, and that is not an oversight — it was
    // written with one and the page hung on "Verifying…" forever. StrictMode's sequence is mount,
    // cleanup, mount: the cleanup flipped `live` to false, the second mount returned early on the
    // guard above without re-arming anything, and the single in-flight response was then thrown
    // away by a flag nothing would ever set back. The guard already guarantees exactly one request
    // for the life of this component, so there is no stale response to protect against; a flag
    // whose only power is to discard the one real answer is worse than none.
    void (async () => {
      const { error, response } = await verifyEmail({ body: { token } })

      if (response !== undefined && response.ok) {
        setStatus('verified')
        // The shell shows an "Email not verified" marker keyed off the User. Leaving it stale
        // would tell someone who just verified that they had not. Harmless if signed out — the
        // provider ignores it unless the session is authenticated.
        await refreshUser()
        return
      }

      setProblem(toAppProblem(error, response))
      setStatus('failed')
    })()
  }, [token, refreshUser])

  // Resend is authenticated and scoped to the caller — the spec notes that is deliberate, so it
  // cannot be used to probe other addresses. So it is only offered to someone already signed in.
  const canResend = state.status === 'authenticated' && !state.user.emailVerified

  async function handleResend() {
    if (resending) return
    setResending(true)
    setProblem(null)
    const { error, response } = await resendEmailVerification()
    setResending(false)

    if (response !== undefined && response.ok) {
      setResent(true)
      return
    }
    setProblem(toAppProblem(error, response))
  }

  const resendBlock = canResend ? (
    resent ? (
      <p className={styles.note}>
        A new link is on its way to <strong>{state.user.email}</strong>. It replaces any earlier
        one.
      </p>
    ) : (
      <p className={styles.note}>
        <button
          type="button"
          className={styles.inlineButton}
          onClick={handleResend}
          aria-disabled={resending}
          aria-busy={resending}
        >
          {resending ? 'Sending…' : 'Send me a new link'}
        </button>
      </p>
    )
  ) : null

  const home = state.status === 'authenticated' ? '/' : '/login'
  const homeLabel = state.status === 'authenticated' ? 'Go to the ledger' : 'Back to sign in'

  if (status === 'verifying') {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>Verifying your email…</h2>
        {/* role="status" so the outcome is announced when it replaces this, rather than silently
            swapping under a screen reader. */}
        <p className={styles.note} role="status">
          One moment.
        </p>
      </section>
    )
  }

  if (status === 'verified') {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>Email verified</h2>
        <p className={styles.note}>
          Thanks — that is done. Verification is what lets you share your book with someone else.
        </p>
        <nav className={styles.links}>
          <Link className={styles.link} to={home}>
            {homeLabel}
          </Link>
        </nav>
      </section>
    )
  }

  if (status === 'no-token') {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>This link is incomplete</h2>
        <p className={styles.note}>
          The verification link did not carry a token — it may have been cut short by your email
          app.
        </p>
        <ProblemBanner problem={problem} messages={VERIFY_MESSAGES} />
        {resendBlock}
        <nav className={styles.links}>
          <Link className={styles.link} to={home}>
            {homeLabel}
          </Link>
        </nav>
      </section>
    )
  }

  return (
    <section className={styles.outcome}>
      <h2 className={styles.heading}>Could not verify that link</h2>
      <ProblemBanner problem={problem} messages={VERIFY_MESSAGES} />
      {/* Stated because it is the thing someone will worry about: an unverified email costs them
          nothing they are currently doing. */}
      <p className={styles.note}>
        You can keep using Life Tracker either way — verification only gates sharing your book.
      </p>
      {resendBlock}
      <nav className={styles.links}>
        <Link className={styles.link} to={home}>
          {homeLabel}
        </Link>
      </nav>
    </section>
  )
}
