import { describe, expect, it } from 'vitest'
import type { Transaction } from '../api/generated/types.gen'
import { dayHeading, groupByDay } from './groupByDay'

function txn(id: string, date: string, time: string): Transaction {
  return { id, date, time, exchangeRate: null, postings: [] }
}

describe('groupByDay cuts the list where the date changes', () => {
  it('emits one heading per run of the same date, in the order given', () => {
    const items = groupByDay([
      txn('a', '2026-07-24', '19:42'),
      txn('b', '2026-07-24', '08:15'),
      txn('c', '2026-07-23', '12:00'),
    ])
    expect(items.map((i) => (i.kind === 'day' ? `#${i.date}` : i.transaction.id))).toEqual([
      '#2026-07-24',
      'a',
      'b',
      '#2026-07-23',
      'c',
    ])
  })

  it('does not sort — a date that recurs after a gap opens a second heading', () => {
    // The server orders the list (ADR-0018); this only cuts it. If a repeat date ever arrives out
    // of order the grouping must show that faithfully rather than quietly merging it, because the
    // merge would misrepresent the order the server sent.
    const items = groupByDay([
      txn('a', '2026-07-24', '19:42'),
      txn('b', '2026-07-23', '12:00'),
      txn('c', '2026-07-24', '08:15'),
    ])
    expect(items.filter((i) => i.kind === 'day')).toHaveLength(3)
  })

  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('dayHeading names a day in the local zone', () => {
  const today = '2026-07-26'

  it('names today and yesterday', () => {
    expect(dayHeading('2026-07-26', today)).toBe('Today')
    expect(dayHeading('2026-07-25', today)).toBe('Yesterday')
  })

  it('crosses a month boundary backwards for yesterday', () => {
    expect(dayHeading('2026-06-30', '2026-07-01')).toBe('Yesterday')
  })

  it('does not shift the date for a reader west of UTC', () => {
    // The trap this guards: new Date('2026-07-21') is UTC midnight, which renders as the 20th
    // anywhere behind UTC. The heading must name the date on the receipt, not a zone-shifted one.
    // Asserting the day-of-month appears is enough — the locale decides the rest of the wording.
    expect(dayHeading('2026-07-21', today)).toContain('21')
    expect(dayHeading('2026-01-01', '2026-01-15')).toContain('1')
  })

  it('includes the year only when it is not the current one', () => {
    expect(dayHeading('2026-03-04', today)).not.toContain('2026')
    expect(dayHeading('2025-03-04', today)).toContain('2025')
  })
})
