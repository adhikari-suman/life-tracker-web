import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { requestPasswordReset } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import styles from './authForm.module.css'

// Reachable with OR without a session: a signed-in user can want a password reset, and the IA
// keeps this route outside RedirectIfSignedIn for exactly that reason.
//
// The confirmation below is the whole design problem on this screen. The endpoint is documented as
// "DELIBERATELY non-enumerating: the response is always 202 whether or not the email is
// registered, so it never reveals who has an account." A UI that said "check your inbox" for a
// known address and "no account with that email" for an unknown one would hand back precisely what
// the status code withholds — so there is ONE outcome here, worded so it is true either way.

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // Presence only. Format is the server's call, as on every other form here.
    if (email.trim() === '') {
      setFieldError('Enter your email address.')
      emailRef.current?.focus()
      return
    }
    setFieldError(null)
    setProblem(null)
    setSubmitting(true)

    const { error, response } = await requestPasswordReset({ body: { email: email.trim() } })

    setSubmitting(false)

    // 202 carries no body, so `data` is undefined on success as well as on failure — the status is
    // what distinguishes them. Anything outside 2xx is a transport or server fault, never "no such
    // account", because that answer does not exist on this endpoint.
    if (response !== undefined && response.ok) {
      setSent(true)
      return
    }

    setProblem(toAppProblem(error, response))
  }

  if (sent) {
    return (
      <section className={styles.outcome}>
        <h2 className={styles.heading}>Check your email</h2>
        <p className={styles.note}>
          If <strong>{email.trim()}</strong> belongs to an account, a reset link is on its way. The
          link works once and expires after about an hour.
        </p>
        <p className={styles.note}>
          Nothing arrived? Check the address for a typo, then{' '}
          <button
            type="button"
            className={styles.inlineButton}
            onClick={() => {
              setSent(false)
              setProblem(null)
            }}
          >
            try again
          </button>
          .
        </p>
        <nav className={styles.links}>
          <Link className={styles.link} to="/login">
            Back to sign in
          </Link>
        </nav>
      </section>
    )
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.heading}>Reset your password</h2>
        <p className={styles.note}>
          Enter the email you signed up with and we will send a link to set a new password.
        </p>

        <ProblemBanner problem={problem} />

        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
          autoComplete="email"
          autoFocus
          required
        />

        <button
          className={styles.submit}
          type="submit"
          aria-disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <nav className={styles.links}>
        <Link className={styles.link} to="/login">
          Back to sign in
        </Link>
      </nav>
    </>
  )
}
