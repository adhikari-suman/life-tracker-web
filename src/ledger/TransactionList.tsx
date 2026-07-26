import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Account, Label, Transaction } from '../api/generated/types.gen'
import { NETWORK_FAILURE, problemMessage, type AppProblem } from '../api/problem'
import type { CommitEntry } from './useCommitQueue'
import { TransactionRow } from './TransactionRow'
import { groupByDay, dayHeading, type DayItem } from './groupByDay'
import { todayISO } from './clock'
import styles from './TransactionList.module.css'

// The confirmation that entry worked, newest first, cut into days. Two regions: the few queue
// entries (pending, committing, failed) rendered directly at the top, and the committed history
// below, windowed so the DOM stays flat no matter how long the payload is — listTransactions has
// no pagination and returns the whole history, so the mitigation is client-side.
//
// Windowing over TWO heights. Rows are uniform, but a day heading is shorter, so the window can no
// longer be found by dividing scrollTop by a single row height. Instead every item's top edge is
// prefix-summed once per list change and the first visible item is found by binary search. That is
// the whole cost of the headings, and it is paid on the data changing rather than on every scroll.

const ROW_HEIGHT = 72 // px; committed rows are uniform.
const DAY_HEIGHT = 36 // px; a day heading.
const OVERSCAN = 6

function itemHeight(item: DayItem): number {
  return item.kind === 'day' ? DAY_HEIGHT : ROW_HEIGHT
}

/** Index of the last item whose top edge is at or above `y`. Offsets ascend, so: binary search. */
function indexAt(offsets: readonly number[], y: number): number {
  let low = 0
  let high = offsets.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (offsets[mid] <= y) low = mid
    else high = mid - 1
  }
  return low
}

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

  const items = useMemo(() => groupByDay(transactions), [transactions])

  // Top edge of every item, plus a final entry for the total height. Recomputed only when the list
  // changes, never on scroll.
  const offsets = useMemo(() => {
    const acc = new Array<number>(items.length + 1)
    acc[0] = 0
    for (let i = 0; i < items.length; i++) acc[i + 1] = acc[i] + itemHeight(items[i])
    return acc
  }, [items])

  const totalHeight = offsets[items.length]
  const start = Math.max(0, indexAt(offsets, scrollTop) - OVERSCAN)
  const end = Math.min(items.length, indexAt(offsets, scrollTop + (viewport || 600)) + 1 + OVERSCAN)
  const window = items.slice(start, end)

  // Headings are rendered from the device's own date so "Today" means today where the reader is —
  // the same wall clock the entry was recorded against (ADR-0018).
  const today = todayISO()

  const total = transactions.length
  const hasQueue = queueEntries.length > 0
  const nothingYet = !loading && !hasQueue && total === 0

  return (
    <section className={styles.list} aria-label="Recent transactions">
      <h2 className={styles.heading}>Recent</h2>

      {/* Pending / committing entries, inline. Hidden below the 1024px split, where the pinned
          MobileUndoToast is the recall affordance instead — so the countdown is not both
          below the fold here AND in the toast, which would double the role="status"
          announcement. Not windowed; there are only ever a handful. */}
      <div className={styles.pendingInline}>
        {queueEntries
          .filter((entry) => entry.status === 'pending' || entry.status === 'committing')
          .map((entry) => (
            <TransactionRow
              key={entry.id}
              transaction={entry.optimistic}
              accountsById={accountsById}
              labelsById={labelsById}
              committing={entry.status === 'committing'}
              pending={{ deadline: entry.deadline, onCancel: () => onCancel(entry.id) }}
            />
          ))}
      </div>

      {/* Failed entries stay inline at every width — they are not recallable and the toast does
          not carry them, so the list is where the user dismisses them. */}
      {queueEntries
        .filter((entry) => entry.status === 'failed')
        .map((entry) => (
          <TransactionRow
            key={entry.id}
            transaction={entry.committed ?? entry.optimistic}
            accountsById={accountsById}
            labelsById={labelsById}
            failed={{ message: failureMessage(entry.problem), onDismiss: () => onDismiss(entry.id) }}
          />
        ))}

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
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsets[start]}px)` }}>
            {window.map((item) =>
              item.kind === 'day' ? (
                <h3 key={item.key} className={styles.day} style={{ height: DAY_HEIGHT }}>
                  {dayHeading(item.date, today)}
                </h3>
              ) : (
                <div key={item.key} style={{ height: ROW_HEIGHT }}>
                  <TransactionRow
                    transaction={item.transaction}
                    accountsById={accountsById}
                    labelsById={labelsById}
                    onOpen={() => onOpen(item.transaction.id)}
                  />
                </div>
              ),
            )}
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
