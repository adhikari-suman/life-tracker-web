import { useId } from 'react'
import { todayISO } from './clock'
import styles from './WhenField.module.css'

// When the money moved — Occurred At, a wall clock and never an instant (ADR-0018).
//
// The date defaults to today and is correct almost always, so it is present but quiet: a small
// control near the foot of the form, not competing with the amount. Native date/time inputs, for
// the platform pickers and full keyboard support at no cost.
//
// The TIME is deliberately hidden while the date is today. Recording something as it happens, the
// device clock is a true reading and asking for it would be friction on the one flow this form
// exists to make fast. The moment the date moves off today that stops being true — a Friday clock
// reading stamped on Tuesday is a value that was never real — so the field appears exactly there,
// prefilled and editable. This is the only place ADR-0018's "there is no way to say unknown" can
// be softened: the column is NOT NULL and the server refuses to guess, so a client cannot decline
// to answer. It can only make the answer visible and correctable.

type WhenFieldProps = {
  date: string
  time: string
  onDateChange: (next: string) => void
  onTimeChange: (next: string) => void
}

export function WhenField({ date, time, onDateChange, onTimeChange }: WhenFieldProps) {
  const dateId = useId()
  const timeId = useId()
  const isToday = date === todayISO()

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={dateId}>
        Date{isToday && <span className={styles.today}> · today</span>}
      </label>
      <div className={styles.inputs}>
        <input
          id={dateId}
          className={styles.input}
          type="date"
          value={date}
          // A future-dated transaction is almost always a slip; today is the ceiling.
          max={todayISO()}
          onChange={(event) => onDateChange(event.target.value)}
        />
        {!isToday && (
          <>
            <label className={styles.at} htmlFor={timeId}>
              at
            </label>
            <input
              id={timeId}
              className={styles.input}
              type="time"
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
            />
          </>
        )}
      </div>
    </div>
  )
}
