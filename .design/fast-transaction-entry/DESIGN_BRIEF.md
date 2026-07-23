# Design Brief: Fast Transaction Entry (life-tracker-web)

> Status: Phase 2 of `/design-flow`. Phase 1 (grilling) was cut short at the designer's
> instruction ("for now go as is"), so the open decisions were resolved with the recommended
> answers. Those are listed under **Assumptions** at the bottom and are the first thing to
> revisit if anything here feels wrong.

## Problem

You just paid for something. Right now, in a shop, on your phone. If recording it takes more
than a few seconds you will not do it — you will tell yourself you'll catch up on Sunday, and
Sunday will be a wall of forgotten receipts.

And when you do catch up, the tools lie to you. Move £200 from current account to savings and
most apps count it as £200 spent and £200 earned. Pay off a credit card and they count the
spending twice — once when you swiped, once when you paid the bill. So the number you were
trying to find out is wrong, which is the reason you stopped bothering.

Life Tracker's backend already fixes the lying. What it does not yet have is anywhere to type.

## Solution

A single surface where recording money takes one sentence's worth of thought: *what happened,
how much, what for.* You pick from four everyday things — **Spent**, **Earned**, **Moved**,
**Paid off** — and the app works out the double-entry behind it. You never see a debit, a
credit, or the word "posting."

The ledger underneath is append-only: nothing can be edited or deleted, ever. Rather than
defend against that with a confirmation dialog on every entry — which would destroy the speed
this exists for — the entry holds for a few seconds before it commits. Caught in that window, a
mistake never happened. Caught later, you reverse it, which is what the domain already
prescribes for refunds.

## Experience Principles

1. **Human intent over ledger mechanics** — the user says "Spent £12 on coffee." The app
   chooses the account kinds, the direction of each posting, and which leg carries the label.
   If the interface ever makes someone think about debits and credits, it has failed. This is
   ADR-0012 expressed as a UI.

2. **Reversible by design over confirm-everything** — speed and an immutable ledger are in
   direct conflict, and confirmation dialogs resolve it in the wrong direction. A commit delay
   plus honest reversal buys safety without buying friction. The undo window is the safety
   feature; there are no "are you sure?" modals.

3. **Precision over convenience with money** — every amount is a decimal string from the input
   element to the request body. It is never parsed into a JavaScript number, never summed
   client-side, never formatted through anything that round-trips a float. Figures are set in a
   monospace face so columns align and a misplaced decimal is visible.

## Aesthetic Direction

- **Philosophy**: **Dieter Rams (Functionalist)**. Chosen because this is a tool used in
  seconds under mild stress, where colour must carry meaning rather than mood. "Colour is
  information, not decoration" maps exactly onto a ledger — money in, money out, and a balance
  that may be negative. Restraint here is not taste, it is legibility.
- **Tone**: Calm, exact, unhurried in appearance while being fast in use. Trustworthy the way a
  bank statement is trustworthy — not the way a fintech ad is.
- **Reference points**: Braun product graphics; the density and keyboard-first rhythm of Linear;
  the quiet precision of a Muji receipt.
- **Anti-references**: Gamified personal-finance apps — no confetti, no streaks, no
  encouragement copy, no emoji category icons. Nothing that celebrates spending. Equally not
  enterprise-accounting grey: no dense toolbars, no ledger tables presented as spreadsheets.

### Typography (functional rationale, not preference)

- **UI**: IBM Plex Sans. Functional grotesque with true tabular figures.
- **All monetary figures**: IBM Plex Mono. Amounts must align on the decimal down a column, and
  a mono face makes `1200.00` visibly different from `12.00` at a glance — directly mitigating
  the fat-finger risk that principle 2 exists for.

## Existing Patterns

**None. This is greenfield.** Swept the whole workspace: no `package.json`, no
`tailwind.config.*`, no `tokens.css` / `theme.css` / `globals.css`, no component directory, no
Storybook, no font loading, not a single `.tsx` or `.jsx`. `life-tracker-web` does not exist
locally and does not exist on GitHub either.

- Typography: none established
- Colors: none established
- Spacing: none established
- Components: none exist

Everything in the inventory below is therefore new, and Phase 4 (design tokens) has a blank
canvas rather than a system to extend.

