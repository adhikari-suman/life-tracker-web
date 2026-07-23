# Information Architecture: life-tracker-web (Fast Transaction Entry)

> Phase 3 of `/design-flow`. Reads from `DESIGN_BRIEF.md` in this folder.
> No routing, navigation, or layout exists to extend — `life-tracker-web` is unbuilt, so this
> is structure from zero rather than a revision of something.

## The structural thesis

Entry is not a page you navigate to. It is the app.

Everything else — the account list, a transaction's detail — is support for the one action the
brief optimised for. So the IA is deliberately shallow: two levels, three destinations, and a
home route that *is* the entry surface rather than a dashboard that links to it. A nav bar with
five items would already be a failure here.

## Site Map

```
Unauthenticated
- Sign in                     /login
- Create account              /register
- Forgot password             /forgot-password
- Set new password            /reset-password          ?token=
- Verify email                /verify-email            ?token=

Authenticated — no accounts yet (forced)
- Set up your accounts        /setup

Authenticated — normal
- Ledger (entry + recent)     /                        ?account=<uuid>
- Transaction detail          /transactions/:id
- Accounts                    /accounts
```

Nine routes, of which the user meaningfully lives in one. `/setup` is visited once, ever.

**Deliberately absent** (out of scope per the brief, and each would be a top-level destination
when it lands): reports, sharing, session management, label tree management.

## Navigation Model

- **Primary navigation**: two items — **Ledger** and **Accounts**. That is the whole of it. A
  third would imply the app does three things, and it does not. Rendered as a minimal top bar
  on desktop, sitting above the split layout.
- **Secondary navigation**: none. No sidebars, no tabs, no breadcrumbs. At two levels deep the
  back affordance is the browser's, and `/transactions/:id` is reached by clicking a row, so its
  parent is never ambiguous.
- **Utility navigation**: a single account menu at the far end of the top bar — email, sign out.
  Email-verification state lives here too, as a quiet marker rather than a banner, since an
  unverified user is fully able to record transactions (verification gates sharing only, and
  sharing is out of scope).
- **Mobile navigation**: no hamburger and no bottom tab bar. With two destinations a tab bar
  wastes permanent thumb-space on a screen whose entire purpose is a numeric keypad. Instead
  `/` is the default surface and **Accounts** is reached from the top bar. The brief puts the
  amount field and keypad in the lower half of the viewport; nothing may compete for that space.

## Content Hierarchy

### Ledger `/` — the 80% view

1. **Amount field, focused on arrival** — the single most-used control in the app. On mobile it
   occupies the upper half with the numeric keypad below it, and it holds focus on mount so
   recording begins with typing, not tapping.
2. **Intent selector (Spent / Earned / Moved / Paid off)** — read before the amount but placed
   adjacent to it, because it reframes every field beneath. Segmented, always visible, never a
   dropdown; its options must be comparable at a glance.
3. **The two account pickers** — filtered by the chosen intent. Second because the intent
   determines what they contain.
4. **Label picker** — optional, and absent entirely for Moved and Paid off.
5. **Date** — defaults to today and is correct almost always; present but visually quiet.
6. **Recent transactions** — the confirmation that entry worked. Beside the form from 1024px,
   below the fold on mobile. Its job is reassurance, not analysis.

### Accounts `/accounts`

1. **Balance per account, grouped by kind** — the reason to open this page.
2. **Currency per account** — not decoration: it determines whether an entry becomes
   cross-currency, so it must be visible before the user commits to a pairing.
3. **Add account** — needed on an ongoing basis, since onboarding only seeds a minimum.

Balances are grouped by kind and **totalled per currency, never across currencies** (ADR-0002).
There is no single net figure on this page, and that absence is correct.

### Transaction detail `/transactions/:id`

1. **What happened, in the intent's language** — reconstructed from the postings, not shown as
   debits and credits.
2. **Label, editable** — the one mutable thing about a committed transaction
   (`PUT /postings/{postingId}/label`).
3. **Reverse this** — the only correction path once the undo window has passed.
4. **Exchange rate**, when the transaction was cross-currency — reference only, never presented
   as something that produced an amount.

## User Flows

### First run — the empty Book

1. User submits `/register`. Registration **auto-logs-in**: a Session opens and both tokens
   return in the body, exactly as login does.
2. Router guard reads accounts. Zero accounts → forced redirect to `/setup`. This is not
   skippable; entry is impossible without accounts, so offering "skip for now" would strand the
   user on a form that cannot succeed.
3. `/setup` collects a minimum viable set — one asset to spend from, one coarse expense account,
   one income account, one equity account for opening balances.
4. On submit: **N sequential `POST /accounts` calls**, because there is no bulk endpoint.
   - All succeed → redirect to `/`.
   - Partial failure → the created accounts *persist* (there is no rollback and no delete
     endpoint). The step must therefore be resumable rather than restartable: show what exists,
     retry only what is missing. Re-running the whole thing would create duplicates permanently.
5. User arrives at `/` with a working Book.

### Recording a transaction — the hot path

1. User is on `/`, amount field focused.
2. Types an amount → picks an intent → picks two accounts → optionally a label.
   - Intent is Moved or Paid off → the label picker is not rendered. Neither shape has a single
     Income/Expense leg to carry one (`LABEL_NOT_APPLICABLE`).
   - The two accounts differ in currency → a second amount field appears for the figure that
     actually arrived, in the destination's currency.
   - No labels exist yet → the picker offers **create-inline**. This is required, not a
     nicety: label management is out of scope, so without it no label can ever be created and
     every transaction is permanently Uncategorized.
