import { useId, type ComponentPropsWithRef } from 'react'
import styles from './TextField.module.css'

type TextFieldProps = ComponentPropsWithRef<'input'> & {
  label: string
  /** When set, the field is marked invalid and this is announced as part of it. */
  error?: string | null
}

/**
 * A labelled text input. The label is a real <label for>, not a placeholder and not an
 * aria-label: placeholders vanish the moment you type, which is exactly when someone
 * double-checking a form needs to know what they are looking at.
 */
export function TextField({ label, error = null, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={fieldId}
        className={styles.input}
        aria-invalid={error !== null}
        // Only points at the error when there is one — a dangling describedby is a reference to
        // an element that does not exist, which some screen readers report as a broken node.
        aria-describedby={error !== null ? errorId : undefined}
      />
      {error !== null && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}
