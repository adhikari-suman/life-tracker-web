import { NETWORK_FAILURE, UNKNOWN_PROBLEM, type AppProblem } from '../api/problem'
import styles from './ProblemBanner.module.css'

// Renders an API failure. Switches on `Problem.code` and NEVER on the prose in `detail` — the
// brief is explicit, and the reason is that `detail` is server copy written for a developer: it
// is not localised, not designed, and free to change without it being a breaking API change.
// Every string a user reads is in this file.

/** A message may depend on the problem (Retry-After, mainly), so entries are functions. */
type MessageFor = (problem: AppProblem) => string

const DEFAULT_MESSAGES: Record<string, MessageFor> = {
  UNAUTHORIZED: () => 'Your session has expired. Sign in again to continue.',

  TOO_MANY_ATTEMPTS: ({ retryAfterSeconds }) =>
    retryAfterSeconds === null
      ? 'Too many attempts. Wait a moment before trying again.'
      : `Too many attempts. Try again in ${formatWait(retryAfterSeconds)}.`,

  VALIDATION: () => 'Some of those details were not accepted. Check them and try again.',

  // A 400 for a body the schema does not permit. The user cannot cause this by typing — the
  // spec sets additionalProperties: false everywhere, so it means the client sent a field the
  // contract does not declare. Say so rather than implying the user mistyped something.
  MALFORMED_REQUEST: () => 'The app sent something the server could not accept. This is a bug in the app.',

  [NETWORK_FAILURE]: () => 'Could not reach the server. Check your connection and try again.',

  [UNKNOWN_PROBLEM]: () => 'Something went wrong. Try again.',
}

/** Whole seconds are exact but unreadable past a minute or so; a lockout can run to minutes. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

type ProblemBannerProps = {
  /** Null renders nothing, so a caller can pass state straight through. */
  problem: AppProblem | null
  /**
   * Per-screen wording for codes whose meaning depends on where you are. UNAUTHORIZED is the
   * real case: on the sign-in screen it means "those credentials are wrong", and everywhere
   * else it means "your session ran out". Same code from the server, two different facts for
   * the reader, so the screen that knows which one it is supplies the sentence.
   */
  messages?: Record<string, MessageFor>
}

export function ProblemBanner({ problem, messages }: ProblemBannerProps) {
  if (problem === null) return null

  const lookup = messages?.[problem.code] ?? DEFAULT_MESSAGES[problem.code]
  const message = (lookup ?? DEFAULT_MESSAGES[UNKNOWN_PROBLEM])(problem)

  return (
    // role="alert" so it is announced the moment it appears. The form has not moved focus, so
    // without this a screen-reader user submits and hears nothing at all.
    <div className={styles.banner} role="alert">
      <span className={styles.marker}>Error</span>
      <p className={styles.message}>{message}</p>
    </div>
  )
}
