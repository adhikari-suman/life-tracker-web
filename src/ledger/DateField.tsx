import { useId } from 'react'
import { todayISO } from './todayISO'
import styles from './DateField.module.css'

// Calendar date only — a transaction's date is a date, not a timestamp (ADR-0003). Defaults to
// today and is correct almost always, so it is present but quiet: a small control near the foot
// of the form, not competing with the amount. A native date input, for the platform date picker
// and full keyboard support at no cost.

type DateFieldProps = {
  value: string
  onChange: (next: string) => void
}

export function DateField({ value, onChange }: DateFieldProps) {
  const id = useId()
  const isToday = value === todayISO()

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Date{isToday && <span className={styles.today}> · today</span>}
      </label>
      <input
        id={id}
        className={styles.input}
        type="date"
        value={value}
        // A future-dated transaction is almost always a slip; today is the ceiling.
        max={todayISO()}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
