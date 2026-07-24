import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSession } from '../auth/useSession'
import { ActivityPanel } from '../reports/ActivityPanel'
import { KeptFigure } from '../reports/KeptFigure'
import { NetWorthStrip } from '../reports/NetWorthStrip'
import { ReportControls } from '../reports/ReportControls'
import {
  describeRange,
  paramsForRange,
  rangeFromParams,
  resolveRange,
  type RangeId,
} from '../reports/dateRange'
import { currenciesIn, totalFor } from '../reports/labelTree'
import { useActivity, useNetWorth } from '../reports/useReports'
import styles from './ReportsPage.module.css'

// The review surface. Three questions, three figures, and nothing that interprets them.
//
// The page reports; it does not reassure. There are no verdicts, no comparisons against last
// month, no "you did well" — Principle 1. The only evaluative mark anywhere on it is a minus
// sign.

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { state } = useSession()

  // Resolved once per navigation rather than per render, so "today" cannot shift mid-session and
  // silently move the range under the user.
  const range = useMemo(() => rangeFromParams(searchParams), [searchParams])

  const netWorth = useNetWorth()
  const spending = useActivity('spending', range)
  const income = useActivity('income', range)

  // Every currency either report mentions. Derived from the responses rather than from the
  // account list, so the control only ever offers a currency that has something to show.
  const currencies = useMemo(() => {
    const seen = new Set<string>()
    for (const report of [spending.data, income.data]) {
      if (report !== null) for (const code of currenciesIn(report)) seen.add(code)
    }
    return [...seen].sort()
  }, [spending.data, income.data])

  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null)
  const urlCurrency = searchParams.get('currency')
  const currency =
    [chosenCurrency, urlCurrency].find((code) => code !== null && currencies.includes(code)) ??
    currencies[0] ??
    'USD'

  function changeRange(id: RangeId) {
    const next = paramsForRange(resolveRange(id))
    // The currency scope survives a range change — it is a different axis, and losing it would
    // bounce a multi-currency reader back to a currency they did not ask for.
    if (urlCurrency !== null) next.set('currency', urlCurrency)
    setSearchParams(next)
  }

  function changeCurrency(code: string) {
    setChosenCurrency(code)
    const next = new URLSearchParams(searchParams)
    next.set('currency', code)
    // Client-side only: the response already holds every currency, so re-scoping needs no
    // request at all.
    setSearchParams(next, { replace: true })
  }

  const rangeLabel = describeRange(range)
  const spent = spending.data === null ? null : totalFor(spending.data, currency)
  const earned = income.data === null ? null : totalFor(income.data, currency)

  // A Book with no transactions at all, as opposed to one with none in this range. Only the first
  // is an instruction; the second is a fact about the period.
  const bookIsEmpty =
    range.id === 'all-time' &&
    spending.data !== null &&
    income.data !== null &&
    spending.data.totals.length === 0 &&
    income.data.totals.length === 0

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Reports</h1>

      <NetWorthStrip report={netWorth.data} problem={netWorth.problem} loading={netWorth.loading} />

      <ReportControls
        range={range}
        onRangeChange={changeRange}
        currencies={currencies}
        currency={currency}
        onCurrencyChange={changeCurrency}
      />

      <div className={styles.panels}>
        <ActivityPanel
          heading="Spent"
          rangeLabel={rangeLabel}
          currency={currency}
          report={spending.data}
          problem={spending.problem}
          loading={spending.loading}
          bookIsEmpty={bookIsEmpty || state.status !== 'authenticated'}
        />
        <ActivityPanel
          heading="Earned"
          rangeLabel={rangeLabel}
          currency={currency}
          report={income.data}
          problem={income.problem}
          loading={income.loading}
          bookIsEmpty={bookIsEmpty || state.status !== 'authenticated'}
        />
      </div>

      <KeptFigure spent={spent} earned={earned} currency={currency} />
    </div>
  )
}
