import { useCallback, useEffect, useState } from 'react'
import type { Label } from '../api/generated/types.gen'
import { createLabel, listLabels } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'

// Labels are fetched once and filtered in memory. The spec is explicit that there is
// deliberately no search endpoint — a personal Book holds dozens of labels, not thousands — so
// the whole tree comes down on the first ledger visit and the picker filters the cached copy.
//
// Inline creation lives here too, because label management is out of scope for this build: with
// no way to create a label, every transaction would be permanently Uncategorized. A new label is
// appended to the cache rather than triggering a refetch, so it appears in the picker at once.

export type UseLabels = {
  labels: Label[]
  loading: boolean
  /** A load failure. Null while the (cached) list is usable. */
  problem: AppProblem | null
  /** Create a root label and return it, or null if the create failed. */
  create: (name: string) => Promise<Label | null>
}

export function useLabels(): UseLabels {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<AppProblem | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const { data, error, response } = await listLabels()
      if (!live) return
      if (data !== undefined) {
        setLabels(data)
        setProblem(null)
      } else {
        setProblem(toAppProblem(error, response))
      }
      setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [])

  const create = useCallback(async (name: string): Promise<Label | null> => {
    // Root label only. Reparenting and nesting belong to label management, which is out of
    // scope; a flat create is enough to get a transaction categorized, which is the whole point.
    const { data } = await createLabel({ body: { name: name.trim() } })
    if (data === undefined) return null
    setLabels((current) => [...current, data])
    return data
  }, [])

  return { labels, loading, problem, create }
}
