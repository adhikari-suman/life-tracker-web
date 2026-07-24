import { useId } from 'react'
import { UNDO_WINDOW_CHOICES } from './useUndoSetting'
import styles from './UndoSettingControl.module.css'

// The control the WCAG 2.2.1 requirement points to: the undo window is adjustable, and can be
// turned off. Kept small and quiet beneath the form — it is a setting, not part of the entry
// flow — but present, because a fixed, un-disableable timed action would be a barrier.

type UndoSettingControlProps = {
  windowMs: number
  onChange: (ms: number) => void
}

function labelFor(ms: number): string {
  return ms === 0 ? 'Off' : `${ms / 1000}s`
}

export function UndoSettingControl({ windowMs, onChange }: UndoSettingControlProps) {
  const id = useId()
  return (
    <div className={styles.control}>
      <label className={styles.label} htmlFor={id}>
        Undo window
      </label>
      <select
        id={id}
        className={styles.select}
        value={String(windowMs)}
        onChange={(event) => {
          // A duration in ms, not money — the numeric ban is about amounts.
          // oxlint-disable-next-line no-restricted-globals
          onChange(Number.parseInt(event.target.value, 10))
        }}
      >
        {UNDO_WINDOW_CHOICES.map((ms) => (
          <option key={ms} value={String(ms)}>
            {labelFor(ms)}
          </option>
        ))}
      </select>
      {windowMs === 0 && (
        <span className={styles.note}>Entries save immediately. Correct a mistake by reversing it.</span>
      )}
    </div>
  )
}
