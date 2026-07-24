import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { RecordTransactionRequest } from '../api/generated/types.gen'
import { useSession } from '../auth/useSession'
import { EntryForm } from '../ledger/EntryForm'
import { draftFromRequest, type EntryDraft } from '../ledger/entryDraft'
import { TransactionList } from '../ledger/TransactionList'
import { useLabels } from '../ledger/useLabels'
import { useTransactions } from '../ledger/useTransactions'
import { useCommitQueue } from '../ledger/useCommitQueue'
import { useUndoSetting } from '../ledger/useUndoSetting'
import { UndoSettingControl } from '../ledger/UndoSettingControl'
import styles from './LedgerPage.module.css'

// The 80% view, and in a real sense the whole app: the entry form and the recent list, side by
// side from 1024px so a catch-up session becomes a rhythm — type, it lands beside you, type the
// next. Below that the list falls under the form. Everything else in the product is support for
// what happens here.

// A stable empty array, so `accounts` keeps one identity across renders and the memos below do
// not recompute every time.
const NO_ACCOUNTS: never[] = []

export function LedgerPage() {
  const { state } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const accountFilter = searchParams.get('account') ?? undefined

  const accounts = state.status === 'authenticated' ? state.accounts : NO_ACCOUNTS
  const { labels, create } = useLabels()
  const { transactions, loading, problem, refetch } = useTransactions(accountFilter)
  const { windowMs, setWindowMs } = useUndoSetting()

  // A pre-filled draft, used to restore a failed entry's values (and by reversal, via router
  // state). Changing its identity re-seeds the form.
  const [restored, setRestored] = useState<EntryDraft | undefined>(undefined)
  const restoredIds = useRef(new Set<string>())

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])

  const queue = useCommitQueue({
    undoWindowMs: windowMs,
    onCommitted: () => {
      // The server list now holds the real transaction; refetch so the optimistic row is
      // replaced by it. The committed queue entry is deduped out below and then dismissed.
      void refetch()
    },
  })

  // Reconcile: once a committed entry's server transaction appears in the fetched list, drop the
  // queue entry so it is not shown twice.
  const serverIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions])
  useEffect(() => {
    for (const entry of queue.entries) {
      if (entry.status === 'committed' && entry.committed && serverIds.has(entry.committed.id)) {
        queue.dismiss(entry.id)
      }
    }
  }, [queue, serverIds])

  // Restore a failed entry's values to the form, once each. The failed row stays visible with a
  // Dismiss until the user clears it; this just makes sure the work is not lost.
  useEffect(() => {
    for (const entry of queue.entries) {
      if (entry.status === 'failed' && !restoredIds.current.has(entry.id)) {
        restoredIds.current.add(entry.id)
        setRestored(draftFromRequest(entry.request, accountsById))
      }
    }
  }, [queue.entries, accountsById])

  const visibleQueue = queue.entries.filter(
    (e) => !(e.status === 'committed' && e.committed && serverIds.has(e.committed.id)),
  )

  // A reversal arrives via router state from the detail view: stage it in the queue (once), so it
  // appears as a pending row with a countdown and Cancel — reviewed, not posted silently. The
  // history entry is replaced so a refresh or Back does not re-stage it.
  const stagedReverse = useRef<RecordTransactionRequest | null>(null)
  useEffect(() => {
    const reverse = (location.state as { reverse?: RecordTransactionRequest } | null)?.reverse
    if (reverse !== undefined && stagedReverse.current !== reverse) {
      stagedReverse.current = reverse
      queue.submit(reverse)
      void navigate('/', { replace: true, state: null })
    }
  }, [location.state, navigate, queue])

  function handleSubmit(request: RecordTransactionRequest) {
    queue.submit(request)
  }

  return (
    <div className={styles.layout}>
      <div className={styles.entry}>
        <EntryForm
          accounts={accounts}
          labels={labels}
          onCreateLabel={create}
          onSubmit={handleSubmit}
          initialDraft={restored}
        />
        <UndoSettingControl windowMs={windowMs} onChange={setWindowMs} />
      </div>

      <div className={styles.recent}>
        <TransactionList
          queueEntries={visibleQueue}
          transactions={transactions}
          accountsById={accountsById}
          labelsById={labelsById}
          loading={loading}
          problem={problem}
          onCancel={queue.cancel}
          onDismiss={queue.dismiss}
          onOpen={(id) => void navigate(`/transactions/${id}`)}
        />
      </div>
    </div>
  )
}
