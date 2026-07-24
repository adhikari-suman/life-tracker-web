import { describe, expect, it } from 'vitest'
import type { Account } from '../api/generated/types.gen'
import { SETUP_PLAN, findExisting } from './setupPlan'

const asset = SETUP_PLAN[0]

function acc(name: string, kind: Account['kind'], currency: string): Account {
  return { id: `${name}-${kind}`, name, kind, currency, balance: { amount: '0.00', currency } }
}

describe('findExisting — the guard that makes setup resumable, not restartable', () => {
  it('matches an account already created for a planned step, so retry skips it', () => {
    const existing = [acc('Current account', 'ASSET', 'USD')]
    expect(findExisting(asset, 'Current account', 'USD', existing)).toBe(existing[0])
  })

  it('matches case-insensitively, as the backend compares names', () => {
    const existing = [acc('current account', 'ASSET', 'USD')]
    expect(findExisting(asset, 'Current Account', 'USD', existing)).toBeDefined()
  })

  it('does not match a different kind — a same-named expense is not the asset', () => {
    const existing = [acc('Current account', 'EXPENSE', 'USD')]
    expect(findExisting(asset, 'Current account', 'USD', existing)).toBeUndefined()
  })

  it('does not match a different currency — the two would be distinct accounts', () => {
    const existing = [acc('Current account', 'ASSET', 'EUR')]
    expect(findExisting(asset, 'Current account', 'USD', existing)).toBeUndefined()
  })

  it('returns undefined on an empty Book, so the first run creates everything', () => {
    expect(findExisting(asset, 'Current account', 'USD', [])).toBeUndefined()
  })
})
