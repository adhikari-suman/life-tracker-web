import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '../api/generated/types.gen'
import { accountsById } from './describeTransaction'
import { draftFromRequest, emptyDraft, requestTime } from './entryDraft'

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
    const d = draftFromRequest({ date: '2026-07-24', time: '19:42', from: 'bank', to: 'food', amount: { amount: '12.00', currency: 'USD' }, labelId: 'l1' }, byId)
    expect(d.intent).toBe('SPENT')
    expect(d.amount).toBe('12.00')
    expect(d.labelId).toBe('l1')
    expect(d.date).toBe('2026-07-24')
  })

  it('restores the time as touched, so a resubmit sends what failed rather than a fresh reading', () => {
    const d = draftFromRequest({ date: '2026-07-24', time: '19:42', from: 'bank', to: 'food', amount: { amount: '12.00', currency: 'USD' } }, byId)
    expect(d.time).toBe('19:42')
    expect(d.timeTouched).toBe(true)
    expect(requestTime(d)).toBe('19:42')
  })

  it('reads Income→Asset as Earned', () => {
    expect(draftFromRequest({ date: '2026-07-24', time: '19:42', from: 'pay', to: 'bank', amount: { amount: '2000.00', currency: 'USD' } }, byId).intent).toBe('EARNED')
  })

  it('reads Asset→Liability as Paid off', () => {
    expect(draftFromRequest({ date: '2026-07-24', time: '19:42', from: 'bank', to: 'card', amount: { amount: '50.00', currency: 'USD' } }, byId).intent).toBe('PAID_OFF')
  })

  it('reads Asset→Asset as Moved and keeps the cross-currency toAmount', () => {
    const d = draftFromRequest(
      { date: '2026-07-24', time: '19:42', from: 'bank', to: 'eur', amount: { amount: '100.00', currency: 'USD' }, toAmount: { amount: '90.00', currency: 'EUR' } },
      byId,
    )
    expect(d.intent).toBe('MOVED')
    expect(d.toAmount).toBe('90.00')
  })

  it('has no label when none was sent', () => {
    expect(draftFromRequest({ date: '2026-07-24', time: '19:42', from: 'bank', to: 'food', amount: { amount: '1.00', currency: 'USD' } }, byId).labelId).toBeNull()
  })
})

// The time you typed sticks; the time we guessed refreshes. The point of the flag is that a form
// left open does not stamp the hour it was OPENED onto an entry made much later — ordering is
// `date desc, time desc` (ADR-0018), so a stale reading sorts the entry to the head of a day it
// did not belong at the head of.
describe('requestTime resolves the time to send', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('re-reads the clock at submit when the user never touched the time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 24, 9, 0))
    const draft = emptyDraft()
    expect(draft.time).toBe('09:00')

    // Five hours pass with the form open.
    vi.setSystemTime(new Date(2026, 6, 24, 14, 30))
    expect(requestTime(draft)).toBe('14:30')
  })

  it('sends a typed time verbatim, however long the form then sits', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 24, 9, 0))
    const draft = { ...emptyDraft(), time: '19:42', timeTouched: true }

    vi.setSystemTime(new Date(2026, 6, 24, 14, 30))
    expect(requestTime(draft)).toBe('19:42')
  })

  it('seeds an untouched draft from the local wall clock, zero-padded', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 24, 7, 5))
    const draft = emptyDraft()
    expect(draft.time).toBe('07:05')
    expect(draft.timeTouched).toBe(false)
  })
})
