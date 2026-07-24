import { describe, expect, it } from 'vitest'
import {
  describeRange,
  paramsForRange,
  rangeFromParams,
  resolveRange,
  type DateRange,
} from './dateRange'

// A fixed "today" so these never depend on when they are run: Friday 24 July 2026, local time.
const TODAY = new Date(2026, 6, 24)

describe('resolveRange', () => {
  it('runs this month up to today, never into the future', () => {
    // A range running to the end of the month would claim July is over when it is the 24th.
    expect(resolveRange('this-month', TODAY)).toEqual({
      id: 'this-month',
      from: '2026-07-01',
      to: '2026-07-24',
    })
  })

  it('runs last month end to end', () => {
    expect(resolveRange('last-month', TODAY)).toEqual({
      id: 'last-month',
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('gets February right without a table', () => {
    // Day 0 of March is the last day of February, so leap years need no special case.
    expect(resolveRange('last-month', new Date(2028, 2, 15)).to).toBe('2028-02-29')
    expect(resolveRange('last-month', new Date(2026, 2, 15)).to).toBe('2026-02-28')
  })

  it('crosses the year boundary backwards', () => {
    expect(resolveRange('last-month', new Date(2026, 0, 10))).toEqual({
      id: 'last-month',
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('runs this year from 1 January to today', () => {
    expect(resolveRange('this-year', TODAY)).toEqual({
      id: 'this-year',
      from: '2026-01-01',
      to: '2026-07-24',
    })
  })

  it('leaves all time unbounded on both sides', () => {
    expect(resolveRange('all-time', TODAY)).toEqual({ id: 'all-time', from: null, to: null })
  })

  it('uses local calendar parts, not UTC', () => {
    // toISOString() on a late-evening local date shifts it a day for anyone west of Greenwich,
    // which would silently move a transaction into the previous month.
    const lateEvening = new Date(2026, 6, 24, 23, 30)
    expect(resolveRange('this-month', lateEvening).to).toBe('2026-07-24')
  })
})

describe('rangeFromParams', () => {
  it('defaults to this month when the URL is bare', () => {
    expect(rangeFromParams(new URLSearchParams(), TODAY).id).toBe('this-month')
  })

  it('recognises dates that match a preset', () => {
    const params = new URLSearchParams({ from: '2026-06-01', to: '2026-06-30' })
    expect(rangeFromParams(params, TODAY).id).toBe('last-month')
  })

  it('honours a bookmark whose dates match no preset', () => {
    // Discarding these would defeat the entire reason absolute dates went in the URL.
    const params = new URLSearchParams({ from: '2026-03-01', to: '2026-03-15' })
    expect(rangeFromParams(params, TODAY)).toEqual({
      id: 'custom',
      from: '2026-03-01',
      to: '2026-03-15',
    })
  })

  it('reads all time from its marker, which is not time-relative', () => {
    expect(rangeFromParams(new URLSearchParams({ range: 'all' }), TODAY).id).toBe('all-time')
  })

  it.each([
    ['half a range', { from: '2026-06-01' }],
    ['a malformed date', { from: 'june', to: '2026-06-30' }],
    ['a nearly-right date', { from: '2026-6-1', to: '2026-06-30' }],
  ])('falls back to the default on %s rather than sending it to the server', (_label, query) => {
    expect(rangeFromParams(new URLSearchParams(query), TODAY).id).toBe('this-month')
  })
})

describe('paramsForRange', () => {
  it('writes nothing for the default, so /reports is the clean URL', () => {
    expect(paramsForRange(resolveRange('this-month', TODAY)).toString()).toBe('')
  })

  it('writes absolute dates for a bounded range', () => {
    expect(paramsForRange(resolveRange('last-month', TODAY)).toString()).toBe(
      'from=2026-06-01&to=2026-06-30',
    )
  })

  it('marks all time rather than writing empty dates', () => {
    expect(paramsForRange(resolveRange('all-time', TODAY)).toString()).toBe('range=all')
  })

  it('round-trips every preset', () => {
    for (const id of ['this-month', 'last-month', 'this-year', 'all-time'] as const) {
      const original = resolveRange(id, TODAY)
      const restored = rangeFromParams(paramsForRange(original), TODAY)
      expect(restored).toEqual(original)
    }
  })
})

describe('describeRange', () => {
  it.each<[DateRange, string]>([
    [{ id: 'this-month', from: '2026-07-01', to: '2026-07-24' }, '1 – 24 Jul 2026'],
    [{ id: 'last-month', from: '2026-06-01', to: '2026-06-30' }, '1 – 30 Jun 2026'],
    [{ id: 'this-year', from: '2026-01-01', to: '2026-07-24' }, '1 Jan – 24 Jul 2026'],
    [{ id: 'custom', from: '2025-11-15', to: '2026-02-03' }, '15 Nov 2025 – 3 Feb 2026'],
    [{ id: 'all-time', from: null, to: null }, 'All time'],
  ])('describes %o as %s', (range, expected) => {
    expect(describeRange(range)).toBe(expected)
  })
})
