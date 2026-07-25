import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordTransactionRequest, Transaction } from '../api/generated/types.gen'
import { recordTransaction } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'

// The brief's central mechanism, and its highest-risk interaction. Speed and an append-only
// ledger are in direct conflict; a confirmation dialog on every entry resolves it in the wrong
// direction. So instead the entry HOLDS: on submit the row appears at once and a countdown
// starts, but the POST does not fire until the window elapses. Cancel inside the window and the
// row disappears having never reached the server. Caught in that window a mistake never
// happened; caught later, it is a reversing entry, which is what the domain prescribes anyway.
//
// The reconciliation with the server list is the caller's job: on commit this hands back the
// real Transaction, and the caller drops the optimistic row in favour of the refetched one.

export type CommitStatus = 'pending' | 'committing' | 'committed' | 'failed'

export type CommitEntry = {
  /** Local id, distinct from any server id. The optimistic Transaction carries it too. */
  id: string
  status: CommitStatus
  request: RecordTransactionRequest
  /** A synthesized Transaction so the list renders a pending row exactly like a committed one. */
  optimistic: Transaction
  /** The server's Transaction, once committed. */
  committed?: Transaction
  /** Why a commit failed. The form restores the entered values from `request`. */
  problem?: AppProblem
  /** Epoch ms when the POST fires. Drives the countdown. Absent once committing has begun. */
  deadline?: number
}

export type UseCommitQueue = {
  entries: CommitEntry[]
  /** Queue an entry. It holds for `undoWindowMs`, then commits — unless cancelled first. */
  submit: (request: RecordTransactionRequest) => void
  /** Cancel a still-pending entry. Nothing was ever sent. No-op once committing has started. */
  cancel: (id: string) => void
  /** Drop a committed or failed entry from the local queue (after the caller reconciles it). */
  dismiss: (id: string) => void
  /** Fires when an entry commits successfully, so the caller can refetch the real list. */
}

function optimisticTransaction(id: string, request: RecordTransactionRequest): Transaction {
  // Money leaves `from` (CREDIT) and arrives in `to` (DEBIT), mirroring how the server records
  // it, so describeTransaction reads the pending row identically to the committed one.
  return {
    id,
    date: request.date,
    exchangeRate: null,
    postings: [
      { id: `${id}-from`, accountId: request.from, direction: 'CREDIT', amount: request.amount },
      { id: `${id}-to`, accountId: request.to, direction: 'DEBIT', amount: request.toAmount ?? request.amount },
    ],
  }
}

type UseCommitQueueOptions = {
  /**
   * How long an entry stays recallable, in ms. 0 commits immediately (the "off" setting). This is
   * a product parameter, not styling, and WCAG 2.2.1 requires it be adjustable and disableable —
   * the ledger screen threads a user setting through here.
   */
  undoWindowMs: number
  /** Called with the server Transaction the moment an entry commits, for list reconciliation. */
  onCommitted?: (entry: CommitEntry, committed: Transaction) => void
}

