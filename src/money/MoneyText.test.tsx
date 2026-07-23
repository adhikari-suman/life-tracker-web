import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MoneyText } from './MoneyText'

// MoneyText joins a figure to its currency code with a non-breaking space, so that a figure
// never wraps away from what denominates it. Written as an escape rather than pasted as a
// literal: the two are indistinguishable on screen, and a test that passes because someone
// happened to paste the right invisible character is a test that will fail for no visible
// reason the next time it is edited.
const NBSP = '\u00A0'

describe('MoneyText', () => {
  it.each(['1200.00', '0.00', '12.3456', '9007199254740993.99', '-5.00'])(
    'renders %s exactly as given',
    (amount) => {
      const { container } = render(<MoneyText money={{ amount, currency: 'USD' }} />)
      // textContent rather than a matcher, so this asserts the literal characters on screen —
      // no grouping separators inserted, no trailing zeros trimmed, no rounding.
      expect(container.textContent).toBe(`${amount}${NBSP}USD`)
    },
  )

  it('puts the currency in the accessible text even when it is not drawn', () => {
    const { container } = render(
      <MoneyText money={{ amount: '1200.00', currency: 'GBP' }} showCurrency={false} />,
    )
    // Still in the DOM, so a screen reader reads it; hidden by .sr-only, so it is not drawn.
    expect(container.textContent).toBe(`1200.00${NBSP}GBP`)
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
