import type { Account } from '../api/generated/types.gen'
import { MoneyText } from '../money/MoneyText'
import { describeTransaction } from './describeTransaction'
import { UndoCountdown } from './UndoCountdown'
import type { CommitEntry } from './useCommitQueue'
import styles from './MobileUndoToast.module.css'

// On mobile the recent list sits below the form, so a pending entry's countdown and Cancel would
// land below the fold right after recording — and focus has returned to the amount field at the
// top. The brief is explicit that on mobile the undo "pins above the safe area", so this surfaces
// the still-recallable entry as a toast fixed to the bottom. It is hidden at the 1024px split,
// where the list is beside the form and the inline countdown is already in view.
//
// Only pending and committing entries appear — a committed or failed one is no longer recallable
// and belongs to the list, not a toast. The newest is shown; a catch-up burst of several is rare
// and the extra count keeps the toast from becoming a stack.

type MobileUndoToastProps = {
  entries: CommitEntry[]
  accountsById: ReadonlyMap<string, Account>
  onCancel: (id: string) => void
}

export function MobileUndoToast({ entries, accountsById, onCancel }: MobileUndoToastProps) {
  const recallable = entries.filter((e) => e.status === 'pending' || e.status === 'committing')
  if (recallable.length === 0) return null

  const entry = recallable[0]
  const d = describeTransaction(entry.optimistic, accountsById)
  const others = recallable.length - 1

  return (
    <div className={styles.toast}>
      <div className={styles.summary}>
        <span className={styles.verb}>{d.verb}</span>
        <MoneyText money={d.headlineAmount} className={styles.amount} />
        {others > 0 && <span className={styles.more}>+{others} more</span>}
      </div>
      <UndoCountdown
        deadline={entry.deadline}
        onCancel={() => onCancel(entry.id)}
        committing={entry.status === 'committing'}
        tone="inverse"
      />
    </div>
  )
}