The binding constraints come from elsewhere, and they are hard:

- `life-tracker-contracts/openapi.yaml` is the sole source of truth for every request and
  response type. Types are **generated**, never hand-written. A field not in the spec does not
  exist — the workspace `CLAUDE.md` is explicit that guessing one is worse than asking, because
  it compiles.
- Money crosses the wire as `{ "amount": "12.34", "currency": "USD" }` — a string, in both
  directions.
- `life-tracker-backend/CONTEXT.md` fixes the vocabulary. The UI says *account*, *transaction*,
  *label*, *Uncategorized*. It does not say category, bucket, wallet, entry, leg, or split.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `IntentSelector` | New | Spent / Earned / Moved / Paid off. The first and most important control; determines which account kinds populate the two pickers. |
| `AmountField` | New | String-only. Decimal keypad on mobile, mono face, currency adornment from the chosen account. Must never touch `parseFloat`. |
| `AccountPicker` | New | Filtered by kind according to intent. Shows each account's currency, since that drives the cross-currency path. |
| `LabelPicker` | New | Flat fetch, client-side filter (spec says there is deliberately no search endpoint), ≤3-level tree. **Hidden entirely when the intent has no Income/Expense leg.** |
| `SecondAmountField` | New | `toAmount`. Appears only when the two chosen accounts differ in currency. |
| `DateField` | New | Defaults to today. Calendar date only — a timestamp is metadata per ADR-0003. |
| `UndoToast` | New | Holds the commit, counts down, cancels. The safety mechanism for principle 2. |
| `TransactionList` | New | Newest-first confirmation that entry worked. Read-only. |
| `EmptyBookOnboarding` | New | First-run account creation. Unavoidable — see Key Interactions. |
| `ProblemBanner` | New | Renders RFC 7807 `Problem`, switching on `code`. |

## Key Interactions

**First run — the empty Book.** `/auth/register` creates the User and an *empty* Book: zero
accounts. Fast entry is literally impossible until accounts exist, so the first session cannot
be the entry screen. A short guided setup creates a minimum viable set — one asset the user
spends from, one coarse expense account, one income account, and an equity account for opening
balances. Accounts stay coarse on purpose (`CONTEXT.md`: accounts exist to make transactions
balance, not to categorize); the fine-grained naming is labels' job. There is no bulk endpoint,
so this is N sequential `POST /accounts` calls and the UI must show progress and survive a
failure partway through.

**The entry itself.** Intent first, then amount, then the two accounts, then optionally a label.
Choosing the intent pre-filters both pickers by account kind, which is what removes the
double-entry thinking: "Spent" offers assets/liabilities on one side and expenses on the other,
so an internal transfer cannot accidentally be booked as spending. Amount takes focus
immediately; the whole form is completable from the keyboard without reaching for a mouse.

**Commit and undo.** On submit the row appears in the list at once and a countdown starts. The
POST does not fire until it elapses. Cancel and the row disappears having never existed. Let it
run and it commits; from then on the only correction is a reversing transaction, offered
explicitly as "Reverse this" rather than a disabled-looking edit button.

**Labels appear and disappear.** A label may only attach where exactly one Income or Expense leg
exists. Moved (asset→asset) and Paid off (asset→liability) have none, so the field is not
rendered at all — not greyed out, not present-but-rejected. This mirrors `LABEL_NOT_APPLICABLE`
in the spec, and is the difference between an interface that teaches the model and one that
lets you fail and then explains.

**Cross-currency.** When the two chosen accounts have different currencies a second amount field
appears, asking for the real figure that arrived, in the destination's currency. The app never
multiplies by a rate to produce an amount — both figures come from the user, and the rate is
derived by the server for reference only (ADR-0002). This must be surfaced as "what actually
landed," not "converted amount."

**Errors.** Every failure is an RFC 7807 `Problem`; the UI switches on `code`, never on the
prose in `detail`.

## Responsive Behavior

Mobile-first, because the moment of entry is standing at a till. Below 640px the form is a
single column with the amount field and numeric keypad occupying the top half and the intent
selector as a full-width segmented control within thumb reach. The undo toast pins above the
safe area.