export function useCommitQueue({ undoWindowMs, onCommitted }: UseCommitQueueOptions): UseCommitQueue {
  const [entries, setEntries] = useState<CommitEntry[]>([])

  // Timers, the pending-request map, and a monotonic counter live in refs so re-renders never
  // disturb them. The pending map is the source of truth for "may this still commit?", read
  // straight rather than off `entries` — which lags a tick behind a just-submitted entry, so a
  // zero-window immediate commit would otherwise find nothing to send.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingRequests = useRef(new Map<string, RecordTransactionRequest>())
  const counter = useRef(0)

  const onCommittedRef = useRef(onCommitted)
  onCommittedRef.current = onCommitted

  const doCommit = useCallback(async (id: string) => {
    timers.current.delete(id)
    // Gone from the pending map means cancelled (or already committing) — do nothing.
    const request = pendingRequests.current.get(id)
    if (request === undefined) return
    pendingRequests.current.delete(id)

    setEntries((current) => current.map((e) => (e.id === id ? { ...e, status: 'committing', deadline: undefined } : e)))

    const { data, error, response } = await recordTransaction({ body: request })

    if (data !== undefined) {
      setEntries((current) => current.map((e) => (e.id === id ? { ...e, status: 'committed', committed: data } : e)))
      onCommittedRef.current?.({ id, status: 'committed', request, optimistic: optimisticTransaction(id, request) }, data)
    } else {
      setEntries((current) =>
        current.map((e) => (e.id === id ? { ...e, status: 'failed', problem: toAppProblem(error, response) } : e)),
      )
    }
  }, [])

  const submit = useCallback(
    (request: RecordTransactionRequest) => {
      counter.current += 1
      const id = `commit-${counter.current}`
      const entry: CommitEntry = {
        id,
        status: 'pending',
        request,
        optimistic: optimisticTransaction(id, request),
        deadline: undoWindowMs > 0 ? Date.now() + undoWindowMs : undefined,
      }
      pendingRequests.current.set(id, request)
      setEntries((current) => [entry, ...current])

      if (undoWindowMs <= 0) {
        // Undo disabled: commit immediately, with no recallable window.
        void doCommit(id)
      } else {
        timers.current.set(
          id,
          setTimeout(() => void doCommit(id), undoWindowMs),
        )
      }
    },
    [doCommit, undoWindowMs],
  )

  const cancel = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    // Removing it from the pending map is what actually prevents the commit: even if the timer
    // has already fired and doCommit is queued, it will find nothing and no-op.
    const wasPending = pendingRequests.current.delete(id)
    if (wasPending) {
      setEntries((current) => current.filter((e) => e.id !== id))
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.filter((e) => e.id !== id))
  }, [])

  // Leaving — the tab closing, or navigating to another route within the SPA — while entries are
  // pending must not silently lose them. The user already submitted; the window is a chance to
  // recall, not an implicit discard, so the right default on departure is to COMMIT what is
  // pending, immediately, rather than warn or drop it. keepalive lets the request outlive an
  // unloading document.
  //
  // Flush pending entries when the PAGE goes away — a closed tab or a real navigation, where the
  // setTimeout that would have committed them dies with the document. keepalive is what lets the
  // request outlive it.
  //
  // This deliberately does NOT flush on React unmount, and that is a bug fix rather than an
  // omission. It used to, on the stated reasoning that StrictMode's dev double-invoke unmounts
  // "when nothing has been submitted and there is nothing to flush". That is true for a normal
  // visit — and false for the one flow that submits DURING mount: a reversal, which arrives as
  // router state and is staged from an effect in LedgerPage.
  //
  // The result was every symptom of the undo window being broken, from this one line. The
  // throwaway unmount fired with the reversal pending, flush posted it instantly — so a ten-second
  // window committed in milliseconds — and emptied pendingRequests. The remount then showed a
  // countdown for a request that no longer existed: doCommit found nothing and returned early, so
  // the row never moved to "Saving…" and sat at "0s to undo" with a live Cancel that silently did
  // nothing, because cancel had nothing left to cancel. Only reversals were affected; a typed
  // entry is submitted after mount has settled, so no unmount ever intervened.
  //
  // Nothing is lost by not flushing here. A pending entry's setTimeout is a real timer that still
  // fires after the component goes, and doCommit reads the refs rather than state, so an entry
  // staged before you navigated to /accounts still commits on its original schedule.
  useEffect(() => {
    function flush() {
      for (const [id, request] of pendingRequests.current) {
        const timer = timers.current.get(id)
        if (timer !== undefined) {
          clearTimeout(timer)
          timers.current.delete(id)
        }
        pendingRequests.current.delete(id)
        // Fire and forget with keepalive; we are going away and cannot await this.
        void recordTransaction({ body: request, keepalive: true })
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  return { entries, submit, cancel, dismiss }
}
