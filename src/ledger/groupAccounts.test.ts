import { describe, expect, it } from 'vitest'
import type { Account } from '../api/generated/types.gen'
import { addAmounts } from '../money/amount'
import { groupAccounts } from './groupAccounts'

function acc(name: string, kind: Account['kind'], amount: string, currency: string): Account {
  return { id: `${name}`, name, kind, currency, balance: { amount, currency } }
}

describe('addAmounts sums decimal strings exactly, never through a float', () => {
  it('keeps 0.1 + 0.2 exact where a double gives 0.30000000000000004', () => {
    expect(addAmounts('0.1', '0.2')).toBe('0.3000')
  })

  it('preserves precision past Number.MAX_SAFE_INTEGER', () => {
    expect(addAmounts('9007199254740993.99', '0.01')).toBe('9007199254740994.0000')
  })

  it('handles negatives (a balance may be negative)', () => {
    expect(addAmounts('100.00', '-30.00')).toBe('70.0000')
    expect(addAmounts('-5.00', '-5.00')).toBe('-10.0000')
  })

  it('sums to a negative total', () => {
    expect(addAmounts('10.00', '-25.50')).toBe('-15.5000')
  })
})

describe('groupAccounts totals per currency, never across', () => {
  const accounts = [
    acc('Bank', 'ASSET', '1000.00', 'USD'),
    acc('Cash', 'ASSET', '250.50', 'USD'),
    acc('Euro wallet', 'ASSET', '80.00', 'EUR'),
    acc('Card', 'LIABILITY', '-300.00', 'USD'),
    acc('Salary', 'INCOME', '0.00', 'USD'),
  ]

  it('groups by kind in a stable order', () => {
    const groups = groupAccounts(accounts)
    expect(groups.map((g) => g.kind)).toEqual(['ASSET', 'LIABILITY', 'INCOME'])
  })

  it('produces one total PER CURRENCY within a kind — two for a mixed-currency group', () => {
    const assets = groupAccounts(accounts)[0]
    const byCurrency = Object.fromEntries(assets.totals.map((t) => [t.currency, t.amount]))
    expect(byCurrency).toEqual({ USD: '1250.5000', EUR: '80.0000' })
    // Never a single cross-currency number — that would be meaningless.
    expect(assets.totals).toHaveLength(2)
  })

  it('carries a negative liability total through', () => {
    const liabilities = groupAccounts(accounts).find((g) => g.kind === 'LIABILITY')
    expect(liabilities?.totals[0]).toEqual({ amount: '-300.0000', currency: 'USD' })
  })

  it('omits kinds with no accounts', () => {
    expect(groupAccounts(accounts).some((g) => g.kind === 'EQUITY')).toBe(false)
  })
})
