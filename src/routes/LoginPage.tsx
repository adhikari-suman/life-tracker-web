import { useRef, useState, type FormEvent } from 'react'

// The generated SDK. `login` is named for the spec's operationId — life-tracker-contracts is
// explicit that operationId IS the generated method name, which is why renaming one there is a
// breaking change to every client. Nothing about this request is hand-written: the body type,
// the URL and the response type all come from openapi.yaml.
import { login } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { storeSession } from '../auth/session'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import styles from './LoginPage.module.css'

// UNAUTHORIZED is the same code the server returns when a token expires mid-session, but here it
// can only mean the credentials were wrong. The wording is careful not to say WHICH was wrong:
// the spec makes the 401 for an unknown email and a bad password deliberately indistinguishable
// so that the screen cannot be used to test whether an address is registered, and copy that said
// "no account with that email" would hand back exactly what the status code withholds.
const LOGIN_MESSAGES = {
  UNAUTHORIZED: () => 'Email or password is incorrect.',
}

type LoginPageProps = {
  onSignedIn: () => void
}

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email: string | null; password: string | null }>({
    email: null,
    password: null,
  })
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // Only presence is checked here. Email FORMAT is the server's call: the spec sets
    // `format: email` and answers with a VALIDATION Problem, and a second regex in the client
    // would eventually disagree with it and reject an address the API would have accepted.
    const nextErrors = {
      email: email.trim() === '' ? 'Enter your email address.' : null,
      password: password === '' ? 'Enter your password.' : null,
    }
    setFieldErrors(nextErrors)
    if (nextErrors.email !== null || nextErrors.password !== null) {
      // Focus the first field at fault, so fixing it does not start with a hunt.
      ;(nextErrors.email !== null ? emailRef : passwordRef).current?.focus()
      return
    }

    setProblem(null)
    setSubmitting(true)

    // `deviceLabel` is deliberately not sent. It is optional, it exists to name the Session on
    // the active-devices screen, and that screen is out of scope for this build — the server
    // falls back to the User-Agent, which is a better guess than anything invented here.
    const { data, error, response } = await login({ body: { email: email.trim(), password } })

    setSubmitting(false)

    if (data !== undefined) {
      storeSession(data)
      onSignedIn()
      return
    }

    setProblem(toAppProblem(error, response))

    // Put the cursor in the password field with its contents selected. On a rejected sign-in the
    // email is usually right and the password usually is not, so this makes the retry a single
    // gesture: start typing. The banner is role="alert", so it is announced regardless of where
    // focus went.
    //
    // This works synchronously only because nothing on this form is ever given the `disabled`
    // attribute. React has not re-rendered yet at this point, so if the field were disabled for
    // the duration of the request it would still be disabled right here, select() would be
    // silently ignored, and focus would stay wherever the disable left it.
    passwordRef.current?.select()
  }

  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <header className={styles.masthead}>
          <h1 className={styles.wordmark}>Life Tracker</h1>
          <p className={styles.tagline}>Money in, money out, and where it actually went.</p>
        </header>

        <hr className={styles.rule} />

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.heading}>Sign in</h2>

          <ProblemBanner problem={problem} messages={LOGIN_MESSAGES} />

          <TextField
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            autoComplete="email"
            // The one field that should hold focus on arrival: sign-in starts with typing.
            autoFocus
            required
          />

          <TextField
            ref={passwordRef}
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            autoComplete="current-password"
            required
          />

          {/* aria-disabled, NOT the disabled attribute. A disabled button is not focusable, so
              disabling the one the user just clicked drops focus to <body> — and the request
              they are waiting on then finishes with their focus at the top of the document.
              This stays focusable and announces as unavailable; handleSubmit's own guard is
              what actually prevents the second submit. */}
          <button
            className={styles.submit}
            type="submit"
            aria-disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* These routes are in the IA and the screen is incomplete without them — a sign-in form
            with no way to register is a dead end. The router that makes them resolve is Task 3;
            until then they are honest hrefs to the paths the IA already fixed. */}
        <nav className={styles.links}>
          <a className={styles.link} href="/register">
            Create an account
          </a>
          <a className={styles.link} href="/forgot-password">
            Forgot your password?
          </a>
        </nav>
      </div>
    </main>
  )
}
