import { describe, expect, it } from 'vitest'
import type { Account } from '../api/generated/types.gen'
import { accountsById } from './describeTransaction'
import { draftFromRequest } from './entryDraft'

const ACC: Account[] = [
  { id: 'bank', name: 'Bank', kind: 'ASSET', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  { id: 'card', name: 'Card', kind: 'LIABILITY', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  { id: 'food', name: 'Food', kind: 'EXPENSE', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  { id: 'pay', name: 'Salary', kind: 'INCOME', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  { id: 'eur', name: 'Euro', kind: 'ASSET', currency: 'EUR', balance: { amount: '0.00', currency: 'EUR' } },
]
const byId = accountsById(ACC)

describe('draftFromRequest restores a failed entry in the right intent', () => {
  it('reads an Asset→Expense request back as Spent, keeping the amount string verbatim', () => {
    const d = draftFromRequest({ date: '2026-07-24', from: 'bank', to: 'food', amount: { amount: '12.00', currency: 'USD' }, labelId: 'l1' }, byId)
    expect(d.intent).toBe('SPENT')
    expect(d.amount).toBe('12.00')
    expect(d.labelId).toBe('l1')
    expect(d.date).toBe('2026-07-24')
  })

  it('reads Income→Asset as Earned', () => {
    expect(draftFromRequest({ date: '2026-07-24', from: 'pay', to: 'bank', amount: { amount: '2000.00', currency: 'USD' } }, byId).intent).toBe('EARNED')
  })

  it('reads Asset→Liability as Paid off', () => {
    expect(draftFromRequest({ date: '2026-07-24', from: 'bank', to: 'card', amount: { amount: '50.00', currency: 'USD' } }, byId).intent).toBe('PAID_OFF')
  })

  it('reads Asset→Asset as Moved and keeps the cross-currency toAmount', () => {
    const d = draftFromRequest(
      { date: '2026-07-24', from: 'bank', to: 'eur', amount: { amount: '100.00', currency: 'USD' }, toAmount: { amount: '90.00', currency: 'EUR' } },
      byId,
    )
    expect(d.intent).toBe('MOVED')
    expect(d.toAmount).toBe('90.00')
  })

  it('has no label when none was sent', () => {
    expect(draftFromRequest({ date: '2026-07-24', from: 'bank', to: 'food', amount: { amount: '1.00', currency: 'USD' } }, byId).labelId).toBeNull()
  })
})
