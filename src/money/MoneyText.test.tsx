import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MoneyText } from './MoneyText'

// MoneyText joins a figure to its currency code with a non-breaking space, so that a figure
// never wraps away from what denominates it. Written as an escape rather than pasted as a
// literal: the two are indistinguishable on screen, and a test that passes because someone
// happened to paste the right invisible character is a test that will fail for no visible
// reason the next time it is edited.
const NBSP = '\u00A0'

// These tests once asserted that MoneyText rendered the wire string VERBATIM — no separators, no
// trimming. That changed deliberately when the reports surface landed: four fractional digits are
// noise down a column of figures, and an ungrouped five-figure net worth is illegible.
//
// What did NOT change, and is what these tests exist to defend, is that the presentation is built
// by string surgery and never by a number. Every digit the server sent is still on screen unless
// it was a trailing zero past the currency's minor units. Nothing is rounded. Nothing is dropped.

describe('MoneyText', () => {
  it.each([
    ['1200.0000', '1,200.00'],
    ['0.0000', '0.00'],
    ['-5.0000', '-5.00'],
    ['999.0000', '999.00'],
  ])('renders %s as %s — grouped, and trimmed to the minor units', (amount, shown) => {
    const { container } = render(<MoneyText money={{ amount, currency: 'USD' }} />)
    // textContent rather than a matcher, so this asserts the literal characters on screen.
    expect(container.textContent).toBe(`${shown}${NBSP}USD`)
  })

  it('never hides a non-zero digit, however far right it sits', () => {
    // The load-bearing assertion. Trimming stops at trailing zeros; it does not round, because
    // rounding here would be the display layer quietly disagreeing with the ledger about how
    // much money there is.
    const { container } = render(<MoneyText money={{ amount: '12.3456', currency: 'USD' }} />)
    expect(container.textContent).toBe(`12.3456${NBSP}USD`)
  })

  it('carries an amount no double could hold, digit for digit', () => {
    // 9007199254740993.99 is past Number.MAX_SAFE_INTEGER: a double renders it as
    // 9007199254740994. Every digit below is the original, with separators added around them.
    const { container } = render(
      <MoneyText money={{ amount: '9007199254740993.99', currency: 'USD' }} />,
    )
    expect(container.textContent).toBe(`9,007,199,254,740,993.99${NBSP}USD`)
    // Stripping the presentation must give back exactly what came off the wire.
    expect(container.textContent?.replace(/[,\u00A0]|USD/g, '')).toBe('9007199254740993.99')
  })

  it('respects a currency that is not two-decimal', () => {
    const { container } = render(<MoneyText money={{ amount: '1000.0000', currency: 'JPY' }} />)
    expect(container.textContent).toBe(`1,000${NBSP}JPY`)
  })

  it('puts the currency in the accessible text even when it is not drawn', () => {
    const { container } = render(
      <MoneyText money={{ amount: '1200.00', currency: 'GBP' }} showCurrency={false} />,
    )
    // Still in the DOM, so a screen reader reads it; hidden by .sr-only, so it is not drawn.
    expect(container.textContent).toBe(`1,200.00${NBSP}GBP`)
    expect(container.querySelector('.sr-only')).not.toBeNull()
  })

  it('applies the tokens’ global money classes rather than restating the styles', () => {
    const { container } = render(<MoneyText money={{ amount: '12.34', currency: 'USD' }} />)
    expect(container.firstElementChild).toHaveClass('money')
  })

  it('tints a negative amount, which the leading sign already carries', () => {
    const { container } = render(<MoneyText money={{ amount: '-5.00', currency: 'USD' }} />)
    expect(container.firstElementChild).toHaveClass('money--negative')
    // The point of the assertion: the sign is present in the text, so the meaning survives with
    // the colour removed. Colour is reinforcement here, never the only signal.
    expect(screen.getByText(/^-5\.00/)).toBeInTheDocument()
  })

  it('does not tint a positive amount', () => {
    const { container } = render(<MoneyText money={{ amount: '5.00', currency: 'USD' }} />)
    expect(container.firstElementChild).not.toHaveClass('money--negative')
  })
})
