# D-11 scoring sheet (fill one per candidate)

Candidate: `__________`  ·  Date: `__________`  ·  Tester: `__________`

## Hard gates (a FAIL here eliminates the candidate — plan §4.1)
- [ ] **G-a** B1–B5 pass on **all three** runtimes (basic sync + tombstones + cursor + schema fit)
- [ ] **G-b** W1–W3 pass on **native** (guaranteed-offline platforms)
- [ ] **G-c** R5 handled correctly (Online-only **refuses** to queue — never lies)

## Weighted score (only for candidates passing all hard gates)
| Dimension | Weight | Score 0–5 | Weighted |
|---|--:|--:|--:|
| RNW maturity (R1,R2,R6,R8) | 30% | | |
| Offline-write correctness (W1–W4,N1–N2) | 25% | | |
| Web resilience (R3,R4,R7) | 15% | | |
| Schema + RLS fit (B5) | 10% | | |
| Integration cost (setup friction) | 10% | | |
| AR-05 compatibility (fits the contract) | 10% | | |
| **Total** | 100% | | |

## Decision (plan §4.3)
- [ ] Both pass gates → BUY higher-weighted
- [ ] One passes → BUY it
- [ ] Both pass native, FAIL RNW → BUY for native, web launches Online-only — **ESCALATE**
- [ ] Both fail native → BUILD bespoke — **ESCALATE**

**Signed D-11:** `____________________`   **Recommendation on record:** BUY.

## Cell log (verdict + evidence link per scenario × runtime)
Attach the filled matrix (from `blankScorecard()`): scenarioId | ios | android | web | evidence.
