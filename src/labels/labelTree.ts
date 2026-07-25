import type { Label } from '../api/generated/types.gen'

// The label tree, built from the flat list the API returns.
//
// Deliberately separate from src/reports/labelTree.ts. That one shapes LabelAmount rows — keyed
// `labelId`/`parentLabelId`, carrying two money figures per currency, and filtered to one currency
// before anything else happens. This one shapes Label rows — keyed `id`/`parentId`, carrying an
// archived flag and no money at all. A shared generic would need accessors for both key names and
// would earn less than the twenty lines it saved.

/** ADR-0015: the tree stops at three levels, so depths are 0, 1 and 2. */
export const MAX_DEPTH = 2

export type LabelNode = Label & {
  depth: number
  children: LabelNode[]
}

/** Build the tree, each level sorted by name. Archived labels are included if they were fetched. */
export function buildLabelTree(labels: Label[]): LabelNode[] {
  const nodes = new Map<string, LabelNode>(
    labels.map((label) => [label.id, { ...label, depth: 0, children: [] }]),
  )

  const roots: LabelNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId)
    // A label whose parent is missing from the list is shown at the root rather than dropped —
    // the page's job is to let you see and fix the tree, so hiding a node would hide the problem.
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
  }

  for (const root of roots) assignDepth(root, 0)
  sortByName(roots)
  return roots
}

function assignDepth(node: LabelNode, depth: number): void {
  node.depth = depth
  for (const child of node.children) assignDepth(child, depth + 1)
}

function sortByName(nodes: LabelNode[]): void {
  // Archived last, then alphabetical. A retired label is still worth seeing — it is the only way
  // to bring one back — but it should not sit between two live ones.
  nodes.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) sortByName(node.children)
}

/** Every node in the tree, depth-first, in display order. */
export function flatten(nodes: LabelNode[]): LabelNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

/** How many levels sit BELOW this node. A leaf is 0. */
export function subtreeHeight(node: LabelNode): number {
  if (node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(subtreeHeight))
}

/** This node and every descendant of it. */
export function descendantIds(node: LabelNode): Set<string> {
  const ids = new Set<string>()
  const walk = (current: LabelNode) => {
    ids.add(current.id)
    current.children.forEach(walk)
  }
  walk(node)
  return ids
}

/**
 * The labels this one may legally be moved under, computed client-side so the picker cannot offer
 * a move the server will refuse. Both rules are stated in the spec rather than inferred:
 *
 * - **Cycle** — a label cannot move under itself or any of its descendants (`LABEL_CYCLE`).
 * - **Depth** — checked against the WHOLE SUBTREE being moved, not just this label
 *   (`LABEL_DEPTH_EXCEEDED`): "a two-deep subtree cannot move under a label that already sits at
 *   level two."
 *
 * Archived labels are excluded as targets: parenting a live label under a retired one would make
 * the live one unreachable in the picker for no stated reason.
 */
export function validParentsFor(node: LabelNode, roots: LabelNode[]): LabelNode[] {
  const forbidden = descendantIds(node)
  const height = subtreeHeight(node)

  return flatten(roots).filter((candidate) => {
    if (forbidden.has(candidate.id)) return false
    if (candidate.archived) return false
    // The moved node would land at candidate.depth + 1, and its own deepest descendant a further
    // `height` below that.
    return candidate.depth + 1 + height <= MAX_DEPTH
  })
}

/** Whether a child may be added under this label at all — false once it sits at the deepest level. */
export function canHaveChild(node: LabelNode): boolean {
  return node.depth < MAX_DEPTH
}
