import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Money } from '../api/generated/types.gen'
import { AmountInput } from './AmountInput'
import { MoneyText } from './MoneyText'
import { toMoney } from './amount'

/** The non-breaking space MoneyText joins a figure to its currency with. Never pasted. */
const NBSP = '\u00A0'

/** A host that stores whatever the input hands it, exactly as a real form would. */
function Harness({ onValue, currency = 'USD' }: { onValue?: (v: string) => void; currency?: string }) {
  const [value, setValue] = useState('')
  return (
    <AmountInput
      label="Amount"
      currency={currency}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValue?.(next)
      }}
    />
  )
}

describe('AmountInput', () => {
  it('gets the numeric keypad without becoming a number input', async () => {
    render(<Harness />)
    const input = screen.getByLabelText(/amount/i)
    // type="number" would hand out valueAsNumber and discard input the browser dislikes. The
    // keypad comes from inputMode instead.
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'decimal')
  })

  it('names itself with its currency, so a figure is never announced bare', () => {
    render(<Harness currency="GBP" />)
    // The accessible name, not the visible text — this is what a screen reader announces.
    expect(screen.getByLabelText('Amount in GBP')).toBeInTheDocument()
  })

  it('keeps 1200.00 as the string 1200.00 through every keystroke', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)

    const input = screen.getByLabelText(/amount/i)
    await user.type(input, '1200.00')

    expect(input).toHaveValue('1200.00')
    // Every intermediate value was a string too, not just the final one.
    for (const [value] of onValue.mock.calls) {
      expect(typeof value).toBe('string')
    }
    expect(onValue).toHaveBeenLastCalledWith('1200.00')
  })

  it('ignores characters that are not part of a decimal', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByLabelText(/amount/i)
    await user.type(input, '12abc.3e4')

    expect(input).toHaveValue('12.34')
  })

  it('refuses a fifth fractional digit rather than rounding to one', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByLabelText(/amount/i)
    await user.type(input, '12.34567')

    // Truncated, not rounded: rounding would invent a penny the user never typed.
    expect(input).toHaveValue('12.3456')
  })

  it('will not take a minus sign, because posting amounts are non-negative', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByLabelText(/amount/i)
    await user.type(input, '-5.00')

    expect(input).toHaveValue('5.00')
  })
})

describe('keystroke to wire and back', () => {
  it('carries a typed amount to a Money and onto the screen with no character changed', async () => {
    const user = userEvent.setup()
    let captured = ''
    render(<Harness onValue={(v) => (captured = v)} />)

    await user.type(screen.getByLabelText(/amount/i), '1200.00')

    // The step a form takes on submit. toMoney validates rather than converts.
    const money: Money = toMoney(captured, 'USD')
    expect(money).toEqual({ amount: '1200.00', currency: 'USD' })

    // And the figure as it comes back from the server and is rendered in the list. The gap is
    // MoneyText's non-breaking space; see the note in MoneyText.test.tsx for why it is written
    // as an escape and never pasted.
    //
    // The drawn figure now carries a thousands separator. That arrived with the reports surface
    // and is display only — built by string surgery in formatForDisplay, never by a number. It
    // changes how the figure is DRAWN; it does not change what it is.
    const { container } = render(<MoneyText money={money} />)
    expect(container.textContent).toBe(['1,200.00', 'USD'].join(NBSP))

    // Strip the presentation back off and every character the user typed is still there — which
    // is the assertion that would break if formatting had ever gone through a double.
    expect(container.textContent?.replace(/,/g, '')).toBe(['1200.00', 'USD'].join(NBSP))

    // The whole point, stated once: the same characters the user typed reach the wire untouched.
    expect(money.amount).toBe('1200.00')
  })
})
