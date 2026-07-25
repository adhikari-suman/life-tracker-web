import { describe, expect, it } from 'vitest'
import type { Label } from '../api/generated/types.gen'
import {
  buildLabelTree,
  canHaveChild,
  descendantIds,
  flatten,
  subtreeHeight,
  validParentsFor,
} from './labelTree'

function label(id: string, name: string, parentId: string | null, archived = false): Label {
  return { id, name, path: name, parentId, archived }
}

//   food
//     restaurants
//       fast food
//     groceries
//   housing
//   commuting (archived)
const LABELS: Label[] = [
  label('food', 'food', null),
  label('restaurants', 'restaurants', 'food'),
  label('fastfood', 'fast food', 'restaurants'),
  label('groceries', 'groceries', 'food'),
  label('housing', 'housing', null),
  label('commuting', 'commuting', null, true),
]

const ROOTS = buildLabelTree(LABELS)
const byId = (id: string) => flatten(ROOTS).find((n) => n.id === id)!

describe('buildLabelTree', () => {
  it('nests by parentId and assigns depth', () => {
    expect(byId('food').depth).toBe(0)
    expect(byId('restaurants').depth).toBe(1)
    expect(byId('fastfood').depth).toBe(2)
  })

  it('sorts alphabetically, with archived labels last', () => {
    // A retired label is still worth seeing — unarchiving is the only way back — but it should not
    // sit between two live ones.
    expect(ROOTS.map((r) => r.name)).toEqual(['food', 'housing', 'commuting'])
    expect(byId('food').children.map((c) => c.name)).toEqual(['groceries', 'restaurants'])
  })

  it('shows an orphan at the root rather than hiding it', () => {
    // The page exists to let you see and fix the tree, so a node whose parent is missing must not
    // vanish — that would hide the very problem you came to fix.
    const orphaned = buildLabelTree([label('x', 'stray', 'gone')])
    expect(orphaned).toHaveLength(1)
    expect(orphaned[0].name).toBe('stray')
  })
})

describe('subtreeHeight', () => {
  it('is 0 for a leaf and counts levels below otherwise', () => {
    expect(subtreeHeight(byId('fastfood'))).toBe(0)
    expect(subtreeHeight(byId('restaurants'))).toBe(1)
    expect(subtreeHeight(byId('food'))).toBe(2)
  })
})

describe('canHaveChild', () => {
  it('refuses a child once a label sits at the deepest level', () => {
    expect(canHaveChild(byId('food'))).toBe(true)
    expect(canHaveChild(byId('restaurants'))).toBe(true)
    expect(canHaveChild(byId('fastfood'))).toBe(false)
  })
})

describe('validParentsFor', () => {
  it('excludes the label itself and all its descendants — LABEL_CYCLE', () => {
    const targets = validParentsFor(byId('food'), ROOTS).map((n) => n.id)
    expect(targets).not.toContain('food')
    expect(targets).not.toContain('restaurants')
    expect(targets).not.toContain('fastfood')
    expect(targets).not.toContain('groceries')
  })

  it('checks depth against the WHOLE SUBTREE, not just the label — LABEL_DEPTH_EXCEEDED', () => {
    // `food` is two deep beneath itself, so it can only ever be a root. Nothing can take it.
    expect(validParentsFor(byId('food'), ROOTS)).toEqual([])

    // `restaurants` is one deep, so it may sit under a root but not under a level-1 label.
    const forRestaurants = validParentsFor(byId('restaurants'), ROOTS).map((n) => n.id)
    expect(forRestaurants).toContain('housing')
    expect(forRestaurants).not.toContain('groceries')
  })

  it('lets a leaf go anywhere that is not itself and not already deepest', () => {
    const forGroceries = validParentsFor(byId('groceries'), ROOTS).map((n) => n.id)
    expect(forGroceries).toContain('housing')
    expect(forGroceries).toContain('restaurants')
    expect(forGroceries).not.toContain('fastfood') // already at MAX_DEPTH
    expect(forGroceries).not.toContain('groceries')
  })

  it('never offers an archived label as a parent', () => {
    // Parenting a live label under a retired one would make the live one unreachable in the entry
    // picker, for no reason the user asked for.
    expect(validParentsFor(byId('housing'), ROOTS).map((n) => n.id)).not.toContain('commuting')
  })
})

describe('descendantIds', () => {
  it('includes the node itself', () => {
    expect([...descendantIds(byId('restaurants'))].sort()).toEqual(['fastfood', 'restaurants'])
  })
})
