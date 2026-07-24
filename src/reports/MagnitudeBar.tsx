import { barWidth } from '../money/amount'
import styles from './MagnitudeBar.module.css'

// Magnitude as LENGTH, in one neutral tone — token decision 4. Never the accent (decision 3):
// a bar is neither an action nor a focus target, and the accent's power comes from being the only
// thing wearing it. Never a colour per label either: that would need eight-plus hues, fail in
// greyscale, and fail the same readers decision 1 protects.
//
// aria-hidden, because it carries nothing the figure beside it does not already say. A screen
// reader announcing "bar, 32 percent" after the amount would be repeating the amount, worse.

type MagnitudeBarProps = {
  /** This row's figure. */
  amount: string
  /** The panel total this row is a share of. */
  total: string
}

export function MagnitudeBar({ amount, total }: MagnitudeBarProps) {
  // A percentage STRING, computed in BigInt. No float is produced anywhere on this path, so the
  // codebase needs no lint-disable for it — see barWidth.
  const width = barWidth(amount, total)

  return (
    <div className={styles.track} aria-hidden="true">
      <div className={styles.fill} style={{ width }} />
    </div>
  )
}
