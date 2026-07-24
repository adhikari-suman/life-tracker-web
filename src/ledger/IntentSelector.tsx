import { INTENTS, type Intent } from './intents'
import styles from './IntentSelector.module.css'

// The first and most important control on the entry screen: choosing the intent is what
// pre-filters the two account pickers by kind, which is the whole mechanism that removes
// double-entry thinking. Always visible, never a dropdown — the four options must be comparable
// at a glance, and a dropdown hides three of them behind a tap.
//
// A radiogroup, not a row of buttons: exactly one is chosen at a time, and the arrow-key roving
// that a radiogroup gives for free is the keyboard-first path this form is built around.

type IntentSelectorProps = {
  value: Intent
  onChange: (next: Intent) => void
}

export function IntentSelector({ value, onChange }: IntentSelectorProps) {
  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label="What happened"
      onKeyDown={(event) => {
        // Roving arrow keys, wrapping. Home/End jump to the ends. This is the radiogroup
        // convention, and it is what makes the selector operable without leaving the keyboard.
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
        if (delta === 0 && event.key !== 'Home' && event.key !== 'End') return
        event.preventDefault()
        const index = INTENTS.findIndex((s) => s.intent === value)
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? INTENTS.length - 1
              : (index + delta + INTENTS.length) % INTENTS.length
        onChange(INTENTS[next].intent)
      }}
    >
      {INTENTS.map((spec) => {
        const selected = spec.intent === value
        return (
          <button
            key={spec.intent}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the selected radio is in the tab order; arrow keys move within the group.
            tabIndex={selected ? 0 : -1}
            className={selected ? `${styles.option} ${styles.selected}` : styles.option}
            onClick={() => onChange(spec.intent)}
          >
            {spec.label}
          </button>
        )
      })}
    </div>
  )
}
