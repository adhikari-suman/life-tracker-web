import { useId } from 'react'
import type { Account, AccountKind } from '../api/generated/types.gen'
import styles from './AccountPicker.module.css'

// One side of the movement. Filtered by kind according to the active intent — that filtering is
// what makes a wrong pairing unreachable rather than merely rejected: "Spent on" offers only
// expense accounts, so an internal transfer cannot be typed as spending in the first place.
//
// A native <select>, deliberately. It is the most keyboard-operable control there is, it needs
// no custom dropdown to reinvent focus trapping and type-ahead, and Rams would pick the plain
// working control over a bespoke one every time. Each option carries its currency because that
// is what determines whether the entry becomes cross-currency, and the user must see it before
// committing to a pairing.

type AccountPickerProps = {
  label: string
  /** The kinds this side may hold, from the active intent. */
  kinds: readonly AccountKind[]
  accounts: readonly Account[]
  /** Selected account id, or '' for the unchosen placeholder. */
  value: string
  onChange: (accountId: string) => void
  /** An account id to exclude — the other side, so the same account cannot fill both (SAME_ACCOUNT). */
  excludeId?: string
  disabled?: boolean
}

export function AccountPicker({
  label,
  kinds,
  accounts,
  value,
  onChange,
  excludeId,
  disabled = false,
}: AccountPickerProps) {
  const id = useId()

  const options = accounts.filter((a) => kinds.includes(a.kind) && a.id !== excludeId)

  // A side with no eligible account is a real state on a minimal Book — e.g. no liability exists
  // yet, so "Paid off" has nothing to pay. Say so plainly rather than presenting an empty menu
  // that looks broken.
  const empty = options.length === 0

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.wrapper}>
        <select
          id={id}
          className={styles.select}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || empty}
        >
          <option value="" disabled>
            {empty ? 'No eligible account' : 'Choose an account'}
          </option>
          {options.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </select>
        {/* A caret drawn in CSS, aria-hidden — the select supplies its own semantics. */}
        <span className={styles.caret} aria-hidden="true" />
      </div>
    </div>
  )
}
