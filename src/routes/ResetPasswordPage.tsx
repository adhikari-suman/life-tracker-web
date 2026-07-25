import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { confirmPasswordReset } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import styles from './authForm.module.css'

/** `PasswordResetConfirmRequest.newPassword`: minLength 12 — "same policy as registration". */
const MIN_PASSWORD_LENGTH = 12

const RESET_MESSAGES = {
  // The single most likely failure on this screen, and the one that must not read as the user's
  // fault. A reset token lives about an hour and is single-use, so an expired or replayed link is
  // ordinary rather than suspicious — say what to do next instead of just what went wrong.
  INVALID_TOKEN: () => 'That link has expired or has already been used. Request a new one below.',

  // The server can reject a password this form accepted: the spec calls the 12-character minimum
  // provisional and the full policy a follow-on decision.
  VALIDATION: () => 'That password was not accepted. Try a longer or less predictable one.',
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  // Read once, from the URL the emailed link carried. Never persisted anywhere — the IA is
  // explicit that a ?token= is consumed immediately and kept out of history and logs.
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password: string | null; confirm: string | null }>(
    { password: null, confirm: null },
  )
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || token === null) return

    const nextErrors = {
      password:
        password === ''
          ? 'Choose a new password.'
          : password.length < MIN_PASSWORD_LENGTH
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : null,
      confirm: confirm !== password ? 'Both passwords must match.' : null,
    }
    setFieldErrors(nextErrors)

    if (nextErrors.password !== null) {
      passwordRef.current?.focus()
      return
    }
    if (nextErrors.confirm !== null) {
      confirmRef.current?.focus()
      return
    }

    setProblem(null)
    setSubmitting(true)

    const { error, response } = await confirmPasswordReset({
      body: { token, newPassword: password },
    })

    setSubmitting(false)

    // 204, so there is no body to check — the status is the answer.
    if (response !== undefined && response.ok) {
      setDone(true)
      return
    }

    setProblem(toAppProblem(error, response))
  }

  // A link that arrived without its token, or was truncated by a mail client. Not an error the
  // user caused, and not one they can fix on this page.
  if (token === null) {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>This link is incomplete</h2>
        <p className={styles.note}>
          The reset link did not carry a token — it may have been cut short by your email app.
        </p>
        <nav className={styles.links}>
          <Link className={styles.link} to="/forgot-password">
            Request a new link
          </Link>
          <Link className={styles.link} to="/login">
            Back to sign in
          </Link>
        </nav>
      </section>
    )
  }

  if (done) {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>Password changed</h2>
        {/* Said plainly because it is surprising and because it is a security property worth
            understanding: the spec revokes EVERY Session on a reset, since a reset answers a
            possible takeover. Anyone still signed in on another device is now signed out. */}
        <p className={styles.note}>
          You have been signed out on every device, including any you had open elsewhere. Sign in
          again with your new password.
        </p>
        <nav className={styles.links}>
          <Link className={styles.link} to="/login">
            Sign in
          </Link>
        </nav>
      </section>
    )
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.heading}>Set a new password</h2>

        <ProblemBanner problem={problem} messages={RESET_MESSAGES} />

        <TextField
          ref={passwordRef}
          label={`New password — at least ${MIN_PASSWORD_LENGTH} characters`}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          autoComplete="new-password"
          autoFocus
          required
        />

        <TextField
          ref={confirmRef}
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          required
        />

        <button
          className={styles.submit}
          type="submit"
          aria-disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Changing…' : 'Change password'}
        </button>
      </form>

      <nav className={styles.links}>
        <Link className={styles.link} to="/forgot-password">
          Request a new link
        </Link>
        <Link className={styles.link} to="/login">
          Back to sign in
        </Link>
      </nav>
    </>
  )
}
