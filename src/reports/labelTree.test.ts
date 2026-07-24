import { describe, expect, it } from 'vitest'
import type { ActivityReport, LabelAmount } from '../api/generated/types.gen'
import { addAmounts, subtractAmounts } from '../money/amount'
import { buildLabelBreakdown, currenciesIn, totalFor } from './labelTree'

function row(
  labelId: string | null,
  name: string,
  path: string,
  parentLabelId: string | null,
  own: string,
  rolledUp: string,
  currency = 'GBP',
): LabelAmount {
  return {
    labelId,
    name,
    path,
    parentLabelId,
    currency,
    own: { amount: own, currency },
    rolledUp: { amount: rolledUp, currency },
  }
}

/**
 * A Book shaped like the mockup in the brief:
 *
 *   housing                    1000.00   (leaf)
 *   food                        420.00   = own 0 + groceries 320 + fast food 100
 *     groceries                 320.00
 *     fast food                 100.00
 *   transport                   180.00   (leaf)
 *   Uncategorized                18.50
 *                             ---------
 *                              1618.50
 */
const REPORT: ActivityReport = {
  from: '2026-07-01',
  to: '2026-07-24',
  byAccount: [],
  byLabel: [
    row('l-food', 'food', 'food', null, '0.00', '420.00'),
    row('l-groceries', 'groceries', 'food / groceries', 'l-food', '320.00', '320.00'),
    row('l-fastfood', 'fast food', 'food / fast food', 'l-food', '100.00', '100.00'),
    row('l-housing', 'housing', 'housing', null, '1000.00', '1000.00'),
    row('l-transport', 'transport', 'transport', null, '180.00', '180.00'),
    row(null, 'Uncategorized', 'Uncategorized', null, '18.50', '18.50'),
  ],
  totals: [{ currency: 'GBP', amount: { amount: '1618.50', currency: 'GBP' } }],
}