The behavioural change on wider screens is not just size: from 1024px the entry form and the
recent-transaction list sit side by side, and entry becomes a persistent panel rather than a
route — you type, it lands in the list beside you, you type the next one. That turns catch-up
sessions at a desk into a rhythm, which the single-column mobile layout cannot support.

## Accessibility Requirements

- WCAG 2.1 AA. 4.5:1 for text, 3:1 for UI boundaries and focus rings. Colour never the sole
  carrier of meaning — money direction is also signed and labelled, since a red/green-only
  ledger fails for the most common form of colour blindness.
- Fully keyboard-operable end to end, including the label picker's tree and the undo toast's
  cancel. This is a speed tool; the keyboard path is the primary path, not the fallback.
- The undo countdown is announced via `role="status"` (polite), and cancelling is reachable by
  keyboard without a mouse-only hover target. A time limit that cannot be extended would fail
  SC 2.2.1, so the window is configurable and can be turned off.
- Amount fields carry an accessible name including the currency; screen readers must not read
  `1200.00` without it.
- Focus moves to the new row on commit, and returns to the amount field when the form resets,
  so repeat entry never requires re-orienting.
- `prefers-reduced-motion` respected; the countdown remains legible without animation.

## Out of Scope

- **Reports** — net worth, spending, income. The endpoints exist and are tempting; they are the
  other half of the product and were explicitly deprioritised in favour of entry.
- **Sharing and viewer mode** — Share Link and View Grants, and any read-only rendering of
  someone else's Book. Real, spec'd, and a separate design problem.
- **Session management UI** — the "active devices" screen.
- **Editing or deleting a transaction** — not descoped by choice; the API has no such endpoint.
  Reversal is the mechanism.
- **Renaming, archiving, or deleting an account** — likewise absent from the API.
- **Label tree management** — creating, reparenting and archiving labels has a full CRUD surface
  and deserves its own brief. This build only *picks* existing labels, plus create-inline if it
  proves necessary.
- **Splits, merchant, branch** — named in the domain glossary but not in the spec. Must not be
  invented.
- **Auth screens beyond what unblocks entry** — password reset and email verification flows are
  assumed minimal.

## Assumptions

Recorded because Phase 1 was ended early; each is a decision made on the designer's behalf.

1. **Correction strategy**: client-side undo window plus explicit reversing entries, rather than
   a per-entry confirmation step. Recommended and accepted implicitly.
2. **Four intents** (Spent / Earned / Moved / Paid off) as the entry model. Derived from
   `CONTEXT.md`'s named transaction shapes — Internal Transfer, Payment, Opening Balance — but
   the wording is a design choice, not a domain term, and is worth testing on a real user.
3. **Opening balances** are treated as part of onboarding rather than a first-class entry
   intent, on the grounds that they happen once.
4. **Stack**: Vite + React + TypeScript, per the workspace `CLAUDE.md` description of
   `life-tracker-web`. The repo does not exist yet and will need scaffolding before Phase 6.
5. **This file's location**: `.design/` sits in the workspace meta-repo because the web repo
   does not exist. It should move into `life-tracker-web/` once that is created.

## Blocking Issues Found During Research

Not design problems, but they will bite during the build:

1. **`life-tracker-contracts/CLAUDE.md` is stale and misleading.** It states "Identity & Sharing
   only for now… do not add Ledger endpoints or fields here until that is designed," while
   `openapi.yaml` already carries the full ledger surface. Its README is stale the same way.
   Any agent starting in that repo will read it and refuse to build ledger UI.
2. **`Problem.code` is missing 10 codes** that the spec itself references: `LABEL_NOT_FOUND`,
   `LABEL_NAME_TAKEN`, `LABEL_DEPTH_EXCEEDED`, `LABEL_CYCLE`, `LABEL_IN_USE`,
   `LABEL_HAS_CHILDREN`, `LABEL_ARCHIVED`, `LABEL_NOT_APPLICABLE`, `POSTING_NOT_FOUND`,
   `MALFORMED_REQUEST`. Error handling switches on `code`, so a generated client's enum will be
   incomplete. Fix in the spec first — never in the consumer.
3. **`GET /transactions` has no pagination or date filter** — the whole history returns on every
   call. Fine at first, a real problem later, and worth flagging to the backend before the list
   view is built around the assumption.
