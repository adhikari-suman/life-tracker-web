import { useState, type FormEvent } from 'react'
import type { AppProblem } from '../api/problem'
import { ProblemBanner } from '../components/ProblemBanner'
import { LabelRow } from '../labels/LabelRow'
import { useLabelTree } from '../labels/useLabelTree'
import styles from './LabelsPage.module.css'

// What money was for. The tree the reports breakdown rolls up, and until this page existed it
// could only be flat — the entry picker creates root labels and nothing else, so nesting was
// unreachable without curl.
//
// Not in the main navigation, by decision: the nav names what the app DOES — record, review, and
// the accounts both rest on — and labels are configuration, like the theme. That rule was written
// down when Reports became the third item and it survives this feature rather than bending to it.

const LABEL_MESSAGES = {
  // The three the server enforces on a move or rename, each phrased as what to do instead.
  LABEL_NAME_TAKEN: () => 'A label with that name already sits alongside it. Pick another name.',
  LABEL_DEPTH_EXCEEDED: () => 'Labels go three levels deep at most, and that move would go deeper.',
  LABEL_CYCLE: () => 'A label cannot move inside itself.',

  // Delete is refused while anything depends on the label. Archiving is the answer, and saying so
  // matters more than naming the rule.
  LABEL_IN_USE: () =>
    'That label is still on some transactions, so it cannot be deleted. Archive it instead — history keeps reporting under it.',
  LABEL_HAS_CHILDREN: () => 'That label still has labels under it. Move or remove those first.',
  LABEL_NOT_FOUND: () => 'That label no longer exists. Reloading the page will catch it up.',
}

export function LabelsPage() {
  const { roots, loading, problem: loadProblem, create, rename, move, setArchived, remove } =
    useLabelTree()

  const [actionProblem, setActionProblem] = useState<AppProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')

  // Every mutation goes through here so the busy flag and the error banner are handled once
  // rather than six times.
  async function run(action: () => Promise<AppProblem | null>) {
    if (busy) return
    setBusy(true)
    setActionProblem(await action())
    setBusy(false)
  }

  function addRoot(event: FormEvent) {
    event.preventDefault()
    if (newName.trim() === '') return
    void run(async () => {
      const problem = await create(newName, null)
      if (problem === null) setNewName('')
      return problem
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Labels</h1>
        <p className={styles.intro}>
          What money was for. Labels nest up to three levels, and a summary counts a label toward
          everything above it — so tagging something <em>fast food</em> also counts it under{' '}
          <em>food</em>.
        </p>
      </header>

      <ProblemBanner problem={actionProblem} messages={LABEL_MESSAGES} />
      <ProblemBanner problem={loadProblem} messages={LABEL_MESSAGES} />

      <form className={styles.newLabel} onSubmit={addRoot}>
        <label className={styles.newLabelText} htmlFor="new-root-label">
          New top-level label
        </label>
        <div className={styles.newLabelControls}>
          <input
            id="new-root-label"
            className={styles.input}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="food"
            maxLength={100}
          />
          {/* The page's one primary action, so it gets the one accent. */}
          <button className={styles.submit} type="submit" aria-disabled={busy}>
            Add label
          </button>
        </div>
        <p className={styles.hint}>
          To nest one, add it here first or use <strong>Add child</strong> on the label it belongs
          under.
        </p>
      </form>

      {loading ? (
        <p className={styles.state}>Loading…</p>
      ) : roots.length === 0 ? (
        <p className={styles.state}>
          No labels yet. Anything you record without one is counted as Uncategorized, which is a
          valid answer — labels are for when you want to know more than the total.
        </p>
      ) : (
        <ul className={styles.tree} aria-busy={busy}>
          {roots.map((root) => (
            <LabelRow
              key={root.id}
              node={root}
              roots={roots}
              busy={busy}
              onRename={(id, name) => void run(() => rename(id, name))}
              onMove={(id, parentId) => void run(() => move(id, parentId))}
              onArchive={(id, archived) => void run(() => setArchived(id, archived))}
              onDelete={(id) => void run(() => remove(id))}
              onAddChild={(parentId, name) => void run(() => create(name, parentId))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
