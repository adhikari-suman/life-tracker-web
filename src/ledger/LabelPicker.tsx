import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Label } from '../api/generated/types.gen'
import styles from './LabelPicker.module.css'

// Optional categorization for the one Income or Expense leg a Spent or Earned entry has. Rendered
// only when the intent permits it — the entry form does not mount this for Moved or Paid off at
// all, which is the difference between an interface that teaches the model and one that lets you
// fail and then explains (LABEL_NOT_APPLICABLE).
//
// A disclosure button showing the current choice, opening a filter box over the cached label
// list. Full paths are shown so `fast food` under `food` is not confused with a `fast food` some-
// where else. When the filter matches nothing, an inline "Create" turns the typed text into a new
// root label — without which, since label management is out of scope, no label could ever exist.

type LabelPickerProps = {
  labels: readonly Label[]
  /** Selected label id, or null for Uncategorized. */
  value: string | null
  onChange: (labelId: string | null) => void
  /** Create a label from the typed text and return it (or null on failure). */
  onCreate: (name: string) => Promise<Label | null>
}

export function LabelPicker({ labels, value, onChange, onCreate }: LabelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = value === null ? null : (labels.find((l) => l.id === value) ?? null)

  // Archived labels are never offered for new tagging (they stay on what already carries them).
  const active = useMemo(() => labels.filter((l) => !l.archived), [labels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return active
    // Match on the full path, so typing a parent name surfaces its children too.
    return active.filter((l) => l.path.toLowerCase().includes(q))
  }, [active, query])

  // An exact path match means the label already exists; only offer Create otherwise.
  const trimmed = query.trim()
  const exactExists = active.some((l) => l.path.toLowerCase() === trimmed.toLowerCase())
  const canCreate = trimmed !== '' && !exactExists

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node) === false) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  function choose(labelId: string | null) {
    onChange(labelId)
    setOpen(false)
    setQuery('')
  }

  async function handleCreate() {
    if (creating || !canCreate) return
    setCreating(true)
    const created = await onCreate(trimmed)
    setCreating(false)
    if (created !== null) choose(created.id)
  }

  return (
    <div className={styles.field} ref={rootRef}>
      <span className={styles.label} id={`${listId}-label`}>
        Label <span className={styles.optional}>— optional</span>
      </span>

      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Both the field name AND the current value, so a screen reader announces "Label —
        // optional, Uncategorized" rather than leaving the selection unspoken.
        aria-labelledby={`${listId}-label ${listId}-value`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${listId}-value`} className={selected === null ? styles.placeholder : styles.value}>
          {selected === null ? 'Uncategorized' : selected.path}
        </span>
        <span className={styles.caret} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel}>
          <input
            ref={inputRef}
            className={styles.filter}
            type="text"
            value={query}
            placeholder="Filter or name a new label"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter with a create-able query is the fast path: type a name, press Enter, done.
              if (event.key === 'Enter' && canCreate && filtered.length === 0) {
                event.preventDefault()
                void handleCreate()
              }
            }}
            autoComplete="off"
            spellCheck={false}
            aria-label="Filter labels or name a new one"
          />

          <ul className={styles.list} role="listbox" aria-label="Labels">
            {/* Uncategorized is always available and always first — clearing a label is as
                ordinary an action as setting one, and "Uncategorized" is the absence of a label,
                not a label someone named. */}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                className={styles.option}
                onClick={() => choose(null)}
              >
                Uncategorized
              </button>
            </li>

            {filtered.map((label) => (
              <li key={label.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={label.id === value}
                  className={styles.option}
                  onClick={() => choose(label.id)}
                >
                  {label.path}
                </button>
              </li>
            ))}

            {canCreate && (
              <li>
                <button
                  type="button"
                  className={styles.create}
                  onClick={() => void handleCreate()}
                  aria-disabled={creating}
                >
                  {creating ? 'Creating…' : `Create “${trimmed}”`}
                </button>
              </li>
            )}

            {filtered.length === 0 && !canCreate && (
              <li className={styles.emptyNote}>No labels yet. Type a name to create one.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
