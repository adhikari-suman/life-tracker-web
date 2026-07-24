# Design Review: Fast Transaction Entry (life-tracker-web)

Reviewed against: `DESIGN_BRIEF.md`
Philosophy: **Dieter Rams (Functionalist)**
Date: 2026-07-24

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-login-desktop-1280.png` | Desktop (1280×800) | Sign-in screen |
| `screenshots/review-login-tablet-768.png` | Tablet (768×1024) | Sign-in screen |
| `screenshots/review-login-mobile-375.png` | Mobile (375×812) | Sign-in screen |
| `screenshots/review-ledger-desktop-1280.png` | Desktop (1280×800) | Entry form + recent list, side by side |
| `screenshots/review-ledger-tablet-768.png` | Tablet (768×1024) | Single column; account pickers paired |
| `screenshots/review-ledger-mobile-375.png` | Mobile (375×812) | Single column, form then list |
| `screenshots/review-ledger-dark-mode-desktop-1280.png` | Desktop (1280×800) | Ledger, dark, profile menu open |
| `screenshots/review-ledger-dark-mode-mobile-375.png` | Mobile (375×812) | Ledger, dark |
| `screenshots/review-accounts-desktop-1280.png` | Desktop (1280×800) | Balances grouped by kind, per-currency totals |
| `screenshots/review-transaction-detail-desktop-1280.png` | Desktop (1280×800) | Detail with relabel and reverse |
| `screenshots/review-setup-desktop-1280.png` | Desktop (1280×900) | First-run onboarding |
| `screenshots/review-setup-mobile-375.png` | Mobile (375×812) | First-run onboarding |

> All screenshots are in `.design/fast-transaction-entry/screenshots/`. Captured against the live
> `life-tracker-backend` compose stack, not mocks.

## Summary

The build is a faithful, disciplined execution of the Rams brief: restrained warm neutrals, a
single burnt-orange accent that appears only on the one primary action per screen, borders in
place of shadows, one strict type scale, and money set in mono tabular figures that align on the
decimal down every column. The intent model does the thing the whole product exists for — you say
"Spent £12 on coffee" and never meet a debit. The biggest finding is not a flaw in what is there
but a deviation in *where* one thing is: on mobile the undo affordance lands below the fold, where
the brief asked for a toast pinned above the safe area. That is the one Should Fix with real user
impact; everything else is polish.

## Must Fix

_None._ No broken functionality, no accessibility failures, no major deviation from the brief's
aesthetic. Every route works against the live backend; contrast ratios were computed in the tokens
rather than eyeballed; the money-string discipline holds end to end.

## Should Fix

1. **The undo affordance is below the fold on mobile.** ✅ **Fixed during this review.** The brief's
   mobile spec is explicit: "The undo toast pins above the safe area." The first implementation put
   the pending row — countdown and Cancel — inline at the top of the *Recent* list, which on a
   375px screen sits below the form; after recording, focus returns to the amount field at the top,
   so the window to cancel was off-screen. Now, below the 1024px split, a `MobileUndoToast` pins
   the still-recallable entry to the bottom safe area (`bottom: env(safe-area-inset-bottom)`, using
   the tokens' `--toast-bg` / `--toast-shadow`), and the inline pending rows are hidden there so the
   countdown is not both below the fold and in the toast — which also avoids a duplicate
   `role="status"` live region. Failed rows stay inline at every width. See the current
   `review-ledger-mobile-375.png`: dark toast reading "Spent 7.50 USD — 5s to undo — Cancel". The
   inline row remains the desktop pattern, where the list is always in view.

2. **Money renders with four fractional digits everywhere the server sends them.** Balances and
   per-currency totals read `0.0000 USD` and `12.3400 USD` (see `review-accounts-desktop-1280.png`
   and the recent list). This is *correct* under the money discipline — `MoneyText` renders the
   string verbatim and never reformats through a float — but USD and EUR conventionally show two
   fractional digits, and four reads as noise on a scanning column. _Fix: a display-only
   normalisation to the currency's minor-unit count, done as string operations in `src/money/`
   (never via `toFixed`/`Number`), so `"12.3400"` shows as `12.34` while the underlying value and
   every request body stay untouched. This is a conscious trade — verbatim rendering vs.
   conventional presentation — and worth deciding rather than defaulting into._

## Could Improve

1. **The empty amount field shows `—` as its currency adornment** until an account is chosen (the
   currency follows the source account). It is honest — the entry is not yet in any currency — but
   `—` is slightly cryptic as a first impression. _Suggestion: hide the adornment entirely until a
   `from` account is picked, rather than showing a dash._

2. **The single-column form runs full-width on a wide tablet.** At 768px the entry form spans the
   whole viewport (`review-ledger-tablet-768.png`), so the hero amount field and pickers get wide
   before the 1024px side-by-side split. _Suggestion: cap the form column at `--max-width-form`
   even in the single-column layout, so it stays a comfortable measure between 640 and 1024px._

3. **The recent list has no loading state.** Against the local backend it populates instantly, but
   a first paint over a slow connection would show the empty-state copy briefly before the list
   arrives. _Suggestion: a quiet skeleton or a held empty state while `loading` is true._

## What Works Well

- **The aesthetic is unmistakably Rams, and consistently so.** One accent, spent only on the
  Record button and the focus ring; if two things were accent-coloured, one would be wrong, and
  nowhere are two. Borders separate; shadows appear only on genuinely floating things (the profile
  menu, the label dropdown). The segmented intent control marks its selection with elevation and
  weight, not colour — so it reads in greyscale. See `review-ledger-desktop-1280.png`.
- **Money is treated as the thing that must never be misread.** Mono tabular figures align on the
  decimal down the recent list and the accounts columns; `1200.00` cannot be mistaken for `120.00`.
  The discipline is not just visual — it is a string from keystroke to request body, enforced by a
  validating constructor, a repo-wide lint ban, and tests that prove the amounts a double would
  corrupt survive intact.
- **The intent model delivers the brief's core promise.** Choosing Spent / Earned / Moved / Paid
  off reconfigures the two pickers by account kind, so an internal transfer is *structurally*
  unbookable as spending — the destination picker simply does not offer an asset. The label field
  is absent, not disabled, for Moved and Paid off. No debit or credit is ever shown.
- **The undo mechanism is exactly the brief's resolution of speed vs. an immutable ledger.** The
  row appears at once, the POST holds, Cancel within the window sends nothing, and the window is
  adjustable and can be turned off (WCAG 2.2.1). Verified live end to end.
- **Dark mode is intentional, not inverted.** Warm near-black matching the warm off-white of light
  mode, off-white text rather than pure white, the accent lifted so it stays legible, shadows
  recomputed. The manual toggle overrides the system preference in both directions
  (`review-ledger-dark-mode-desktop-1280.png`).
- **Accessibility is built in, not bolted on.** Keyboard-operable end to end (the intent selector
  is an arrow-key radiogroup; the amount autofocuses on arrival); `role="status"` on the countdown;
  focus returns to the amount on reset; money direction reads from sign and wording, never colour
  alone; landmarks and associated labels throughout.
