import { describe, expect, it } from 'vitest'
import { NETWORK_FAILURE, UNKNOWN_PROBLEM, problemMessage, toAppProblem } from './problem'

function problem(code: string, retryAfterSeconds: number | null = null) {
  return { code, status: 422, retryAfterSeconds }
}

describe('problemMessage — one catalogue, switched on code never on detail', () => {
  it('has honest copy for the ledger-recording codes', () => {
    expect(problemMessage(problem('SAME_ACCOUNT'))).toMatch(/different/i)
    expect(problemMessage(problem('CONVERTED_AMOUNT_REQUIRED'))).toMatch(/other currency/i)
    expect(problemMessage(problem('LABEL_NOT_APPLICABLE'))).toMatch(/can’t apply/i)
    expect(problemMessage(problem('LABEL_ARCHIVED'))).toMatch(/archived/i)
    expect(problemMessage(problem('ACCOUNT_NOT_FOUND'))).toMatch(/no longer exists/i)
  })

  it('formats the Retry-After wait for a lockout', () => {
    expect(problemMessage(problem('TOO_MANY_ATTEMPTS', 30))).toMatch(/30 seconds/)
    expect(problemMessage(problem('TOO_MANY_ATTEMPTS', 90))).toMatch(/2 minutes/)
    expect(problemMessage(problem('TOO_MANY_ATTEMPTS', null))).toMatch(/wait a moment/i)
  })

  it('honours a per-screen override for a context-dependent code', () => {
    const overrides = { UNAUTHORIZED: () => 'Email or password is incorrect.' }
    expect(problemMessage(problem('UNAUTHORIZED'), overrides)).toBe('Email or password is incorrect.')
    // Without the override, the same code reads as an expired session.
    expect(problemMessage(problem('UNAUTHORIZED'))).toMatch(/session has expired/i)
  })

  it('falls back gracefully for an unknown code — the expected state until the spec adds the enum', () => {
    expect(problemMessage(problem('SOMETHING_NEW'))).toBe(problemMessage(problem(UNKNOWN_PROBLEM)))
  })
})

describe('toAppProblem normalizes whatever the client produced', () => {
  it('reads a network failure (no response) as NETWORK_FAILURE', () => {
    const p = toAppProblem(new TypeError('Failed to fetch'), undefined)
    expect(p.code).toBe(NETWORK_FAILURE)
    expect(p.status).toBeNull()
  })

  it('reads the Retry-After header off a 429', () => {
    const response = new Response(null, { status: 429, headers: { 'Retry-After': '45' } })
    const p = toAppProblem({ title: 'Too Many Requests', status: 429, code: 'TOO_MANY_ATTEMPTS' }, response)
    expect(p.retryAfterSeconds).toBe(45)
  })

  it('treats a body with no usable code as UNKNOWN_PROBLEM rather than crashing', () => {
    const response = new Response(null, { status: 500 })
    expect(toAppProblem('gateway error text', response).code).toBe(UNKNOWN_PROBLEM)
  })
})
