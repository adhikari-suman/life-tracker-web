import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

// The generated SDK, same as sign-in. `register` is the spec's operationId; the body type, the
// URL and the response type all come from openapi.yaml and none of them is hand-written.
import { register } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { useSession } from '../auth/useSession'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import styles from './authForm.module.css'

/**
 * `RegisterRequest.password` in the spec: `minLength: 12`. Checked here because it is a declared
 * schema constraint rather than a guess — the same reason email FORMAT is deliberately NOT checked
 * here and left to the server, where `format: email` lives and a second regex would eventually
 * disagree with it.
 *
 * The spec also warns the minimum is provisional and the full policy is a follow-on decision, so
 * the server can still reject a password this passes. That path is handled by the banner rather
 * than pretended away.
 */
const MIN_PASSWORD_LENGTH = 12

const REGISTER_MESSAGES = {
  // Registration cannot hide whether an address is already taken — refusing the duplicate IS the
  // answer, so every registration form on the internet leaks this. Sign-in is the screen where
  // the distinction is withheld, and it withholds it there deliberately. Given that, say the
  // useful thing and point at the way out.
  EMAIL_TAKEN: () => 'That email is already registered. Sign in instead.',

  // 422 covers a malformed email AND a password that fails policy — the backend maps both
  // exceptions to one code, so the client cannot tell them apart and should not pretend to.
  VALIDATION: () => 'That email address was not accepted, or the password does not meet the policy.',
}

export function RegisterPage() {
  const { establish } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email: string | null
    password: string | null
    confirm: string | null
  }>({ email: null, password: null, confirm: null })
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const nextErrors = {
      email: email.trim() === '' ? 'Enter your email address.' : null,
      password:
        password === ''
          ? 'Choose a password.'
          : password.length < MIN_PASSWORD_LENGTH
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : null,
      // Not a field the API knows about — the spec's RegisterRequest has no confirmation, and
      // this one never leaves the browser. It is here because a mistyped password on THIS form is
      // currently unrecoverable: /forgot-password is still a placeholder, so there is no reset
      // path to fall back on. Delete this field the day password reset is built, not before.
      confirm: confirm !== password ? 'Both passwords must match.' : null,
    }
    setFieldErrors(nextErrors)

    const firstBad =
      nextErrors.email !== null
        ? emailRef
        : nextErrors.password !== null
          ? passwordRef
          : nextErrors.confirm !== null
            ? confirmRef
            : null

    if (firstBad !== null) {
      // Focus the first field at fault, so fixing it does not start with a hunt.
      firstBad.current?.focus()
      return
    }

    setProblem(null)
    setSubmitting(true)

    const { data, error, response } = await register({
      body: { email: email.trim(), password },
    })

    setSubmitting(false)

    if (data !== undefined) {
      // Registration signs you in: the spec returns the same TokenResponse as login, because a
      // Session is opened by the same act (see the contracts commit ratifying auto-login).
      //
      // No navigate() here, for the same reason as sign-in. Establishing the session flips it to
      // authenticated and the guards take over — and for a brand-new User that means RequireAccounts
      // sends them to /setup, since a Book starts with zero accounts and fast entry is impossible
      // until some exist. Navigating here as well would race the guard and lose.
      await establish(data)
      return
    }

    setProblem(toAppProblem(error, response))

    // A rejected registration is almost always the email — either taken or malformed — so put the
    // cursor there with the contents selected. The banner is role="alert" and is announced
    // wherever focus went.
    emailRef.current?.select()
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.heading}>Create an account</h2>

        <ProblemBanner problem={problem} messages={REGISTER_MESSAGES} />

        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
          autoFocus
          required
        />

        <TextField
          ref={passwordRef}
          label={`Password — at least ${MIN_PASSWORD_LENGTH} characters`}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          // new-password, not current-password: this is what tells a password manager to offer to
          // generate one rather than autofill an existing credential.
          autoComplete="new-password"
          required
        />

        <TextField
          ref={confirmRef}
          label="Confirm password"
          type="password"
          name="confirmPassword"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          required
        />

        {/* aria-disabled, NOT the disabled attribute — a disabled button is not focusable, so
            disabling the one just clicked drops focus to <body>. handleSubmit's own guard is what
            prevents a second submit. */}
        <button
          className={styles.submit}
          type="submit"
          aria-disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <nav className={styles.links}>
        <Link className={styles.link} to="/login">
          Already have an account? Sign in
        </Link>
      </nav>
    </>
  )
}