3. Submits. The row appears in the list immediately and a countdown begins. **The POST has not
   fired.**
   - Cancelled within the window → the row is removed. Nothing reached the server.
   - Window elapses → `POST /transactions`. On `201` the optimistic row is reconciled with the
     server's; on failure it is marked and the entered values are restored to the form so the
     work is not lost.
4. Form resets, focus returns to the amount field, ready for the next one.

### Correcting a committed mistake

1. User opens the row → `/transactions/:id`.
2. Wrong label → change it in place. Nothing else moves; no balance, net-worth or per-account
   figure consults labels.
3. Wrong amount or accounts → **Reverse this**, which composes a mirror transaction with `from`
   and `to` swapped, dated today, and drops the user on `/` with it pre-filled for review rather
   than posting it silently. Both entries remain in history, which is the ledger being honest.

## Naming Conventions

`life-tracker-backend/CONTEXT.md` defines a ubiquitous language with explicit _Avoid_ lists. The
UI is bound by it, with one deliberate exception noted below.

| Concept | Label in UI | Notes |
|---|---|---|
| Transaction | **Transaction** | Not "entry", "record" or "purchase". |
| Posting | *never shown* | Internal. The user sees a transaction, never its legs. |
| Debit / Credit | *never shown* | The entire point of the intent model (ADR-0012). |
| Account | **Account** | Ledger sense — a place a balance lives. |
| User account | **Your profile** | The word "account" belongs to the Ledger; the context map calls this collision out as deliberate. Never "account settings". |
| Label | **Label** | Not "category", "tag" or "type". |
| Uncategorized | **Uncategorized** | Not "unlabelled", "misc" or "other" — those are labels someone might create; this is the absence of one. |
| Internal Transfer | **Moved** | *Exception.* The domain term is "Internal Transfer"; as a button in a four-way selector it is long and jargon-heavy. "Moved" is the user-facing wording for the same shape. Flagged for review. |
| Payment | **Paid off** | Same reasoning. The domain term "Payment" is ambiguous in a UI where everything looks like a payment. |
| Opening Balance | **Opening balance** | Appears in `/setup` only. |
| Book | *never shown* | Only meaningful once sharing exists. |
| Exchange Rate | **Rate** | Reference only. Never near an editable amount, so it is never mistaken for an input. |

## Component Reuse Map

| Component | Used on | Behavior differences |
|---|---|---|
| `AppShell` (top bar + main) | all authenticated routes | Absent on auth routes and on `/setup` — onboarding is deliberately chrome-free so there is nothing to navigate away to. |
| `AuthLayout` | the five unauthenticated routes | Single centred column. |
| `EntryForm` | `/`, and `/transactions/:id` when reversing | On `/` it is empty and self-clearing; when reversing it mounts pre-filled. |
| `AccountPicker` | `EntryForm`, `/setup` | Filtered by kind on `/`; on `/setup` it is a creator, not a picker. |
| `MoneyText` | everywhere a figure appears | Renders the decimal string verbatim. Never accepts a number. Sole formatting authority. |
| `TransactionRow` | `/` list, `/transactions/:id` | Gains a pending/countdown state on `/` that detail never shows. |
| `ProblemBanner` | all routes | Switches on `Problem.code`, never on `detail` prose. |

## Content Growth Plan

**The known structural problem.** `GET /transactions` accepts only an optional `accountId` — no
pagination, no date range, no limit. The whole history returns on every call, and a ledger is
append-only by nature, so this grows without bound and never shrinks.

The IA absorbs it for now and does not pretend it is solved:

- The `/` list renders a **windowed slice** of what is fetched, virtualized, so DOM size stays
  flat even as the payload does not.
- The `?account=<uuid>` query parameter maps to the one filter the API actually supports, which
  keeps the URL honest — every filter in the UI corresponds to a real server capability.
- Date filtering is **not offered**, because the API cannot do it and filtering a full client-side
  history would imply a capability that collapses at scale.
- **Flagged for the backend**: `GET /transactions` needs pagination before real use. Building the
  list around today's shape is acceptable; designing the IA as though the shape is permanent is
  not.

Labels grow slowly and are explicitly designed for client-side filtering — the spec states a
personal Book holds dozens, not thousands, and offers no search endpoint. Fetch once, cache,
filter in memory.

## URL Strategy

- **Pattern**: `/resource/:id`, at most two segments deep. No nesting beyond that.
- **Dynamic segments**: `:id` is always a UUID — `/transactions/:id`.
- **Query parameters**:
  - `?account=<uuid>` on `/` — the transaction-list filter. Mirrors the API's `accountId`.
  - `?token=<token>` on `/verify-email` and `/reset-password` — arrives from an emailed link and
    is consumed immediately, never persisted into history or logs.
- **No query params for UI state.** The intent selector, the label picker and the undo countdown
  are ephemeral and are not reflected in the URL — a half-typed transaction is not a shareable
  location.
- **Redirect chain** (evaluated in order, and the backbone of the whole structure):
  1. No valid session → `/login`, preserving the attempted path for post-login return.
  2. Session valid, zero accounts → `/setup`, and no other authenticated route may be entered.
  3. Otherwise → the requested route, defaulting to `/`.
