import type { NetWorthReport } from '../api/generated/types.gen'
import type { AppProblem } from '../api/problem'
import { ProblemBanner } from '../components/ProblemBanner'
import { MoneyText } from '../money/MoneyText'
import styles from './NetWorthStrip.module.css'

// Assets minus Liabilities, as of today — the only figure on this page that takes no parameters.
//
// It sits ABOVE the range control and outside its scope, which is the whole reason it is a strip
// rather than a fourth panel: change the range to last month and this does not move, and the
// layout has to say why before the "as of today" label is read. That stillness is correct, not
// stale — ADR-0004 has the books never closing, so net worth is derived on demand and there is no
// such thing as net worth "for June".
//
// Every currency is shown side by side and there is NO combined figure. Valuing across currencies
// needs a base currency and historical rates that ADR-0002 puts out of scope, so a single blended
// number would be a lie. /accounts already sets this precedent and its own comment calls the
// absence correct.

type NetWorthStripProps = {
  report: NetWorthReport | null
  problem: AppProblem | null
  loading: boolean
}

export function NetWorthStrip({ report, problem, loading }: NetWorthStripProps) {
  return (
    <section className={styles.strip} aria-labelledby="net-worth-heading" aria-busy={loading}>
      <div className={styles.labels}>
        <h2 className={styles.heading} id="net-worth-heading">
          Net worth
        </h2>
        <p className={styles.asOf}>as of today</p>
      </div>

      {problem !== null ? (
        <ProblemBanner problem={problem} />
      ) : loading ? (
        <div className={styles.placeholder} aria-hidden="true" />
      ) : report === null || report.byCurrency.length === 0 ? (
        <p className={styles.none}>No accounts yet.</p>
      ) : (
        <ul className={styles.figures}>
          {report.byCurrency.map((entry) => (
            <li key={entry.currency} className={styles.figure}>
              <MoneyText money={entry.netWorth} className={styles.amount} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
