# legacy/ — vendored BygSmart 2.1 (placeholder)

This directory will hold the **entire BygSmart 2.1 tree, vendored as ONE snapshot commit**
at repo cutover (task 0.7), taken from the tag `v2.1.0-final` on the 2.1 repository.

It is a **parts bin, read-only**:
- Harvested for `packages/core`, `packages/calc-engine`, Danish domain copy, and the
  90+ migrations of hard-won schema/RLS knowledge (as a *specification*, not executable history).
- **Never imported by shipping code** — the boundaries lint rule forbids it.
- **Deleted at G5**, once everything worth keeping has been harvested. A parts bin nobody
  throws away becomes a source of accidental imports.

The snapshot is not yet vendored: it is applied when the new repo is wired to its GitHub
remote and the 2.1 tag is cut.
