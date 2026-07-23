# Design Tokens — moved

Phase 4's output was `DESIGN_TOKENS.css` in this folder. It now lives at:

**[`src/styles/tokens.css`](../../src/styles/tokens.css)**

Its own header prescribed the move — "when the repo is scaffolded this file moves to
`src/styles/tokens.css`" — and Task 1 scaffolded the repo. It is imported once, at the app root.

There is no copy left here on purpose. Two files of colour values drift, and the one under
`.design/` would be the one nobody edits and everybody quotes. The design decisions it encodes —
money is not colour-coded, all figures are mono and tabular, one accent used sparingly — are
still documented in full in the comments at the top of the file, which is where anyone changing a
value will actually be standing.
