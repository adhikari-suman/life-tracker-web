import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Transaction } from '../api/generated/types.gen'
import { clearPostingLabel, getTransaction, setPostingLabel } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { useSession } from '../auth/useSession'
import { MoneyText } from '../money/MoneyText'
import { ProblemBanner } from '../components/ProblemBanner'
import { FullPageWait } from '../components/FullPageWait'
import { accountsById, describeTransaction, reverseRequest } from '../ledger/describeTransaction'
import { LabelPicker } from '../ledger/LabelPicker'
import { useLabels } from '../ledger/useLabels'
import { todayISO } from '../ledger/todayISO'
import styles from './TransactionDetailPage.module.css'

// What happened, in the intent's language, reconstructed from the postings — never debits and
// credits. There is NO edit affordance, because the API has none: the only mutable thing about a
// committed transaction is its label, and the only correction is a reversing entry.

const NO_ACCOUNTS: never[] = []

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state } = useSession()
  const accounts = state.status === 'authenticated' ? state.accounts : NO_ACCOUNTS
  const { labels, create } = useLabels()

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [problem, setProblem] = useState<AppProblem | null>(null)
  const [loading, setLoading] = useState(true)
  const [relabeling, setRelabeling] = useState(false)

  const byId = useMemo(() => accountsById(accounts), [accounts])

  useEffect(() => {
    if (id === undefined) return
    let live = true
    setLoading(true)
    void (async () => {
      const { data, error, response } = await getTransaction({ path: { transactionId: id } })
      if (!live) return
      if (data !== undefined) setTransaction(data)
      else setProblem(toAppProblem(error, response))
      setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [id])

  if (loading) return <FullPageWait />

  if (transaction === null) {
    return (
      <div className={styles.page}>
        <BackLink onClick={() => void navigate('/')} />
        <ProblemBanner problem={problem} />
        <p className={styles.note}>This transaction could not be found.</p>
      </div>
    )
  }

  const d = describeTransaction(transaction, byId)
  const labelPosting = d.labelPosting
  const currentLabelId = labelPosting?.labelId ?? null

  async function changeLabel(labelId: string | null) {
    if (labelPosting === undefined || relabeling) return
    setRelabeling(true)
    const result =
      labelId === null
        ? await clearPostingLabel({ path: { postingId: labelPosting.id } })
        : await setPostingLabel({ path: { postingId: labelPosting.id }, body: { labelId } })
    setRelabeling(false)
    if (result.error !== undefined) {
      setProblem(toAppProblem(result.error, result.response))
      return
    }
    // Reflect the change locally without a refetch — relabel touches nothing else (no balance,
    // net-worth or per-account figure consults labels).
    setTransaction((current) =>
      current === null
        ? current
        : {
            ...current,
            postings: current.postings.map((p) => (p.id === labelPosting.id ? { ...p, labelId } : p)),
          },
    )
  }

  function reverse() {
    if (transaction === null) return
    // Compose the mirror and hand it to the ledger to stage in the undo queue — the app's own
    // review mechanism. It lands as a pending row with a countdown and Cancel rather than posting
    // silently, and the original stays in history either way (the ledger being honest).
    void navigate('/', { state: { reverse: reverseRequest(transaction, todayISO()) } })
  }

  return (
    <div className={styles.page}>
      <BackLink onClick={() => void navigate('/')} />

      <ProblemBanner problem={problem} />

      <header className={styles.header}>
        <span className={styles.verb}>{d.verb}</span>
        <MoneyText money={d.headlineAmount} className={styles.amount} />
      </header>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>From</dt>
          <dd className={styles.factValue}>
            {d.fromAccount?.name ?? 'Unknown account'}
            <MoneyText money={d.fromPosting.amount} className={styles.legAmount} />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>To</dt>
          <dd className={styles.factValue}>
            {d.toAccount?.name ?? 'Unknown account'}
            <MoneyText money={d.toPosting.amount} className={styles.legAmount} />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Date</dt>
          <dd className={styles.factValue}>{transaction.date}</dd>
        </div>
        {d.crossCurrency && d.exchangeRate !== null && (
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Rate</dt>
            {/* Reference only — never presented as something that produced an amount (ADR-0002). */}
            <dd className={styles.factValue}>
              {d.exchangeRate} <span className={styles.rateNote}>(for reference)</span>
            </dd>
          </div>
        )}
      </dl>

      {/* Relabel in place — the one mutable thing about a committed transaction. Rendered only
          where there is a single Income or Expense leg to carry a label. */}
      {labelPosting !== undefined && (
        <section className={styles.relabel} aria-busy={relabeling}>
          <LabelPicker labels={labels} value={currentLabelId} onChange={(l) => void changeLabel(l)} onCreate={create} />
        </section>
      )}

      {/* The only correction path once the undo window has passed. Not an edit — the API has none;
          it composes a mirror transaction, which is what the domain prescribes. */}
      <div className={styles.actions}>
        <button type="button" className={styles.reverse} onClick={reverse}>
          Reverse this
        </button>
        <p className={styles.reverseNote}>
          Records the opposite movement, dated today, for you to review before it saves. The
          original stays in your history.
        </p>
      </div>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onClick}>
      ← Ledger
    </button>
  )
}
