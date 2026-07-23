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
