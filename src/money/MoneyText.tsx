import type { Money } from '../api/generated/types.gen'
import { isNegativeAmount, isWireAmount } from './amount'
import styles from './MoneyText.module.css'

// The sole authority for putting a figure on screen. Every amount in the app renders through
// this component, which is what makes a column of them line up on the decimal.
//
// It renders the amount string EXACTLY as it arrived. No grouping separators are inserted, no
// digits are padded or trimmed, and Intl.NumberFormat is not used — it takes a number, so
// reaching for it would convert the amount to a double on the way to the screen, which is the
// one thing this app does not do with money. Legibility is the typeface's job instead: mono
// with tabular figures, which is why "1200.00" cannot be mistaken for "120.00" in a column.

type MoneyTextProps = {
  money: Money
  /**
   * Whether the ISO code is drawn. It is in the accessible name either way — a screen reader
   * must never read "1200.00" with no indication of what it is denominated in, even when the
   * layout makes that obvious to someone looking at it. Turn it off only where the currency is
   * already stated nearby, such as a column of balances under a per-currency heading.
   */
  showCurrency?: boolean
  className?: string
}

export function MoneyText({ money, showCurrency = true, className }: MoneyTextProps) {
  if (import.meta.env.DEV && !isWireAmount(money.amount)) {
    // Not a throw: a malformed figure is better on screen, where it is visible and reportable,
    // than a blank page. But it means something upstream produced an amount that the wire format
    // does not allow — most likely a number that was stringified somewhere — so it is worth
    // being loud about in development.
    console.warn(
      `[money] "${money.amount}" is not a valid wire amount. Something has converted an amount ` +
        `to a number, or built one without toMoney().`,
    )
  }

  // Determined from the leading character of the string. Nothing here compares to zero, because
  // comparing to zero would mean having a number.
  const negative = isNegativeAmount(money.amount)

  // The global classes from tokens.css, which the tokens file is explicit must be applied by
  // class rather than restated ad hoc — that rule is what keeps every figure in the app on the
  // same tabular grid. `money--negative` is a tint on an already-signed figure, never the only
  // thing distinguishing a negative from a positive.
  const classes = ['money', negative && 'money--negative', styles.money, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      {money.amount}
      {/* A non-breaking space, so an amount never wraps away from its currency code. */}
      <span className={showCurrency ? styles.currency : 'sr-only'}>{'\u00A0'}{money.currency}</span>
    </span>
  )
}
