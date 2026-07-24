# Design Review: Reports (life-tracker-web)

Reviewed against: `DESIGN_BRIEF.md`
Philosophy: **Dieter Rams (Functionalist)**
Date: 2026-07-24

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-reports-desktop-1280.png` | Desktop (1280×800) | Full page, light — strip, controls, both panels, Kept |
| `screenshots/review-reports-tablet-768.png` | Tablet (768×1024) | Single column, capped measure |
| `screenshots/review-reports-mobile-375.png` | Mobile (375×812) | Stacked, bars dropped, currencies wrapped |
| `screenshots/review-reports-tree-expanded-desktop-1280.png` | Desktop (1280×800) | `food` expanded to `groceries` / `fast food` |
| `screenshots/review-reports-dark-mode-desktop-1280.png` | Desktop (1280×800) | Dark |
| `screenshots/review-reports-dark-mode-mobile-375.png` | Mobile (375×812) | Dark |
| `screenshots/review-reports-empty-range-desktop-1280.png` | Desktop (1280×800) | June 2026 — nothing recorded |
| `screenshots/review-retrofit-accounts-desktop-1280.png` | Desktop (1280×800) | `/accounts` under the new money rendering |
| `screenshots/review-retrofit-ledger-desktop-1280.png` | Desktop (1280×800) | `/` under the new money rendering |
| `screenshots/review-retrofit-transaction-detail-desktop-1280.png` | Desktop (1280×800) | `/transactions/:id` under the new money rendering |

> Captured against the live backend (Docker app container + Postgres), on a seeded Book holding a
> nested label tree, an unlabelled posting, two currencies, an internal transfer and two opening
> balances. Not mocks.

## Summary

The surface does the thing the product exists for, and it is now possible to prove it on screen:
£200 was moved between two accounts the user owns and £20,000 walked in as opening balances, and
**neither appears in Spent or Earned** — the figures read 1,618.50 and 2,800.00, which is exactly
the real spending and the real income. The Rams inheritance is intact: warm neutrals, borders over
shadows, mono tabular figures, and not one accent-coloured element on a page that has no primary
action to spend it on.

The one real fault is in the expanded tree. A parent label's figure **drops to 0.00 when you
expand it**, which contradicts the brief and reads as "no food spending" on a category that holds
£420. Everything else is polish.

## Must Fix

1. **An expanded parent shows `own` instead of `rolledUp`, and reads as zero.**
   ✅ **Fixed during this review.** `LabelTreeRow.tsx` now reads `hasChildren ? rolledUp : own` —
   a parent always speaks for its subtree, in both states. `food` holds at 420.00 when opened
   (see the recaptured `review-reports-tree-expanded-desktop-1280.png`), and a test asserts the
   figure survives the click. Original finding below.

   See `screenshots/review-reports-tree-expanded-desktop-1280.png`. Collapsed, `food` reads
   **420.00**. Expanded, the same row reads **0.00** with its magnitude bar shrunk to the 2px
   `--bar-min-width` sliver — so the second-largest category in the Book renders as both
   numerically zero and visually negligible, directly above two children worth 320.00 and 100.00.

   This is a deviation, not a judgement call. `DESIGN_BRIEF.md` (Key Interactions) states: *"The
   disclosure triangle reveals children indented one level, showing their `own` figures. **The
   parent continues to show `rolledUp`**"* — and the reason it says so is that the indent is what
   carries "contained within", so the parent never needs to surrender its figure to avoid being
   read as a peer.

   `LabelTreeRow.tsx:33` is the line: `hasChildren && !expanded ? node.rolledUp : node.own`.

   _Fix: a parent with children always shows `rolledUp`, expanded or not. Only leaves show `own`._
   The collapsed-roots view is what reconciles to the panel total, and that is unaffected — the
   double-count risk the `own` choice was defending against never applied to the default view.

## Should Fix

> Both ✅ **fixed during this review**, along with a third fault the second fix exposed: with the
> bar removed, the row still had three grid tracks, so the figure landed in the middle `1fr` and
> sat mid-row instead of against the right edge — breaking the decimal column the mono face exists
> to hold. `.rowNoBars` / `.uncategorizedNoBars` drop to two tracks. The panel-height fix from
> *Could Improve 1* went in at the same time. Original findings below.

1. **The Uncategorized row has no magnitude bar.** See
   `screenshots/review-reports-desktop-1280.png`: every label row carries a bar and
   `Uncategorized 18.50` does not, leaving a gap in the column exactly where the eye is scanning.
   It is rendered outside `LabelTreeRow` (`ActivityPanel.tsx`) and never got one. At 1.1% of the
   total it is precisely the case `--bar-min-width` was added for. _Fix: give it a `MagnitudeBar`
   like any other row. It stays visually distinct through its italic name and lack of indent._

2. **A single-row breakdown draws a full-width bar that says nothing.** See the EARNED panel in
   `screenshots/review-reports-desktop-1280.png` — `salary` is 100% of income, so its bar spans
   the column and encodes no information, while sitting beside SPENT's bars at a different scale
   and inviting a cross-panel comparison that is meaningless. _Fix: suppress bars when a panel has
   one row. A comparison of one thing is not a comparison._

## Could Improve

1. **The EARNED panel is mostly empty.** The grid gives both panels equal height, so a one-row
   breakdown leaves ~200px of dead space (`screenshots/review-reports-desktop-1280.png`). On a
   restrained surface a large empty box reads as unfinished rather than quiet. _Suggestion:
   `align-items: start` on `.panels` so each panel takes its natural height._

2. **Period and Currency sit at opposite ends of a 900px span.** `justify-content: space-between`
   pushes them apart until they stop reading as one control group. _Suggestion: group them left
   with a gap, or keep Period left and cap the row's measure._

3. **The currency control disappears on an empty range.** With no totals there are no currencies,
   so the segmented control unmounts and returns when you switch back
   (`screenshots/review-reports-empty-range-desktop-1280.png`). Correct, but it makes the controls
   jump. _Suggestion: derive the currency list from the Book's accounts rather than from the
   current response._

4. **Bar columns do not align between the two panels.** The name column is `max-content`, so
   `housing`/`transport`/`Uncategorized` produce a wider column than `salary`, and the bars start
   at different offsets side by side. _Suggestion: a shared minimum name width across panels._

5. **A parent's direct spending vanishes when it has children.** Once Must Fix 1 is applied, a
   label with both its own postings and children shows only the rolled-up figure, and its direct
   share is unreachable. Not visible in this Book (`food` has `own` = 0). _Suggestion: when
   `own` is non-zero, an expanded parent could list a first child row for its direct spend._

6. **`/accounts` is left-aligned while `/reports` is centred.** Now that they are siblings in the
   nav this reads as an inconsistency — compare `review-retrofit-accounts-desktop-1280.png` with
   `review-reports-desktop-1280.png`. Pre-existing, but newly visible. _Suggestion: centre the
   accounts column too._

## What Works Well

- **The product's central claim is now demonstrable on screen.** The seeded Book contains a £200
  transfer between the user's own accounts and £20,000 of opening balances. Spent reads 1,618.50
  and Earned 2,800.00 — neither figure is polluted. This is the lie the brief was written to fix,
  and it is fixed, visibly, against a real backend.

- **The breakdown reconciles in front of you.** 1,000.00 + 420.00 + 180.00 + 18.50 = 1,618.50, the
  figure in the heading. It holds for the live data as well as the fixtures, and a test asserts it
  as exact strings rather than trusting it.

- **The money retrofit is a large, visible improvement everywhere.** `/accounts` previously showed
  `21181.5000`; it now shows `21,181.50` (`review-retrofit-accounts-desktop-1280.png`), and the
  ledger's rows read `15,000.00 GBP` and `18.50 GBP`. The previous review's Should Fix 2 is
  resolved, and resolved without a float touching a figure — `formatForDisplay` is string surgery
  and `barWidth` returns a percentage computed in BigInt, so the codebase still has **zero**
  lint-disables for the `Number` ban in source.

- **Negative money reads correctly without colour doing the work.** USD net worth is −422.75 and
  carries its minus sign in mono tabular figures; the tint is reinforcement. It survives greyscale,
  which is the whole of token decision 1.

- **Dark mode is a recomputed room, not an inversion.** Warm near-black canvas, panels lifted one
  step, and the bar fill at `#4A4740` sits at the same perceived weight as `#C7C2BA` does in light
  — visible in both without ever competing with the figure
  (`review-reports-dark-mode-desktop-1280.png`).

- **Mobile reorganises rather than shrinks.** Three nav items still fit at 375px, net worth wraps
  to one currency per line, and the bars are dropped entirely so the name and the figure keep the
  width — the figure never compromises (`review-reports-mobile-375.png`).

- **The two empty states are genuinely different.** An empty range says "Nothing recorded in this
  range"; an empty Book points at the ledger. One is a fact about a period, the other an
  instruction, and the copy does not confuse them.

- **The page reports without editorialising.** No percentages presented as verdicts, no comparison
  to last month, no encouragement. `KEPT 1,181.50 GBP` is stated and left alone. Principle 1 held
  all the way through the build.