describe('buildLabelBreakdown', () => {
  it('RECONCILES: roots rolled up, plus Uncategorized, equal the panel total', () => {
    // The load-bearing invariant of the whole surface. If this ever fails, the breakdown is
    // showing a set of figures that do not add up to the heading above them — which is the exact
    // failure the spec warns is silent, and the reason roots are the default view.
    const { roots, uncategorized } = buildLabelBreakdown(REPORT, 'GBP')

    let sum = uncategorized?.own.amount ?? '0.00'
    for (const root of roots) sum = addAmounts(sum, root.rolledUp.amount)

    expect(sum).toBe('1618.5000')
    expect(addAmounts(totalFor(REPORT, 'GBP') ?? '0', '0')).toBe('1618.5000')
  })

  it('proves the trap it exists to avoid — summing every row double-counts', () => {
    // Stated as a passing test rather than a comment, so anyone who "simplifies" the tree into a
    // flat sum of rolledUp sees exactly what that buys. Nothing errors; the number is just wrong.
    const naive = REPORT.byLabel
      .filter((r) => r.currency === 'GBP' && r.labelId !== null)
      .reduce((acc, r) => addAmounts(acc, r.rolledUp.amount), '0.00')

    const correct = buildLabelBreakdown(REPORT, 'GBP').roots.reduce(
      (acc, r) => addAmounts(acc, r.rolledUp.amount),
      '0.00',
    )

    expect(correct).toBe('1600.0000')
    expect(naive).toBe('2020.0000')

    // The overcount is exactly food's children counted a second time — 320 inside groceries' own
    // row and again inside food's rolledUp, plus 100 the same way for fast food.
    expect(subtractAmounts(naive, correct)).toBe('420.0000')
  })

  it('holds Uncategorized outside the tree, not as a root label', () => {
    const { roots, uncategorized } = buildLabelBreakdown(REPORT, 'GBP')
    expect(uncategorized?.name).toBe('Uncategorized')
    expect(roots.map((r) => r.labelId)).not.toContain(null)
  })

  it('nests children under their parent and assigns depth', () => {
    const { roots } = buildLabelBreakdown(REPORT, 'GBP')
    const food = roots.find((r) => r.labelId === 'l-food')

    expect(food?.depth).toBe(0)
    expect(food?.children.map((c) => c.name).sort()).toEqual(['fast food', 'groceries'])
    expect(food?.children.every((c) => c.depth === 1)).toBe(true)
  })

  it('handles a three-level chain, which ADR-0015 caps as the deepest possible', () => {
    const deep: ActivityReport = {
      byAccount: [],
      byLabel: [
        row('a', 'food', 'food', null, '0.00', '50.00'),
        row('b', 'restaurants', 'food / restaurants', 'a', '0.00', '50.00'),
        row('c', 'fast food', 'food / restaurants / fast food', 'b', '50.00', '50.00'),
      ],
      totals: [{ currency: 'GBP', amount: { amount: '50.00', currency: 'GBP' } }],
    }

    const { roots } = buildLabelBreakdown(deep, 'GBP')
    expect(roots).toHaveLength(1)
    expect(roots[0].children[0].children[0].depth).toBe(2)
    expect(roots[0].rolledUp.amount).toBe('50.00')
  })

  it('promotes an orphan to a root rather than dropping its money', () => {
    // A parent absent from the response is reachable, and dropping the child would silently
    // remove money from the breakdown — breaking the reconciliation above without any error.
    const orphaned: ActivityReport = {
      byAccount: [],
      byLabel: [
        row('child', 'fast food', 'food / fast food', 'missing-parent', '40.00', '40.00'),
        row('solo', 'rent', 'rent', null, '60.00', '60.00'),
      ],
      totals: [{ currency: 'GBP', amount: { amount: '100.00', currency: 'GBP' } }],
    }

    const { roots } = buildLabelBreakdown(orphaned, 'GBP')
    const sum = roots.reduce((acc, r) => addAmounts(acc, r.rolledUp.amount), '0.00')

    expect(roots).toHaveLength(2)
    expect(sum).toBe('100.0000')
  })

  it('sorts largest first, so the eye lands on where the money went', () => {
    const { roots } = buildLabelBreakdown(REPORT, 'GBP')
    expect(roots.map((r) => r.name)).toEqual(['housing', 'food', 'transport'])
  })

  it('sorts exactly, not through a float', () => {
    // 0.1 + 0.2 is 0.30000000000000004 as doubles, so a float comparison can order these wrongly.
    const fiddly: ActivityReport = {
      byAccount: [],
      byLabel: [
        row('x', 'a', 'a', null, '0.30', '0.30'),
        row('y', 'b', 'b', null, '0.3000', '0.3000'),
        row('z', 'c', 'c', null, '0.2999', '0.2999'),
      ],
      totals: [{ currency: 'GBP', amount: { amount: '0.8999', currency: 'GBP' } }],
    }

    const { roots } = buildLabelBreakdown(fiddly, 'GBP')
    // The two equal amounts tie and fall back to path order; the smaller one comes last.
    expect(roots.map((r) => r.name)).toEqual(['a', 'b', 'c'])
  })

  describe('a multi-currency Book', () => {
    const multi: ActivityReport = {
      byAccount: [],
      byLabel: [
        row('l-food', 'food', 'food', null, '100.00', '100.00', 'GBP'),
        row('l-food', 'food', 'food', null, '60.00', '60.00', 'USD'),
        row('l-travel', 'travel', 'travel', null, '380.00', '380.00', 'USD'),
        row(null, 'Uncategorized', 'Uncategorized', null, '5.00', '5.00', 'GBP'),
      ],
      totals: [
        { currency: 'GBP', amount: { amount: '105.00', currency: 'GBP' } },
        { currency: 'USD', amount: { amount: '440.00', currency: 'USD' } },
      ],
    }

    it('never mixes currencies into one tree', () => {
      // Without the currency filter, `food` would appear twice in the same tree and the totals
      // would be an addition of GBP to USD, which ADR-0002 refuses to perform.
      const gbp = buildLabelBreakdown(multi, 'GBP')
      const usd = buildLabelBreakdown(multi, 'USD')

      expect(gbp.roots.map((r) => r.name)).toEqual(['food'])
      expect(usd.roots.map((r) => r.name)).toEqual(['travel', 'food'])
    })

    it('reconciles independently within each currency', () => {
      for (const currency of currenciesIn(multi)) {
        const { roots, uncategorized } = buildLabelBreakdown(multi, currency)
        let sum = uncategorized?.own.amount ?? '0.00'
        for (const root of roots) sum = addAmounts(sum, root.rolledUp.amount)

        expect(sum).toBe(addAmounts(totalFor(multi, currency) ?? '0', '0'))
      }
    })

    it('reports Uncategorized only for the currency that has one', () => {
      expect(buildLabelBreakdown(multi, 'GBP').uncategorized).not.toBeNull()
      expect(buildLabelBreakdown(multi, 'USD').uncategorized).toBeNull()
    })
  })

  it('returns an empty breakdown for a currency with no activity', () => {
    const { roots, uncategorized } = buildLabelBreakdown(REPORT, 'JPY')
    expect(roots).toEqual([])
    expect(uncategorized).toBeNull()
    expect(totalFor(REPORT, 'JPY')).toBeNull()
  })
})
