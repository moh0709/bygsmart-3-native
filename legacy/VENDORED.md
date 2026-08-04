# legacy/ — BygSmart 2.1, vendored at `v2.1.0-final`

This is the **entire BygSmart 2.1 source tree (901 files), vendored as one snapshot commit**
from the tag `v2.1.0-final` on the 2.1 repository (`github.com/moh0709/Byggeapp-2.0`, HEAD
`638bc0f`). It is the **reference / parts-bin** for the 3.0 Native rebuild.

Rules:
- **Read-only.** Harvested for `packages/core`, `packages/calc-engine`, Danish domain copy,
  and the 85 migrations of schema/RLS knowledge (as a *specification*, not executable history).
- **Never imported by shipping code** — the `eslint-plugin-boundaries` rule forbids any import
  of `legacy/*` (no element's allow-list contains `legacy`).
- **Deleted at G5**, once everything worth keeping has been harvested. A parts bin nobody throws
  away becomes a source of accidental imports.

The 2.1 repo stays archived for history archaeology; this snapshot exists so the tree is
greppable from inside the 3.0 repo without a second checkout.
