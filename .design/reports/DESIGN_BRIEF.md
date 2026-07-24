# Design Brief: Reports (life-tracker-web)

> Status: Phase 2 of `/design-flow`. Phase 1 (grilling) was run in full this time — ten decisions
> were put to the designer and answered. The **Assumptions** section at the bottom is
> correspondingly short, and lists only what was decided without asking.

## Problem

You did the work. For weeks you recorded every coffee, every shop, every transfer between your own
accounts. The entry surface made it fast enough that you actually kept it up.

And you still cannot answer the question you started with.

The original problem was that other apps *lie* — they count a £200 move from current to savings as
£200 spent and £200 earned, and they count a credit-card swipe once when you swipe and again when
you pay the bill. Life Tracker fixed that. Transfers touch no Income or Expense account, so they
are excluded from spending by construction, not by a filter you have to remember to tick.

So the number is finally correct. It is also invisible. It lives in Postgres, reachable by three
endpoints that nothing calls. The ledger tells the truth to nobody.

## Solution

One surface that answers the three questions the double-entry work was for:

- **What am I worth?** — Assets minus Liabilities, as of today.
- **What did I spend?** — real spending over a range, with transfers and card payments absent
  because they were never expenses.
- **What did I earn, and what did I keep?**

Figures, ranges, and bars. Nothing else. The dashboard's whole job is to be believed, so it states
what it knows, shows its arithmetic, and stops. Where the API cannot answer a question, the
interface does not gesture at an answer — it stays silent, and the gap is written down rather than
designed around.

## Experience Principles

1. **Truth over comfort** — the dashboard reports; it never reassures, congratulates, or grades.
   No streaks, no "you did well this month", no percentage presented as a verdict. `KEPT` is a
   figure, never praise. In practice this means the copy contains no adjectives about the numbers,
   and the only evaluative signal in the whole surface is the minus sign.

2. **Reconciliation over impression** — every breakdown visibly sums to the total above it. Root
   labels plus Uncategorized equal the panel total exactly, and that is asserted in a test, not
   hoped for. This is why the tree collapses to roots by default: `rolledUp` summed across mixed
   depths double-counts *silently*, and a number that is quietly too big is worse than no number.
   The same discipline governs arithmetic: **a float may become a pixel, never a glyph.** Bar
   widths are floats because a rounding error in a CSS width is invisible; every displayed figure
   is exact string arithmetic.

3. **Honest absence over invented capability** — there is no cross-currency total, because valuing
   across currencies needs a base currency and historical rates that ADR-0002 puts out of scope,
   and a single blended number would be a lie. There is no drill-down from a label, because
   `GET /transactions` filters only by `accountId`. There is no trend line, because no endpoint
   returns a time series. Each of these is recorded below as a named gap rather than approximated.

## Aesthetic Direction

- **Philosophy**: **Dieter Rams (Functionalist)**, inherited unchanged from the entry surface. It
  earns its place twice over here — "colour is information, not decoration" is the reason the
  breakdown encodes magnitude as *length* rather than hue, which is also what makes it work in
  greyscale and for the ~8% of men with red-green colour blindness.
- **Tone**: Still, exact, unhurried. The entry surface was calm *while being fast*; this one is
  calm because there is nothing to hurry. Closer to reading than to doing. The register of a
  statement you sit down with, not a notification you dismiss.
- **Reference points**: A bank statement's quiet authority; the Muji receipt already cited in the
  entry brief; Braun product graphics; the density and restraint of Linear's list views.
- **Anti-references**: Every personal-finance dashboard ever shipped — donut charts in twelve
  hues, category emoji, "You're on track!", month-over-month arrows in red and green, budget
  progress rings. Equally not a BI tool: no filter bars, no drag-to-zoom, no chart toolbar. If it
  looks like Mint or like Grafana, it is wrong.

## Existing Patterns

This feature extends a complete, documented system. Nothing here is greenfield, and the token file
is explicit that three of its decisions are not negotiable without revisiting the brief.

- **Typography**: IBM Plex Sans (UI) and IBM Plex Mono (all figures), self-hosted via
  `@fontsource`. One scale — a 1.200 minor third from a 16px base, `--font-size-xs` through
  `--font-size-4xl`. `--font-size-4xl` is reserved for the entry amount field "and nothing else",
  so the net-worth figure must not claim it.
- **Colors**: Warm neutrals, not blue-greys — the light surface reads as paper. A single burnt
  orange (`--color-accent-primary`, `#C2410C` light / `#F97316` dark) for the primary action and
  focus ring only. Every contrast ratio in the file was computed against WCAG 2.1
  relative-luminance, not eyeballed. Dark mode is recomputed rather than inverted.
  **`--color-money-negative` is reinforcement only and must never be the sole carrier of meaning.**
