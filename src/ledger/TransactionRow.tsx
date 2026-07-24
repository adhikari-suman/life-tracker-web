import type { Account, Label, Transaction } from '../api/generated/types.gen'
import { MoneyText } from '../money/MoneyText'
import { describeTransaction, type TransactionDescription } from './describeTransaction'
import { UndoCountdown } from './UndoCountdown'
import styles from './TransactionRow.module.css'

// One line of the ledger, reconstructed in the intent's language — "Spent 12.00 on Coffee",
// never a debit and a credit. Read-only: a committed transaction has no edit affordance, because
// the API has none; correction is relabel or reverse, on the detail view.
//
// The same row renders three states with one layout, so a pending entry does not jump when it
// commits: a committed row, a pending row (dimmed, with a countdown and Cancel), and a failed row.

type TransactionRowProps = {
  transaction: Transaction
  accountsById: ReadonlyMap<string, Account>
  labelsById: ReadonlyMap<string, Label>
  /** Present on a pending entry: when the commit fires, and how to recall it. */
  pending?: { deadline: number | undefined; onCancel: () => void }
  /** Present on a failed entry. */
  failed?: { message: string; onDismiss: () => void }
  /** Committing: the POST is in flight and can no longer be recalled. */
  committing?: boolean
  /** Opens the detail view. Absent on pending/failed rows, which have no server id yet. */
  onOpen?: () => void
}

function labelName(description: TransactionDescription, labelsById: ReadonlyMap<string, Label>): string {
  const id = description.labelPosting?.labelId
  if (id === null || id === undefined) {
    // Only Spent/Earned have a labelable leg; for those, no label is "Uncategorized" (the absence
    // of a label, a valid state). Moved/Paid off have no leg at all, so there is nothing to say.
    return description.labelPosting !== undefined ? 'Uncategorized' : ''
  }
  return labelsById.get(id)?.path ?? 'Uncategorized'
}

export function TransactionRow({
  transaction,
  accountsById,
  labelsById,
  pending,
  failed,
  committing = false,
  onOpen,
}: TransactionRowProps) {
  const d = describeTransaction(transaction, accountsById)
  const label = labelName(d, labelsById)

  // The subtitle names the accounts involved, in intent order (source → destination), so the
  // movement is legible without opening the row.
  const fromName = d.fromAccount?.name ?? 'Unknown account'
  const toName = d.toAccount?.name ?? 'Unknown account'
  const subtitle = d.kind === 'SPENT' ? label || toName : d.kind === 'EARNED' ? `${fromName}${label ? ` · ${label}` : ''}` : `${fromName} → ${toName}`

  const state = failed ? styles.rowFailed : pending || committing ? styles.rowPending : ''
  const className = `${styles.row} ${state}`.trim()

  // A pending/failed row is not a link — it has no server id to open. A committed one is.
  const body = (
    <>
      <div className={styles.main}>
        <span className={styles.verb}>{d.verb}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      <div className={styles.trailing}>
        <MoneyText money={d.headlineAmount} className={styles.amount} />
        {d.crossCurrency && (
          // The other real figure, quiet — a cross-currency movement has two, and hiding one
          // would misrepresent what happened.
          <MoneyText
            money={d.kind === 'SPENT' || d.kind === 'OPENING' ? d.fromPosting.amount : d.toPosting.amount}
            className={styles.secondary}
          />
        )}
      </div>
    </>
  )

  return (
    <div className={className} aria-busy={committing}>
      {onOpen && !pending && !failed ? (
        <button type="button" className={styles.hit} onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className={styles.hit}>{body}</div>
      )}

      {pending && (
        <UndoCountdown deadline={pending.deadline} onCancel={pending.onCancel} committing={committing} />
      )}

      {failed && (
        <div className={styles.failure}>
          <span className={styles.failureText}>{failed.message}</span>
          <button type="button" className={styles.dismiss} onClick={failed.onDismiss}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
