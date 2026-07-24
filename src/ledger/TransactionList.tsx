import { useLayoutEffect, useRef, useState } from 'react'
import type { Account, Label, Transaction } from '../api/generated/types.gen'
import { NETWORK_FAILURE, problemMessage, type AppProblem } from '../api/problem'
import type { CommitEntry } from './useCommitQueue'
import { TransactionRow } from './TransactionRow'
import styles from './TransactionList.module.css'

// The confirmation that entry worked, newest first. Two regions: the few queue entries (pending,
// committing, failed) rendered directly at the top, and the committed history below, windowed so
// the DOM stays flat no matter how long the payload is — listTransactions has no pagination and
// returns the whole history, so the mitigation is client-side.

const ROW_HEIGHT = 72 // px; committed rows are uniform, which is what makes windowing possible.
const OVERSCAN = 6

type TransactionListProps = {
  queueEntries: CommitEntry[]
  transactions: Transaction[]
  accountsById: ReadonlyMap<string, Account>
  labelsById: ReadonlyMap<string, Label>
  loading: boolean
  problem: AppProblem | null
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
  onOpen: (transactionId: string) => void
}

export function TransactionList({
  queueEntries,
  transactions,
  accountsById,
  labelsById,
  loading,
  problem,
  onCancel,
  onDismiss,
  onOpen,
}: TransactionListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    setViewport(el.clientHeight)
    // Keep the window sized correctly when the panel resizes (e.g. the responsive breakpoint).
    // Guarded: ResizeObserver is absent in some test environments and very old browsers, where a
    // fixed initial measurement is a fine fallback rather than a crash.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setViewport(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const total = transactions.length
  const visibleCount = Math.ceil((viewport || 600) / ROW_HEIGHT) + OVERSCAN * 2
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(total, start + visibleCount)
  const window = transactions.slice(start, end)

  const hasQueue = queueEntries.length > 0
  const nothingYet = !loading && !hasQueue && total === 0

  return (
    <section className={styles.list} aria-label="Recent transactions">
      <h2 className={styles.heading}>Recent</h2>

      {/* Pending / committing / failed entries. Not windowed — there are only ever a handful. */}
      {queueEntries.map((entry) => {
        const transaction = entry.committed ?? entry.optimistic
        if (entry.status === 'pending' || entry.status === 'committing') {
          return (
            <TransactionRow
              key={entry.id}
              transaction={transaction}
              accountsById={accountsById}
              labelsById={labelsById}
              committing={entry.status === 'committing'}
              pending={{ deadline: entry.deadline, onCancel: () => onCancel(entry.id) }}
            />
          )
        }
        if (entry.status === 'failed') {
          return (
            <TransactionRow
              key={entry.id}
              transaction={transaction}
              accountsById={accountsById}
              labelsById={labelsById}
              failed={{ message: failureMessage(entry.problem), onDismiss: () => onDismiss(entry.id) }}
            />
          )
        }
        // 'committed' entries are shown by the server list once refetched; render nothing here.
        return null
      })}

      {problem !== null && total === 0 && (
        <p className={styles.note}>Could not load your transactions. {problem.code === NETWORK_FAILURE ? 'Check your connection.' : 'Try again shortly.'}</p>
      )}

      {nothingYet && (
        <p className={styles.note}>Nothing recorded yet. Your first entry will land here.</p>
      )}

      {/* The committed history, windowed. Spacers above and below hold the scrollbar honest while
          only the visible slice is in the DOM. */}
      <div
        className={styles.scroll}
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: total * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {window.map((transaction) => (
              <div key={transaction.id} style={{ height: ROW_HEIGHT }}>
                <TransactionRow
                  transaction={transaction}
                  accountsById={accountsById}
                  labelsById={labelsById}
                  onOpen={() => onOpen(transaction.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function failureMessage(problem: AppProblem | undefined): string {
  if (problem === undefined) return 'Could not save this entry. Your values are back in the form.'
  // The specific reason from the shared catalogue, plus the reassurance that nothing was lost —
  // the entered values are restored to the form on any failure.
  return `${problemMessage(problem)} Your values are back in the form.`
}