- **Spacing**: 4px base, `--space-0` … `--space-12`, no arbitrary values. `--size-touch-target` is
  44px. Radii near-absent (2/4/6px). Borders over shadows; shadows only for genuinely floating
  things.
- **Components**: `MoneyText` is the sole authority for rendering a figure and every amount in the
  app goes through it. `ProblemBanner` renders RFC 7807 and switches on `Problem.code`. `AppShell`
  provides the top bar and the account menu. The global `.money` class carries
  `font-variant-numeric: tabular-nums` and must be applied by class, never restated ad hoc.
- **Stack**: No Tailwind, no UI framework, no Storybook. CSS Modules plus CSS custom properties.
  React 19, react-router 8, Vite 8, vitest. `oxlint` bans the `Number` global, `parseFloat` and
  `parseInt` outright; any use requires a disable comment stating what the value is.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `ReportsPage` | New | The route. Fires three requests; each panel resolves independently so one failure does not blank the page. |
| `NetWorthStrip` | New | Sits **above** the range control, outside its scope, labelled "as of today". Renders every currency side by side. Must not use `--font-size-4xl`. |
| `RangePicker` | New | Four presets: This month (default) / Last month / This year / All time. A native `<select>` — no custom date picker is being built. |
| `CurrencyScope` | New | Segmented control scoping the spending and income panels to one currency. **Rendered only when the Book holds more than one.** |
| `ActivityPanel` | New | Used twice — SPENT and EARNED. Same `ActivityReport` shape, same rendering, different heading and endpoint. |
| `LabelTreeRow` | New | One row: disclosure triangle, indented name, magnitude bar, figure. Roots show `rolledUp`; expanded children show `own`. |
| `MagnitudeBar` | New | Single neutral tone — **not the accent** (token rule 3). Width from `barWidth()`. Decorative only; the figure is always present beside it. |
| `KeptFigure` | New | `EARNED − SPENT` via exact string subtraction. Stated plainly, with no framing or proportion. |
| `MoneyText` | **Modify** | Gains display normalisation: trim to the currency's minor units, insert grouping separators. String operations only. **This changes every figure on every existing screen.** |
| `amount.ts` | **Modify** | Add `subtractAmounts()` (exact, same-currency, sibling of the existing `addAmounts`), `formatForDisplay()`, and `barWidth()` — the last carrying the codebase's single justified lint-disable. |
| `AppShell` | **Modify** | A third primary nav item. This contradicts the existing IA and is deferred to Phase 3. |
| `ProblemBanner` | Exists | Reused unchanged, per panel rather than per page. |
| `EmptyRange` | New | For a range containing no activity — distinct from a Book with no transactions at all. |
| `PanelSkeleton` | New | The existing ledger list has no loading state and the design review flagged it. This surface fetches three things and must not pop in. |

## Key Interactions

**Arriving.** Three requests fire in parallel: net worth (no parameters), spending and income (this
month). Each panel shows a skeleton until its own response lands. Net worth typically returns
first and is the shortest — the page fills top-down, which is also its reading order.

**Changing the range.** Selecting a preset re-requests spending and income only. The net worth
strip does not move, and it says "as of today" so that stillness reads as correct rather than
broken. The two panels reload together; the strip never flickers.

**Switching currency.** Only possible in a multi-currency Book. The segmented control re-scopes
the two panels client-side — the response already contains every currency, so no request is made.
The net worth strip continues to show all currencies, because "what am I worth" is not a
per-currency question even though its answer has to be given per currency.

**Expanding a label.** The disclosure triangle reveals children indented one level, showing their
`own` figures. The parent continues to show `rolledUp`, and the indent carries the "contained
within" relationship — the parent must never read as a peer of its children, because summing what
is then on screen would double-count. Expansion is local component state, not URL state.

**Tapping a label row.** Nothing happens. Rows are not links, carry no hover affordance, and no
cursor change. This is deliberate: the gesture users will reach for is unsupported by the API, and
a dead-end click is worse than an obviously inert row.

**When a panel fails.** That panel renders a `ProblemBanner` in place; the other two are unaffected.
A failed spending request must not take the net-worth figure off screen.

## Responsive Behavior

- **Mobile (375px)**: Single column, stacked — net worth strip, range control, SPENT, EARNED. The
  strip wraps to one currency per line. Label rows keep the bar but it narrows; the figure always
  wins the space. Disclosure targets meet the 44px minimum.
