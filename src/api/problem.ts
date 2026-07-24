import type { Problem } from './generated/types.gen'

// Every API failure in this app becomes an AppProblem, and the UI switches on `code`.
//
// Two things make a normalizing step necessary rather than fussy:
//
// 1. The generated error type LIES about the runtime. It is declared `Problem`, but the fetch
//    client puts whatever it got in that slot — a TypeError when the network is down (with no
//    `response` at all), the raw body string when the server answers with HTML from a proxy, or
//    a JSON object that simply is not a Problem. Reading `error.code` off that type-checks and
//    then reads `undefined` off a TypeError in production.
//
// 2. `Problem.code` is `code?: string` in the generated types — the spec declares no enum, only
//    a prose list in the description, and that list is missing ten codes the spec references
//    elsewhere (LABEL_NOT_APPLICABLE, LABEL_ARCHIVED, MALFORMED_REQUEST and friends). So there
//    is no union to exhaustively switch on and no compiler help. Unknown codes are not an edge
//    case here; they are the expected state until the spec is fixed. Everything downstream must
//    degrade rather than break.

/** Synthesised when the request never reached a server. Not a code the API can return. */
export const NETWORK_FAILURE = 'NETWORK_FAILURE'

/** Synthesised when a response came back but carried no usable `Problem.code`. */
export const UNKNOWN_PROBLEM = 'UNKNOWN_PROBLEM'

export type AppProblem = {
  /** Always present. One of the API's codes, or one of the two synthetic codes above. */
  code: string
  /** HTTP status, or null when the request never got a response. */
  status: number | null
  /**
   * Parsed from the Retry-After header, in whole seconds. Only 429 sets it. Null when absent
   * or unparseable — never guess a wait the server did not state.
   */
  retryAfterSeconds: number | null
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && 'title' in value
}

function parseRetryAfter(response: Response | undefined): number | null {
  const header = response?.headers.get('Retry-After')
  if (header === null || header === undefined) return null

  // The spec types Retry-After as an integer of whole seconds. HTTP also permits an HTTP-date,
  // which this deliberately does not attempt: a clock-skewed browser would compute a nonsense
  // countdown, and showing no number beats showing a wrong one.
  //
  // This is NOT money — it is a count of seconds until a lockout drains, and a genuine integer.
  // The no-restricted-globals ban exists so that every numeric conversion in this codebase has
  // to say out loud what it is converting; this one says it here.
  /* oxlint-disable no-restricted-globals */
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  /* oxlint-enable no-restricted-globals */
}

// The one catalogue of user-facing copy for Problem codes, switched on `code` and NEVER on the
// prose in `detail` — `detail` is server copy written for a developer: not localised, not
// designed, and free to change without it being a breaking API change. Both the banner and the
// commit queue's failed row read from here, so a code reads the same wherever it surfaces.
//
// A message may depend on the problem (Retry-After), so entries are functions.
type MessageFor = (problem: AppProblem) => string

/** Whole seconds are exact but unreadable past a minute or so; a lockout can run to minutes. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

const MESSAGES: Record<string, MessageFor> = {
  UNAUTHORIZED: () => 'Your session has expired. Sign in again to continue.',

  TOO_MANY_ATTEMPTS: ({ retryAfterSeconds }) =>
    retryAfterSeconds === null
      ? 'Too many attempts. Wait a moment before trying again.'
      : `Too many attempts. Try again in ${formatWait(retryAfterSeconds)}.`,

  VALIDATION: () => 'Some of those details were not accepted. Check them and try again.',

  // Ledger-recording codes. Most cannot be reached through the form's own guards, but a stale
  // client or a race can still produce them, so each has honest copy rather than a generic
  // fallback.
  ACCOUNT_NOT_FOUND: () => 'One of those accounts no longer exists.',
  SAME_ACCOUNT: () => 'The two accounts must be different.',
  CONVERTED_AMOUNT_REQUIRED: () => 'Enter the amount that arrived in the other currency.',
  LABEL_NOT_APPLICABLE: () => 'That label can’t apply to this kind of movement.',
  LABEL_ARCHIVED: () => 'That label has been archived and can’t be used on new entries.',
  LABEL_NOT_FOUND: () => 'That label no longer exists.',

  // A 400 for a body the schema does not permit. The user cannot cause this by typing — the spec
  // sets additionalProperties: false everywhere — so it means the client sent a field the
  // contract does not declare. Say so rather than implying the user mistyped something.
  MALFORMED_REQUEST: () => 'The app sent something the server could not accept. This is a bug in the app.',

  [NETWORK_FAILURE]: () => 'Could not reach the server. Check your connection and try again.',
  [UNKNOWN_PROBLEM]: () => 'Something went wrong. Try again.',
}

/**
 * The user-facing sentence for a problem. `overrides` supplies per-screen wording for a code
 * whose meaning depends on context — UNAUTHORIZED is "those credentials are wrong" on the
 * sign-in screen and "your session ran out" everywhere else.
 */
export function problemMessage(problem: AppProblem, overrides?: Record<string, MessageFor>): string {
  const lookup = overrides?.[problem.code] ?? MESSAGES[problem.code] ?? MESSAGES[UNKNOWN_PROBLEM]
  return lookup(problem)
}

/**
 * Turn whatever the generated client produced into something the UI can render.
 * Pass both the `error` and the `response` from the SDK's result — the response carries
 * Retry-After, and its absence is how a network failure is distinguished from a 4xx.
 */
export function toAppProblem(error: unknown, response: Response | undefined): AppProblem {
  if (response === undefined) {
    return { code: NETWORK_FAILURE, status: null, retryAfterSeconds: null }
  }

  const code = isProblem(error) && typeof error.code === 'string' ? error.code : UNKNOWN_PROBLEM

  if (code === UNKNOWN_PROBLEM && import.meta.env.DEV) {
    // Loud in dev, silent in production. An unknown code is usually a spec gap rather than a
    // client bug, and it is the kind of thing that is invisible until someone goes looking.
    console.warn('[api] response carried no usable Problem.code', { status: response.status, error })
  }

  return {
    code,
    status: response.status,
    retryAfterSeconds: parseRetryAfter(response),
  }
}
