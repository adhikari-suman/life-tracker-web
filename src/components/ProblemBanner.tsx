import { problemMessage, type AppProblem } from '../api/problem'
import styles from './ProblemBanner.module.css'

// Renders an API failure. The copy comes from problemMessage, which switches on `Problem.code`
// and NEVER on the prose in `detail` — one catalogue, shared with the commit queue's failed row.

type ProblemBannerProps = {
  /** Null renders nothing, so a caller can pass state straight through. */
  problem: AppProblem | null
  /**
   * Per-screen wording for codes whose meaning depends on where you are. UNAUTHORIZED is the
   * real case: on the sign-in screen it means "those credentials are wrong", and everywhere
   * else it means "your session ran out". Same code from the server, two different facts for
   * the reader, so the screen that knows which one it is supplies the sentence.
   */
  messages?: Record<string, (problem: AppProblem) => string>
}

export function ProblemBanner({ problem, messages }: ProblemBannerProps) {
  if (problem === null) return null

  const message = problemMessage(problem, messages)

  return (
    // role="alert" so it is announced the moment it appears. The form has not moved focus, so
    // without this a screen-reader user submits and hears nothing at all.
    <div className={styles.banner} role="alert">
      <span className={styles.marker}>Error</span>
      <p className={styles.message}>{message}</p>
    </div>
  )
}
