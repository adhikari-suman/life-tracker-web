import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ActivityReport, LabelAmount } from '../api/generated/types.gen'
import { UNKNOWN_PROBLEM } from '../api/problem'
import { ActivityPanel } from './ActivityPanel'

function row(
  labelId: string | null,
  name: string,
  parentLabelId: string | null,
  own: string,
  rolledUp: string,
): LabelAmount {
  return {
    labelId,
    name,
    path: name,
    parentLabelId,
    currency: 'GBP',
    own: { amount: own, currency: 'GBP' },
    rolledUp: { amount: rolledUp, currency: 'GBP' },
  }
}

const REPORT: ActivityReport = {
  from: '2026-07-01',
  to: '2026-07-24',
  byAccount: [],
  byLabel: [
    row('l-food', 'food', null, '0.00', '420.00'),
    row('l-groceries', 'groceries', 'l-food', '320.00', '320.00'),
    row('l-fastfood', 'fast food', 'l-food', '100.00', '100.00'),
    row('l-housing', 'housing', null, '1000.00', '1000.00'),
    row(null, 'Uncategorized', null, '18.50', '18.50'),
  ],
  totals: [{ currency: 'GBP', amount: { amount: '1438.50', currency: 'GBP' } }],
}

function renderPanel(overrides: Partial<Parameters<typeof ActivityPanel>[0]> = {}) {
  return render(
    <ActivityPanel
      heading="Spent"
      rangeLabel="1 – 24 Jul 2026"
      currency="GBP"
      report={REPORT}
      problem={null}
      loading={false}
      bookIsEmpty={false}
      {...overrides}
    />,
  )
}

describe('ActivityPanel', () => {
  it('shows the total, grouped and trimmed to the minor units', () => {
    renderPanel()
    expect(screen.getByText(/1,438\.50/)).toBeInTheDocument()
  })

  it('collapses to roots plus Uncategorized, which is what reconciles to the total', () => {
    renderPanel()
    // 1000.00 + 420.00 + 18.50 = 1438.50, the figure in the heading. Children are not on screen,
    // which is exactly why the visible figures add up.
    expect(screen.getByText('housing')).toBeInTheDocument()
    expect(screen.getByText('food')).toBeInTheDocument()
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
    expect(screen.queryByText('groceries')).not.toBeInTheDocument()
  })

  it('shows a parent its rolled-up figure, collapsed AND expanded', async () => {
    // `food` has own 0.00 and rolledUp 420.00. It must speak for its subtree in both states.
    // Showing `own` when expanded made the row drop to 0.00 the moment you opened it — the
    // second-largest category reading as zero, with its bar shrunk to a sliver. Clicking for more
    // detail must never make a number smaller.
    const user = userEvent.setup()
    renderPanel()

    expect(screen.getByText(/420\.00/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /food/ }))

    expect(screen.getByText(/420\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/^0\.00$/)).not.toBeInTheDocument()
  })

  it('expands to reveal children with their own figures', async () => {
    const user = userEvent.setup()
    renderPanel()

    const toggle = screen.getByRole('button', { name: /food/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('groceries')).toBeInTheDocument()
    expect(screen.getByText('fast food')).toBeInTheDocument()
  })

  it('gives a leaf NO disclosure control at all, rather than a disabled one', () => {
    renderPanel()
    // `housing` is a leaf. An affordance that does nothing is worse than no affordance.
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['▸food'])
    expect(screen.getByText('housing').closest('button')).toBeNull()
  })

  it('makes rows inert — no row is a link', () => {
    // Tapping a label is the obvious gesture and GET /transactions cannot serve it: accountId is
    // its only filter. A dead end is better seen than discovered.
    const { container } = renderPanel()
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('distinguishes an empty range from an empty Book', () => {
    const empty: ActivityReport = { byAccount: [], byLabel: [], totals: [] }

    const { unmount } = renderPanel({ report: empty, bookIsEmpty: false })
    expect(screen.getByText(/nothing recorded in this range/i)).toBeInTheDocument()
    unmount()

    renderPanel({ report: empty, bookIsEmpty: true })
    // One is a fact about the period; the other is an instruction.
    expect(screen.getByText(/nothing recorded yet/i)).toBeInTheDocument()
  })

  it('renders its failure inside itself, so a sibling panel survives', () => {
    const { container } = renderPanel({
      report: null,
      problem: { code: UNKNOWN_PROBLEM, status: 500, retryAfterSeconds: null },
    })
    const alert = within(container).getByRole('alert')
    expect(alert).toBeInTheDocument()
    // The heading is still there — the panel degraded, it did not disappear.
    expect(screen.getByRole('heading', { name: 'Spent' })).toBeInTheDocument()
  })

  it('holds a skeleton while loading, so nothing reflows when figures land', () => {
    const { container } = renderPanel({ report: null, loading: true })

    // The skeleton is decorative and hidden from assistive technology. Three requests resolve
    // independently on this page, so three live regions would announce "Loading" over each other
    // on arrival and again on every range change. aria-busy on the panel carries the state
    // without the announcement storm.
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(container.querySelector('section')).toHaveAttribute('aria-busy', 'true')
  })

  it('drops aria-busy once the figures are in', () => {
    const { container } = renderPanel()
    expect(container.querySelector('section')).toHaveAttribute('aria-busy', 'false')
  })

  it('exposes the tree structurally, not by indentation alone', () => {
    // Indent is invisible to a screen reader. The parent/child relation has to be real nesting.
    const { container } = renderPanel()
    const tree = container.querySelector('ul')
    expect(tree).toBeInTheDocument()
    expect(within(tree as HTMLElement).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('shows nothing for a currency the report does not mention', () => {
    renderPanel({ currency: 'JPY' })
    expect(screen.getByText(/nothing recorded in this range/i)).toBeInTheDocument()
  })
})
