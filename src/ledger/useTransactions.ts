import { useCallback, useEffect, useState } from 'react'
import type { Transaction } from '../api/generated/types.gen'
import { listTransactions } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'

// The committed history, newest first (the server orders it). listTransactions accepts only an
// optional accountId — no pagination, no date range — so the whole history returns on every call.
// That is a known backend limitation (flagged for pagination); the list view mitigates it by
// windowing the DOM, not by pretending the payload is bounded.

export type UseTransactions = {
  transactions: Transaction[]
  loading: boolean
  problem: AppProblem | null
  /** Re-read the list. Called after a commit so the optimistic row is replaced by the real one. */
  refetch: () => Promise<void>
}

export function useTransactions(accountId?: string): UseTransactions {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<AppProblem | null>(null)

  const refetch = useCallback(async () => {
    const { data, error, response } = await listTransactions({
      query: accountId !== undefined ? { accountId } : undefined,
    })
    if (data !== undefined) {
      setTransactions(data)
      setProblem(null)
    } else {
      setProblem(toAppProblem(error, response))
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  return { transactions, loading, problem, refetch }
}
