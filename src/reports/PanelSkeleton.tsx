import styles from './PanelSkeleton.module.css'

// A held shape while a panel's own request is in flight. Sized to what it replaces, so nothing
// reflows when the figures arrive — the previous design review raised the absence of exactly this
// on the ledger list.
//
// Static, never a shimmer. An animated skeleton is decorative motion, which this philosophy
// excludes, and a pulsing block on a page about money reads as activity that is not happening.
//
// aria-hidden, and deliberately NOT role="status". Three requests resolve independently on this
// page, so three live regions would announce "Loading" over each other on arrival and again on
// every range change — noise, not information. The loading state is carried by aria-busy on the
// panel that owns it, which assistive technology reports when asked rather than shouting.

export function PanelSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.total} />
      <div className={styles.rows}>
        <div className={styles.row} />
        <div className={styles.row} />
        <div className={styles.row} />
      </div>
    </div>
  )
}
