import { useState, type FormEvent } from 'react'
import { canHaveChild, validParentsFor, type LabelNode } from './labelTree'
import styles from './LabelRow.module.css'

// One label, and everything that can be done to it.
//
// Actions are laid out inline rather than behind a menu. There are at most five, the page exists
// for nothing else, and a kebab menu on every row would hide the whole purpose of the screen
// behind a click — Rams: the controls ARE the content here.
//
// Delete and Archive are deliberately not the same button. The spec refuses a delete once anything
// depends on the label (LABEL_IN_USE / LABEL_HAS_CHILDREN) because "deleting is for tidying, never
// for destroying history" — archive is the retirement path, and history still reports under it.

type Mode = 'idle' | 'renaming' | 'moving' | 'adding'

type LabelRowProps = {
  node: LabelNode
  roots: LabelNode[]
  busy: boolean
  onRename: (id: string, name: string) => void
  onMove: (id: string, parentId: string | null) => void
  onArchive: (id: string, archived: boolean) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, name: string) => void
}

export function LabelRow({
  node,
  roots,
  busy,
  onRename,
  onMove,
  onArchive,
  onDelete,
  onAddChild,
}: LabelRowProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState('')

  const parents = validParentsFor(node, roots)

  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (draft.trim() === '') return
    onRename(node.id, draft)
    setMode('idle')
  }

  function submitChild(event: FormEvent) {
    event.preventDefault()
    if (draft.trim() === '') return
    onAddChild(node.id, draft)
    setMode('idle')
  }

  return (
    <li className={styles.item}>
      <div
        className={node.archived ? `${styles.row} ${styles.archivedRow}` : styles.row}
        style={{ paddingInlineStart: `calc(var(--tree-indent) * ${node.depth})` }}
      >
        {mode === 'renaming' ? (
          <form className={styles.inlineForm} onSubmit={submitRename}>
            <input
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`New name for ${node.name}`}
              autoFocus
              maxLength={100}
            />
            <button type="submit" className={styles.confirm}>
              Save
            </button>
            <button type="button" className={styles.action} onClick={() => setMode('idle')}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className={styles.name}>
              {node.name}
              {node.archived && <span className={styles.badge}>archived</span>}
            </span>

            <div className={styles.actions}>
              {/* An archived label offers only the way back. Renaming or reparenting something
                  retired is motion without purpose, and delete is almost certainly refused. */}
              {node.archived ? (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => onArchive(node.id, false)}
                  aria-disabled={busy}
                >
                  Restore
                </button>
              ) : (
                <>
                  {/* No "Add child" at the deepest level — ADR-0015 stops the tree at three, so the
                      control would exist only to be refused. */}
                  {canHaveChild(node) && (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => {
                        setDraft('')
                        setMode('adding')
                      }}
                      aria-disabled={busy}
                    >
                      Add child
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => {
                      setDraft(node.name)
                      setMode('renaming')
                    }}
                    aria-disabled={busy}
                  >
                    Rename
                  </button>
                  {/* Offered only when there is somewhere legal to go. A label whose subtree is
                      already two deep can only ever be a root, so a move control would be a dead
                      end — and if it is already at the root, "move to root" is a no-op. */}
                  {(parents.length > 0 || node.parentId !== null) && (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => setMode(mode === 'moving' ? 'idle' : 'moving')}
                      aria-expanded={mode === 'moving'}
                      aria-disabled={busy}
                    >
                      Move
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => onArchive(node.id, true)}
                    aria-disabled={busy}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => onDelete(node.id)}
                    aria-disabled={busy}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {mode === 'moving' && (
        <div
          className={styles.panel}
          style={{ paddingInlineStart: `calc(var(--tree-indent) * ${node.depth + 1})` }}
        >
          <label className={styles.panelLabel} htmlFor={`move-${node.id}`}>
            Move <strong>{node.name}</strong> under
          </label>
          <select
            id={`move-${node.id}`}
            className={styles.select}
            defaultValue={node.parentId ?? ''}
            onChange={(event) => {
              onMove(node.id, event.target.value === '' ? null : event.target.value)
              setMode('idle')
            }}
          >
            <option value="">(top level)</option>
            {parents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.path}
              </option>
            ))}
          </select>
          {/* Said here rather than in a warning dialog, because it is a property of the model
              rather than a risk: ADR-0015 derives roll-up from the tree as it stands now. */}
          <p className={styles.hint}>
            Moving a label re-files it in every past summary too, not just future ones.
          </p>
        </div>
      )}

      {mode === 'adding' && (
        <form
          className={styles.panel}
          style={{ paddingInlineStart: `calc(var(--tree-indent) * ${node.depth + 1})` }}
          onSubmit={submitChild}
        >
          <label className={styles.panelLabel} htmlFor={`child-${node.id}`}>
            New label under <strong>{node.name}</strong>
          </label>
          <div className={styles.inlineForm}>
            <input
              id={`child-${node.id}`}
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              maxLength={100}
            />
            <button type="submit" className={styles.confirm}>
              Add
            </button>
            <button type="button" className={styles.action} onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {node.children.length > 0 && (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <LabelRow
              key={child.id}
              node={child}
              roots={roots}
              busy={busy}
              onRename={onRename}
              onMove={onMove}
              onArchive={onArchive}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
