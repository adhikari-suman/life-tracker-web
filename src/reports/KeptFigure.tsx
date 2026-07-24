import { subtractAmounts } from '../money/amount'
import { MoneyText } from '../money/MoneyText'
import styles from './KeptFigure.module.css'

// Earned − Spent, for one currency, over the selected range.
//
// Honest by construction: transfers, card payments and lends never touch an Income or Expense
// account (ADR-0001), so they are absent from both figures and cannot leak into the difference.
// Within one currency this really is what came in minus what went out.
//
// "Kept", not "Saved" — saved implies virtue, and Principle 1 has this surface reporting rather
// than grading. Not "Net" either, which is the accounting jargon the entry surface spent effort
// avoiding. It is stated as a bare figure: no percentage, no comparison, no adjective. A negative
// Kept gets the standing negative tint and its minus sign, and nothing else — there is no red for
// bad here, because money is not colour-coded (token decision 1).

type KeptFigureProps = {
  spent: string | null
  earned: string | null
  currency: string
}

export function KeptFigure({ spent, earned, currency }: KeptFigureProps) {
  // Both panels must have answered. Showing a Kept figure derived from one arrived response and
  // one absent would state a difference from an unknown, which is worse than showing nothing.
  if (spent === null || earned === null) return null

  const kept = subtractAmounts(earned, spent)

  return (
    <section className={styles.kept} aria-labelledby="kept-heading">
      <h2 className={styles.heading} id="kept-heading">
        Kept
      </h2>
      <MoneyText money={{ amount: kept, currency }} className={styles.amount} />
    </section>
  )
}
