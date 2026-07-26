import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WhenField } from './WhenField'
import { todayISO } from './clock'

// The reveal rule, which is the whole of ADR-0018's client-side mitigation: while the date is
// today the device clock is a true reading and the field stays out of the way; the moment the
// entry is backdated that stops being true, so the field appears and the guess becomes a proposal
// the user can correct.
//
// Stateful harness, like AmountInput's — WhenField is controlled, so a test that never feeds the
// new value back would be typing into an input that keeps resetting.

function Harness({ initialDate, initialTime = '19:42', onTime }: { initialDate: string; initialTime?: string; onTime?: (t: string) => void }) {
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  return (
    <WhenField
      date={date}
      time={time}
      onDateChange={setDate}
      onTimeChange={(next) => {
        setTime(next)
        onTime?.(next)
      }}
    />
  )
}

describe('WhenField reveals the time only once the entry is backdated', () => {
  it('shows no time input while the date is today', () => {
    render(<Harness initialDate={todayISO()} />)
    expect(screen.queryByLabelText('at')).toBeNull()
  })

  it('marks the date as today, so the default is visibly a default', () => {
    render(<Harness initialDate={todayISO()} />)
    expect(screen.getByText(/today/)).toBeInTheDocument()
  })

  it('shows the time, prefilled, once the date is moved off today', () => {
    render(<Harness initialDate="2026-07-21" />)
    expect(screen.getByLabelText('at')).toHaveValue('19:42')
  })

  it('reports an edited time to the caller', async () => {
    const user = userEvent.setup()
    const onTime = vi.fn()
    render(<Harness initialDate="2026-07-21" onTime={onTime} />)

    const input = screen.getByLabelText('at')
    await user.clear(input)
    await user.type(input, '0815')

    expect(input).toHaveValue('08:15')
    expect(onTime).toHaveBeenLastCalledWith('08:15')
  })

  it('hides the time again when the date returns to today', () => {
    render(<Harness initialDate="2026-07-21" />)
    expect(screen.getByLabelText('at')).toBeInTheDocument()

    // fireEvent rather than user.type: a native date input is segmented, and typing it out
    // keystroke by keystroke is not reliably reproducible in jsdom. What matters here is the
    // component's reaction to the value, not the platform's editing behaviour.
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: todayISO() } })

    expect(screen.queryByLabelText('at')).toBeNull()
  })

  it('caps the date at today — a future-dated transaction is almost always a slip', () => {
    render(<Harness initialDate="2026-07-21" />)
    expect(screen.getByLabelText(/Date/)).toHaveAttribute('max', todayISO())
  })
})
