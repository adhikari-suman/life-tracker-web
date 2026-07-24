# Design Tokens — extended, not created

Phase 4 for Reports produced **no new token file.** The system already existed and this feature
extends it in place:

**[`src/styles/tokens.css`](../../src/styles/tokens.css)**

There is no copy under `.design/` on purpose, for the same reason the entry surface left none:
two files of colour values drift, and the one under `.design/` would be the one nobody edits and
everybody quotes. This document records *what changed and why*; the values themselves live where
someone changing them will actually be standing.

## What was added

### A fourth standing decision

The file's header carried three non-negotiables. Reports adds the fourth, because it is the rule
most likely to be violated by well-meaning future work:

> **4. MAGNITUDE IS LENGTH, NEVER HUE.**
> The reports breakdown encodes "how much" as bar length in a single neutral tone. There is no
> categorical palette in this file and there must not be one: a colour per label would need
> eight-plus hues, which breaks decision 3 outright, fails in greyscale, and fails the same
> colour-blind readers decision 1 protects. **A pie or donut chart is therefore unbuildable from
> these tokens by design, not by omission.**

That last sentence is the point. Someone will eventually want a donut chart. The tokens should
make it obvious that its absence was a decision.

### One new colour, in both themes

| Token | Light | Dark |
|---|---|---|
| `--color-bar-fill` | `#C7C2BA` | `#4A4740` |

Computed, not eyeballed, consistent with the rest of the file:

| | on `--color-bg-secondary` | on canvas |
|---|---|---|
| Light `#C7C2BA` | 1.77:1 | 1.70:1 |
| Dark `#4A4740` | 1.80:1 | 1.97:1 |

**Why so low.** The obvious move is to reuse `--color-border-strong` (3.33:1 light, 4.09:1 dark),
which is the file's calibrated value for a visible edge. That would be wrong here: that ratio is
tuned for a **1px line**, and the same contrast spread across a **filled area** reads far heavier
— the bar would compete with the figure it exists to support. The two themes are matched on
perceived weight rather than derived by flipping lightness, which is the rule the dark palette
already follows throughout.

The bar is non-text and decorative, so WCAG 1.4.11 does not bind it. It is marked `aria-hidden`;
the figure beside it is the accessible content.

### Component-level tokens

```
--bar-fill  --bar-height  --bar-radius  --bar-min-width  --bar-transition
--panel-bg  --panel-border  --panel-radius  --panel-padding  --panel-gap
--tree-indent
--net-worth-font-size
--skeleton-bg  --skeleton-radius
```

Three of these encode a decision rather than a measurement:

- **`--bar-min-width: 2px`** — a nonzero amount must never render as nothing. Without a floor,
  0.3% of a total is a sub-pixel bar that reads as absent, so the bar would lie by omission on
  exactly the small rows a reader is least likely to check against the figure.

- **`--net-worth-font-size: var(--font-size-2xl)`** — *not* `--font-size-4xl`, which the file
  reserves for the entry amount field "and nothing else". That reservation is precisely why the
  amount field reads as the most important thing in the app. Net worth is the largest figure on
  its own page; it is not the largest thing in the product, and taking 4xl would quietly demote
  the control the entire entry brief was built around.

- **`--skeleton-bg`** — a static well colour, not a shimmer. Animated skeletons are decorative
  motion, which this philosophy excludes.

## What was deliberately not added

- **No categorical palette.** See decision 4.
- **No bar track.** The unfilled remainder is not drawn. Rows share a container width, so lengths
  compare directly against each other without a rail to measure from — and a track is one more
  thing on screen earning nothing.
- **No new motion tokens.** `--duration-normal` and `--easing-out` already cover the bar's width
  transition. The existing `prefers-reduced-motion` block collapses it automatically, so bars
  render at final width immediately for users who ask for that — no separate handling needed.
- **No status colours for money.** Decision 1 stands: `--color-money-negative` tints an
  already-signed figure and is never the sole carrier of meaning. Nothing on this surface is
  green-for-good or red-for-bad, including `KEPT` when it is negative.
