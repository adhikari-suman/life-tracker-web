import { useMemo } from 'react'
import type { ActivityReport } from '../api/generated/types.gen'
import type { AppProblem } from '../api/problem'
import { ProblemBanner } from '../components/ProblemBanner'
import { MoneyText } from '../money/MoneyText'
import { LabelTreeRow } from './LabelTreeRow'
import { MagnitudeBar } from './MagnitudeBar'
import { PanelSkeleton } from './PanelSkeleton'
import { buildLabelBreakdown, totalFor } from './labelTree'
import styles from './ActivityPanel.module.css'

// One component, rendered twice — Spent and Earned. The API returns the identical ActivityReport
// shape for both, so two different renderings would be arbitrary; the only differences are the
// heading and which endpoint filled it.
//
// The words are the entry surface's intent words. Someone recording a coffee picks "Spent"; this
// is the same word coming back. Not "Expenses" — that names the account kind, not the human act.
//
// The banner renders INSIDE the panel, never at page level: a failed spending request must leave
// the net worth figure and the income panel intact and readable.

type ActivityPanelProps = {
  heading: string
  /** Human-readable range, e.g. "1 – 24 Jul 2026". */
  rangeLabel: string
  currency: string
  report: ActivityReport | null
  problem: AppProblem | null
  loading: boolean
  /** True when the Book holds no transactions at all, as opposed to none in this range. */
  bookIsEmpty: boolean
}

export function ActivityPanel({
  heading,
  rangeLabel,
  currency,
  report,
  problem,
  loading,
  bookIsEmpty,
}: ActivityPanelProps) {
  const breakdown = useMemo(
    () => (report === null ? null : buildLabelBreakdown(report, currency)),
    [report, currency],
  )

  const total = report === null ? null : totalFor(report, currency)

  // A comparison of one thing is not a comparison. With a single row the bar spans the column at
  // 100%, encodes nothing, and — sitting beside the other panel at a different scale — invites a
  // cross-panel reading that is meaningless, since each bar is a share of its OWN total.
  const rowCount =
    breakdown === null ? 0 : breakdown.roots.length + (breakdown.uncategorized === null ? 0 : 1)
  const showBars = rowCount > 1

  return (
    <section className={styles.panel} aria-labelledby={`${heading}-heading`} aria-busy={loading}>
      <header className={styles.header}>
        <h2 className={styles.heading} id={`${heading}-heading`}>
          {heading}
        </h2>
        <p className={styles.range}>{rangeLabel}</p>
      </header>

      {problem !== null ? (
        <ProblemBanner problem={problem} />
      ) : loading ? (
        <PanelSkeleton />
      ) : (
        <>
          <p className={styles.total}>
            {total === null ? (
              <MoneyText money={{ amount: '0.00', currency }} />
            ) : (
              <MoneyText money={{ amount: total, currency }} />
            )}
          </p>

          {breakdown === null || (breakdown.roots.length === 0 && breakdown.uncategorized === null) ? (
            <p className={styles.empty}>
              {bookIsEmpty
                ? 'Nothing recorded yet. Transactions you record on the ledger appear here.'
                : 'Nothing recorded in this range.'}
            </p>
          ) : (
            <ul className={styles.tree}>
              {breakdown.roots.map((root) => (
                <LabelTreeRow
                  key={root.labelId}
                  node={root}
                  total={total ?? '0.00'}
                  showBars={showBars}
                />
              ))}

              {breakdown.uncategorized !== null ? (
                // Held outside the tree because it is not a label — it is the name for what is
                // left once every labelled posting has been counted (CONTEXT.md). It cannot be a
                // parent, a child, or a sibling of one, so it renders last, always.
                //
                // It still gets a bar. Its distinctness is carried by the italic name and the
                // absence of a disclosure control; leaving a hole in the bar column instead just
                // broke the one comparison the column exists to support.
                <li className={showBars ? styles.uncategorized : `${styles.uncategorized} ${styles.uncategorizedNoBars}`}>
                  <span className={styles.uncategorizedName}>{breakdown.uncategorized.name}</span>
                  {showBars ? (
                    <div className={styles.bar}>
                      <MagnitudeBar
                        amount={breakdown.uncategorized.own.amount}
                        total={total ?? '0.00'}
                      />
                    </div>
                  ) : null}
                  <MoneyText
                    money={breakdown.uncategorized.own}
                    showCurrency={false}
                    className={styles.figure}
                  />
                </li>
              ) : null}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
