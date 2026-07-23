import { useId, type ComponentPropsWithRef } from 'react'
import { sanitizeAmountInput } from './amount'
import styles from './AmountInput.module.css'

// The other half of the money-string discipline: the place a decimal string is created.
//
// The value is a string in React state, a string in the DOM, and a string in the request body.
// There is no point in its life at which it is a number, which is why there is no `parse` step
// here and no `format` step on the way back out.

type AmountInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** The raw decimal string. Always a string; never a number, and never undefined. */
  value: string
  /** Receives the sanitized string. The caller stores exactly what it is given. */
  onValueChange: (next: string) => void
  /** ISO 4217 code of the account the amount is denominated in. */
  currency: string
  label: string
  error?: string | null
}

export function AmountInput({
  value,
  onValueChange,
  currency,
  label,
  error = null,
  id,
  ...inputProps
}: AmountInputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
        {/* The brief requires the accessible name to carry the currency: a screen reader must
            never read "1200.00" with nothing to say what it is denominated in. The visible
            adornment inside the field says it to everyone else, and is aria-hidden so the code
            is not announced twice. */}
        <span className="sr-only"> in {currency}</span>
      </label>

      <div className={styles.wrapper}>
        <input
          {...inputProps}
          id={fieldId}
          className={styles.input}
          // type="text", NOT type="number". A number input hands out `valueAsNumber`, which is
          // the exact hazard this module exists to prevent; it also silently discards input the
          // browser considers invalid, so a user can type a character and watch the whole field
          // empty itself. `inputMode="decimal"` gets the numeric keypad on mobile without any
          // of that, which is the only reason type="number" would have been tempting.
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(sanitizeAmountInput(event.target.value))}
          // An amount is not a word and not a previously-used value. Autofill and spellcheck on
          // a figure are noise at best and a wrong-value suggestion at worst.
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? errorId : undefined}
        />
        <span className={styles.currency} aria-hidden="true">
          {currency}
        </span>
      </div>

      {error !== null && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}