- **Tablet (768px)**: Still single column, capped at `--max-width-content` rather than running
  full-width — this is the exact fault the previous design review raised against the entry form at
  this breakpoint, and it should not be repeated.
- **Desktop (≥1024px)**: SPENT and EARNED sit side by side; the net worth strip spans both. 1024px
  is already the breakpoint at which the entry surface splits, and reusing it keeps the app's
  layout logic to one number.
- **Behavior change, not just size**: the currency segmented control becomes a `<select>` below
  768px if a Book holds more than three currencies, since segments stop being tappable.

## Accessibility Requirements

- **Bars are decorative and marked `aria-hidden`.** The figure beside them is the accessible
  content. Magnitude must never be available only as a bar length — this follows the token file's
  standing rule that colour and visual encoding are reinforcement, never sole carriers.
- **The label tree uses real disclosure semantics**: `aria-expanded` on each toggle, and the
  parent/child relationship exposed structurally rather than by indentation alone, which is
  invisible to a screen reader.
- **Every figure carries its currency in its accessible name**, via `MoneyText`'s existing
  `sr-only` mechanism, even where a column heading makes it visually obvious.
- **Contrast**: the bar fill is non-text and decorative, so 1.4.11 does not bind it, but it must
  remain visible in both themes and must not be the accent. All text and control boundaries follow
  the existing computed tokens — `--color-border-strong` on any interactive edge, never
  `--color-border-primary`, which measures 1.32:1 and fails.
- **Keyboard**: the range picker, the currency control and every disclosure toggle are reachable
  and operable in order. Focus is never trapped and never moves on its own when a panel reloads —
  a range change must not steal focus from the picker that caused it.
- **Reduced motion**: bar widths animate on load by default; under `prefers-reduced-motion` they
  render at final width immediately.

## Flagged for the backend

Recorded here rather than designed around, following the precedent the entry IA set for
transaction pagination:

1. **`GET /transactions` cannot filter by label or date.** It accepts `accountId` only. Until it
   accepts `labelId` and `from`/`to`, no breakdown row can drill through to the transactions
   behind it — which is the most obvious thing a user will try on this screen.
2. **No time-series endpoint exists.** Any trend view requires one request per period. A
   `groupBy=month` parameter on the activity reports would make trends a single call.
3. **No comparison endpoint.** "Versus last month" is currently two requests, which is part of why
   this brief declines to offer it.

## Out of Scope

- **Trends and history over time** — no sparklines, no month-over-month lines. Blocked on gap 2
  above, and deliberately not faked with N requests.
- **Comparison against a previous period** — no "23% more than last month". Blocked on gap 3, and
  refused on tone grounds by Principle 1 regardless.
- **Budgets** — not deferred; absent. There is no budget concept anywhere in the domain, and
  inventing one in the UI would be inventing a domain object.
- **Cross-currency valuation** — a single blended net worth needs ADR-0002's base currency and
  historical rates. Out of scope there, out of scope here.
- **Drill-down from a breakdown row** — blocked on gap 1.
- **The `byAccount` slice** — the API returns it, and this brief ignores it. `CONTEXT.md` is
  explicit that accounts exist to make transactions balance, not to categorize, so "spending per
  Expense account" answers a question nobody asks. Revisit only if the label tree proves
  insufficient.
- **Custom date ranges** — four presets, no picker. Easy to add later if the gap is felt.
- **Export, print, share** — a report a viewer can see is part of the sharing surface, which is a
  separate design problem.
- **Where Reports sits in navigation** — Phase 3. It requires resolving a direct contradiction with
  the existing IA, which states: *"two items — Ledger and Accounts. That is the whole of it. A
  third would imply the app does three things, and it does not."*

## Assumptions

Decided without asking, and the first things to revisit if they feel wrong:

1. **The income panel mirrors the spending panel exactly** — same tree, same bars, same
   reconciliation. The API returns the identical `ActivityReport` shape for both, and two different
   renderings of one shape would be arbitrary.
2. **A Book with no transactions at all** shows the panels with zero figures and a single quiet
   line pointing at the ledger, rather than a distinct onboarding state. `/setup` already guarantees
   accounts exist before any authenticated route is reachable, so a truly empty Book is a
   short-lived condition, not a first-run experience.
3. **Expansion state is not persisted** — not to the URL, not to storage. It resets on navigation.
4. **The money normalisation is retrofitted app-wide in this feature's task list**, not left as
   follow-up work. Shipping two rendering conventions simultaneously would be worse than either.
