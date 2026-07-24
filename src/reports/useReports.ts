import { useEffect, useState } from 'react'
import { getIncome, getNetWorth, getSpending } from '../api/generated/sdk.gen'
import type { ActivityReport, NetWorthReport } from '../api/generated/types.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import type { DateRange } from './dateRange'

// Three independent requests, three independent results. They are deliberately NOT combined into
// one loading flag or one error: a failed spending request must leave the net worth figure and
// the income panel fully readable, and the page fills top-down in reading order as each lands.

export type Resource<T> = {
  data: T | null
  problem: AppProblem | null
  loading: boolean
}

const PENDING = { data: null, problem: null, loading: true } as const

export function useNetWorth(): Resource<NetWorthReport> {
  const [state, setState] = useState<Resource<NetWorthReport>>(PENDING)

  useEffect(() => {
    let live = true
    void (async () => {
      const { data, error, response } = await getNetWorth()
      if (!live) return
      setState({
        data: data ?? null,
        problem: data === undefined ? toAppProblem(error, response) : null,
        loading: false,
      })
    })()
    return () => {
      live = false
    }
  }, [])

  return state
}

/**
 * Spending or income over a range.
 *
 * `from`/`to` are omitted entirely for all-time rather than sent empty — the spec says omitting
 * the bound means no bound, and sending `from=` would be a malformed date the server is right to
 * reject.
 */
export function useActivity(kind: 'spending' | 'income', range: DateRange): Resource<ActivityReport> {
  const [state, setState] = useState<Resource<ActivityReport>>(PENDING)

  // Depend on the resolved dates rather than the range object, which is rebuilt every render.
  const from = range.from
  const to = range.to

  useEffect(() => {
    let live = true
    setState((previous) => ({ ...previous, loading: true, problem: null }))

    void (async () => {
      const query = from !== null && to !== null ? { from, to } : undefined
      const fetcher = kind === 'spending' ? getSpending : getIncome
      const { data, error, response } = await fetcher({ query })
      if (!live) return
      setState({
        data: data ?? null,
        problem: data === undefined ? toAppProblem(error, response) : null,
        loading: false,
      })
    })()

    return () => {
      live = false
    }
  }, [kind, from, to])

  return state
}
