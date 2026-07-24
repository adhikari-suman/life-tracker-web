import { useState } from 'react'
import { MoneyText } from '../money/MoneyText'
import { MagnitudeBar } from './MagnitudeBar'
import type { LabelNode } from './labelTree'
import styles from './LabelTreeRow.module.css'

// One line of the breakdown.
//
// A collapsed root shows `rolledUp` — its own figure plus everything beneath it. Expanding
// reveals children showing `own`. That mix is correct and it is also the trap the spec warns
// about: adding up what is then on screen double-counts, because a child appears in its own row
// AND inside its parent's figure. The indent is what says "contained within" rather than
// "alongside", so it is load-bearing rather than decorative, and it is mirrored in the DOM as a
// real nested list for anyone who cannot see it.
//
// Rows are INERT. Tapping a label is the obvious gesture and the API cannot serve it —
// GET /transactions filters by accountId only, with no labelId and no date range. So there is no
// link, no hover state and no pointer cursor: a dead end is better seen than discovered. Recorded
// as a backend gap in the brief.

type LabelTreeRowProps = {
  node: LabelNode
  /** The panel total, for the bar's proportion. Always the same figure down the whole tree. */
  total: string
  /** False when the panel has a single row, where a 100%-wide bar would encode nothing. */
  showBars: boolean
}

export function LabelTreeRow({ node, total, showBars }: LabelTreeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children.length > 0

  // A parent ALWAYS speaks for its subtree; only a leaf speaks for itself.
  //
  // This once showed `own` when expanded, on the theory that everything then on screen would sum
  // flat. The review killed it: `food` dropped from 420.00 to 0.00 the moment you opened it, with
  // its bar shrinking to the minimum-width sliver — so the second-largest category rendered as
  // numerically zero and visually negligible, directly above two children worth 420 between them.
  // Clicking for more detail must not make a number smaller.
  //
  // The indent is what stops a parent reading as a peer of its children, which is why it does not
  // have to surrender its figure to say "contained within". And the collapsed-roots view — the one
  // that reconciles to the panel total — is unaffected either way.
  const figure = hasChildren ? node.rolledUp : node.own

  return (
    <li className={styles.item}>
      <div
        className={showBars ? styles.row : `${styles.row} ${styles.rowNoBars}`}
        style={{ paddingInlineStart: `calc(var(--tree-indent) * ${node.depth})` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {/* The triangle is decorative; the button's accessible name is the label itself, so a
                screen reader announces "food, collapsed button" rather than "triangle". */}
            <span className={styles.triangle} aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <span className={styles.name}>{node.name}</span>
          </button>
        ) : (
          // A leaf gets NO disclosure control at all — not a disabled one. An affordance that
          // does nothing is worse than no affordance. The spacer keeps the names in a column.
          <span className={styles.leaf}>
            <span className={styles.triangleSpacer} aria-hidden="true" />
            <span className={styles.name}>{node.name}</span>
          </span>
        )}

        {showBars ? (
          <div className={styles.bar}>
            <MagnitudeBar amount={figure.amount} total={total} />
          </div>
        ) : null}

        <MoneyText money={figure} showCurrency={false} className={styles.figure} />
      </div>

      {hasChildren && expanded ? (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <LabelTreeRow key={child.labelId} node={child} total={total} showBars={showBars} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
