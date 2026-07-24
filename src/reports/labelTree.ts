import type { ActivityReport, LabelAmount } from '../api/generated/types.gen'

// The spending and income reports return `byLabel` FLAT — one row per label per currency, with
// the tree implied by `parentLabelId`. This module is the only place that shape is turned into
// something renderable, and the only place the arithmetic trap in it is handled.
//
// The trap, stated in the spec and worth restating here because it is silent: each row carries
// `own` (postings tagged with this label directly) and `rolledUp` (own plus every descendant's).
// Summing `rolledUp` across rows DOUBLE-COUNTS, because a child's amount appears in its own row
// and again in every ancestor's. Nothing errors. The number simply comes out too big.
//
// The way out is that every label sits in exactly one root's subtree, so summing `rolledUp`
// across ROOTS ONLY counts each posting exactly once:
//
//     Σ rolledUp(roots) + Uncategorized.own  ===  totals
//
// That identity is what makes a collapsed-roots view both the richest and the safe default, and
// it is asserted in labelTree.test.ts rather than trusted.

export type LabelNode = LabelAmount & {
  /** Depth from the root, starting at 0. Capped at 2 by ADR-0015's three-level limit. */
  depth: number
  children: LabelNode[]
}

export type LabelBreakdown = {
  /** Top-level labels, each carrying its subtree. Sorted by `rolledUp`, largest first. */
  roots: LabelNode[]
  /**
   * The single null-`labelId` row, held OUTSIDE the tree. It is not a label — it is the name for
   * what is left once every labelled posting has been counted (CONTEXT.md), so it cannot be a
   * parent, a child, or a sibling in a tree of labels. It renders as a final row.
   */
  uncategorized: LabelAmount | null
}

/**
 * Build the renderable tree for one currency.
 *
 * Filtering by currency happens first and is not optional: `byLabel` holds one row per label PER
 * CURRENCY, so a two-currency Book would otherwise produce `food` twice in the same tree and the
 * reconciliation above would be meaningless — you cannot add GBP to USD, and ADR-0002 declines to
 * try.
 */
export function buildLabelBreakdown(report: ActivityReport, currency: string): LabelBreakdown {
  const rows = report.byLabel.filter((row) => row.currency === currency)

  const uncategorized = rows.find((row) => row.labelId === null) ?? null
  const labelled = rows.filter((row): row is LabelAmount & { labelId: string } => row.labelId !== null)

  const nodes = new Map<string, LabelNode>(
    labelled.map((row) => [row.labelId, { ...row, depth: 0, children: [] }]),
  )

  const roots: LabelNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentLabelId === null ? undefined : nodes.get(node.parentLabelId)
    // A row whose parent is absent from the response is treated as a root rather than dropped.
    // This is reachable: a parent with no activity of its own AND none beneath it in this
    // currency does not appear, while its child in another branch might. Dropping the row would
    // silently remove money from the breakdown and break the reconciliation; promoting it keeps
    // every figure on screen, which is the property that actually matters.
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
  }

  for (const root of roots) assignDepth(root, 0)
  sortTree(roots)

  return { roots, uncategorized }
}

function assignDepth(node: LabelNode, depth: number): void {
  node.depth = depth
  for (const child of node.children) assignDepth(child, depth + 1)
}

/**
 * Largest first, at every level, so the eye lands on where the money went. Ties break on `path`
 * so the order is stable across renders — an unstable sort would make rows jump when a range
 * changes, on a surface whose whole job is being believed.
 */
function sortTree(nodes: LabelNode[]): void {
  nodes.sort((a, b) => {
    const byAmount = compareAmounts(b.rolledUp.amount, a.rolledUp.amount)
    return byAmount !== 0 ? byAmount : a.path.localeCompare(b.path)
  })
  for (const node of nodes) sortTree(node.children)
}

/**
 * Order two amount strings without making either a number. Scaling to the spec's four fractional
 * digits and comparing as BigInt is exact, where `parseFloat` would be both banned and lossy.
 */
function compareAmounts(a: string, b: string): number {
  const scaled = (value: string): bigint => {
    const negative = value.startsWith('-')
    const body = negative ? value.slice(1) : value
    const [intPart, fracPart = ''] = body.split('.')
    const digits = BigInt(intPart + (fracPart + '0000').slice(0, 4))
    return negative ? -digits : digits
  }
  const left = scaled(a)
  const right = scaled(b)
  return left === right ? 0 : left < right ? -1 : 1
}

/** The per-currency total the panel heading shows, or null if this currency is absent. */
export function totalFor(report: ActivityReport, currency: string): string | null {
  return report.totals.find((total) => total.currency === currency)?.amount.amount ?? null
}

/** Every currency present in a report, in the order the server listed its totals. */
export function currenciesIn(report: ActivityReport): string[] {
  return report.totals.map((total) => total.currency)
}
